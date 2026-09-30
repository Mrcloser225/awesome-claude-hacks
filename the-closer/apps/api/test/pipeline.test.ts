import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { CoachModel, ServerMessage, TranscriptSegment } from "@closer/core";
import { buildApp } from "../src/app.js";
import type { SttProvider } from "../src/stt/types.js";

/**
 * End-to-end pipeline test with the real Fastify app, real WebSocket transport,
 * a scripted STT provider and a scripted coach model. Proves:
 *   audio frames -> STT -> transcript events -> trigger -> streamed coach event.
 */
class ScriptedStt implements SttProvider {
  static instances: ScriptedStt[] = [];
  private h?: Parameters<SttProvider["start"]>[0];
  bytesReceived = 0;
  constructor() { ScriptedStt.instances.push(this); }
  async start(h: Parameters<SttProvider["start"]>[0]) { this.h = h; }
  sendAudio(frame: Buffer) {
    this.bytesReceived += frame.length;
    // After ~200ms of audio, pretend the prospect said something with a price objection.
    if (this.bytesReceived >= 1280 * 10 && !this.fired) {
      this.fired = true;
      this.emit({ id: "p1", speaker: "prospect", text: "It sounds good but honestly it feels too expensive for us.", startMs: 0, endMs: 2500, isFinal: false });
      this.emit({ id: "p1", speaker: "prospect", text: "It sounds good but honestly it feels too expensive for us.", startMs: 0, endMs: 2500, isFinal: true });
    }
  }
  private fired = false;
  emit(seg: TranscriptSegment) { this.h?.onSegment(seg); }
  async stop() {}
}

const scriptedModel: CoachModel = {
  async *stream({ user }) {
    expect(user).toContain("PROSPECT: It sounds good");
    expect(user).toContain("objection");
    const text = "TYPE: objection\nSTAGE: pricing\nHEADLINE: Reframe fee against contract value\nSAY:\nI hear you. Can I ask what one of these contracts is worth to you over a year? That's the number the fee should sit against.\nWHY: Moves the conversation from cost to value and hands the floor back.\n";
    for (const chunk of text.match(/.{1,20}/gs) ?? []) yield chunk;
  },
};

let baseUrl = "";
let app: Awaited<ReturnType<typeof buildApp>>["app"];

beforeAll(async () => {
  ({ app } = await buildApp({ devApiKey: "test-key", makeStt: () => new ScriptedStt(), model: scriptedModel }));
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  baseUrl = `127.0.0.1:${addr.port}`;
});
afterAll(async () => { await app.close(); });

function collect(ws: WebSocket, until: (m: ServerMessage) => boolean, timeoutMs = 5000): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const msgs: ServerMessage[] = [];
    const t = setTimeout(() => reject(new Error(`timeout; got ${JSON.stringify(msgs)}`)), timeoutMs);
    ws.on("message", (d) => {
      const m = JSON.parse(d.toString()) as ServerMessage;
      msgs.push(m);
      if (until(m)) { clearTimeout(t); resolve(msgs); }
    });
  });
}

describe("live pipeline", () => {
  it("rejects a bad key", async () => {
    const ws = new WebSocket(`ws://${baseUrl}/v1/live?token=wrong`);
    const msgs = await collect(ws, (m) => m.type === "error");
    expect(msgs[0]).toMatchObject({ type: "error", code: "unauthorised" });
  });

  it("streams a coach event from audio", async () => {
    const ws = new WebSocket(`ws://${baseUrl}/v1/live?token=test-key`);
    await new Promise<void>((r) => ws.once("open", () => r()));
    const done = collect(ws, (m) => m.type === "coach.done");
    ws.send(JSON.stringify({ type: "session.start", context: { callId: "call-1", rep: { name: "JP", company: "Glaxtons" }, prospect: { name: "Sam", company: "Acme Groundworks" } } }));
    // 20 frames of silence, 20 ms each
    for (let i = 0; i < 20; i++) ws.send(Buffer.alloc(1280));
    const msgs = await done;

    const types = msgs.map((m) => m.type);
    expect(types.slice(0, 2)).toEqual(["session.snapshot", "session.ready"]);
    expect(types).toContain("transcript.partial");
    expect(types).toContain("transcript.final");
    expect(types).toContain("coach.start");
    expect(types.filter((t) => t === "coach.delta").length).toBeGreaterThan(1);

    const start = msgs.find((m) => m.type === "coach.start");
    expect(start).toMatchObject({ event: { type: "objection", priority: 1, triggerSegmentId: "p1" } });

    const final = msgs.find((m) => m.type === "coach.done");
    expect(final && final.type === "coach.done" ? final.event : null).toMatchObject({
      type: "objection",
      stage: "pricing",
      headline: "Reframe fee against contract value",
    });
    const scriptDeltas = msgs.filter((m): m is Extract<ServerMessage, { type: "coach.delta" }> => m.type === "coach.delta" && m.field === "script").map((m) => m.text).join("");
    expect(scriptDeltas).toBe((final as Extract<ServerMessage, { type: "coach.done" }>).event.script);

    ws.send(JSON.stringify({ type: "session.stop" }));
    const after = await collect(ws, (m) => m.type === "metrics");
    const metrics = after.find((m) => m.type === "metrics");
    expect(metrics && metrics.type === "metrics" ? metrics.metrics.objectionsRaised : -1).toBe(1);
    ws.close();
  });

  it("accepts pushed transcripts without audio (meeting bot path)", async () => {
    const ws = new WebSocket(`ws://${baseUrl}/v1/live?token=test-key`);
    await new Promise<void>((r) => ws.once("open", () => r()));
    const done = collect(ws, (m) => m.type === "coach.done");
    ws.send(JSON.stringify({ type: "session.start", context: { callId: "call-2", rep: { name: "JP", company: "Glaxtons" } } }));
    ws.send(JSON.stringify({ type: "transcript.push", segment: { speaker: "prospect", text: "It sounds good but honestly it feels too expensive for us.", startMs: 0, endMs: 2000, isFinal: true } }));
    const msgs = await done;
    expect(msgs.some((m) => m.type === "coach.done")).toBe(true);
    ws.close();
  });
});
