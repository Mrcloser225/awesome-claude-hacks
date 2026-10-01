import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import WebSocket from "ws";
import type { CoachModel, ServerMessage } from "@closer/core";
import { buildApp } from "../src/app.js";
import { NoopStt } from "../src/stt/none.js";
import { RedisBus } from "../src/session/bus.js";

/**
 * Two API instances sharing a Redis. Instance A owns a bot call; a watcher on
 * instance B attaches and sees A's events; a Recall webhook that lands on B is
 * forwarded to A and ingested. Runs when TEST_REDIS_URL is set.
 */
const url = process.env.TEST_REDIS_URL;
const d = url ? describe : describe.skip;
const coach: CoachModel = { async *stream() { yield "TYPE: say_this\nHEADLINE: h\nSAY:\nline\nWHY: w\n"; } };

d("multi-instance over Redis", () => {
  let a: Awaited<ReturnType<typeof buildApp>>; let b: Awaited<ReturnType<typeof buildApp>>;
  let portB = 0;
  beforeAll(async () => {
    a = await buildApp({ devApiKey: "k", makeStt: () => new NoopStt(), model: coach, bus: new RedisBus(new Redis(url!)), instanceId: "A", createBot: async () => ({ botId: "bot-A" }) });
    b = await buildApp({ devApiKey: "k", makeStt: () => new NoopStt(), model: coach, bus: new RedisBus(new Redis(url!)), instanceId: "B" });
    await a.app.listen({ port: 0, host: "127.0.0.1" });
    await b.app.listen({ port: 0, host: "127.0.0.1" });
    portB = (b.app.server.address() as { port: number }).port;
  });
  afterAll(async () => { await a.app.close(); await b.app.close(); });

  it("routes events and webhooks across instances", async () => {
    const created = await a.app.inject({ method: "POST", url: "/v1/bots", headers: { authorization: "Bearer k" }, payload: { meetingUrl: "https://teams.microsoft.com/l/x", context: { callId: "shared-call", rep: { name: "JP", company: "G" } } } });
    expect(created.statusCode).toBe(201);
    await new Promise((r) => setTimeout(r, 50));
    expect(await a.hub.whereIs("shared-call")).toBe("here");
    expect(await b.hub.whereIs("shared-call")).toBe("elsewhere");

    const ws = new WebSocket(`ws://127.0.0.1:${portB}/v1/live?token=k`);
    await new Promise<void>((r) => ws.once("open", () => r()));
    const got: ServerMessage[] = [];
    ws.on("message", (m) => got.push(JSON.parse(m.toString()) as ServerMessage));
    const waitFor = (t: string, ms = 4000) => new Promise<ServerMessage>((res, rej) => { const had = got.find((g) => g.type === t); if (had) return res(had); const tm = setTimeout(() => rej(new Error(`no ${t}; got ${got.map((g) => g.type).join(",")}`)), ms); const h = (d: WebSocket.RawData) => { const m = JSON.parse(d.toString()) as ServerMessage; if (m.type === t) { clearTimeout(tm); ws.off("message", h); res(m); } }; ws.on("message", h); });
    ws.send(JSON.stringify({ type: "session.attach", callId: "shared-call" }));
    await waitFor("session.ready");

    // Webhook lands on B, which does not own the call.
    const wh = await b.app.inject({ method: "POST", url: "/v1/webhooks/recall", payload: { event: "transcript.data", data: { bot: { id: "bot-A", metadata: { repName: "JP" } }, data: { participant: { name: "Sam" }, words: [{ text: "How much does it cost?", start_timestamp: { relative: 3 }, end_timestamp: { relative: 4 } }] } } } });
    expect(wh.statusCode).toBe(204);
    const seg = await waitFor("transcript.final");
    expect(seg).toMatchObject({ segment: { speaker: "prospect", text: "How much does it cost?" } });
    const done = await waitFor("coach.done");
    expect(done).toMatchObject({ event: { script: "line" } });
    expect(a.hub.get("shared-call")!.store.finals()).toHaveLength(1);
    ws.close();
    await new Promise((r) => setTimeout(r, 100));
  });
});
