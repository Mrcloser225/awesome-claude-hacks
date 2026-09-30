import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { CoachModel, InsightModel, ServerMessage } from "@closer/core";
import { buildApp } from "../src/app.js";
import { DevAuth } from "../src/auth.js";
import { NoopStt } from "../src/stt/none.js";

/**
 * The meeting-bot loop, end to end and without a network:
 *   POST /v1/bots  -> session registered against the bot id
 *   rep attaches over WS and gets a snapshot
 *   Recall webhook posts the prospect asking a pricing question
 *   coach answers it from the knowledge base; the attached rep sees the streamed card
 *   after enough prospect turns the discovery tracker posts an insight with the next questions
 *   Recall posts call_ended -> session closes, onCallEnded fires
 */
const coach: CoachModel = {
  async *stream({ system, user }) {
    // The knowledge base must be in the cached system prompt, the question in the user turn.
    expect(system).toContain("Bid review from £1,500");
    expect(user).toContain("asked a question");
    const text = "TYPE: answer\nSTAGE: pricing\nHEADLINE: Answer pricing, then qualify\nSAY:\nA bid review starts at £1,500 and full bid management from £6,000, fixed before we start. Which lot are you going for, so I can tell you which one fits?\nWHY: Answers straight from the price list and hands the floor back with the highest-value open question.\n";
    for (const c of text.match(/.{1,24}/gs) ?? []) yield c;
  },
};

let insightCalls = 0;
const insight: InsightModel = {
  async extract() {
    insightCalls += 1;
    return {
      stage: "discovery",
      facts: [{ key: "timeline", value: "tender due end of month", confidence: "high" }],
      answeredQuestions: ["deadline"],
      nextQuestions: [{ question: "Which lot are you going for?", why: "drives win probability", priority: 1 }],
      openProspectQuestions: [],
      risks: ["no budget confirmed"],
      buyingSignals: [],
    };
  },
};

const ended: string[] = [];
let app: Awaited<ReturnType<typeof buildApp>>["app"];
let base = "";

beforeAll(async () => {
  ({ app } = await buildApp({
    auth: new DevAuth("k"),
    makeStt: () => new NoopStt(),
    model: coach,
    insightModel: insight,
    knowledge: new Map([["pricing", { id: "pricing", title: "Price list", body: "Bid review from £1,500. Full bid management from £6,000." }]]),
    createBot: async ({ meetingUrl }) => { expect(meetingUrl).toContain("teams.microsoft.com"); return { botId: "bot-42" }; },
    onCallEnded: (s) => { ended.push(s.ctx.callId); },
  }));
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  if (!addr || typeof addr === "string") throw new Error("no addr");
  base = `127.0.0.1:${addr.port}`;
});
afterAll(async () => { await app.close(); });

function recallTranscript(botId: string, name: string, text: string, t: number, final = true) {
  return {
    event: final ? "transcript.data" : "transcript.partial_data",
    data: { bot: { id: botId, metadata: { callId: "call-bot", repName: "JP" } }, data: { participant: { id: 2, name }, words: text.split(" ").map((w, i) => ({ text: w, start_timestamp: { relative: t + i * 0.3 }, end_timestamp: { relative: t + i * 0.3 + 0.25 } })) } },
  };
}

describe("meeting bot flow", () => {
  it("joins, answers the client's question, tracks discovery, and closes out", async () => {
    const created = await app.inject({
      method: "POST", url: "/v1/bots", headers: { authorization: "Bearer k" },
      payload: { meetingUrl: "https://teams.microsoft.com/l/meetup-join/abc", context: { callId: "call-bot", rep: { name: "JP", company: "Glaxtons" }, prospect: { name: "Sam", company: "Acme Groundworks" } } },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ botId: "bot-42", callId: "call-bot" });

    // Rep attaches from the overlay / Teams side panel.
    const ws = new WebSocket(`ws://${base}/v1/live?token=k`);
    await new Promise<void>((r) => ws.once("open", () => r()));
    const got: ServerMessage[] = [];
    const waitFor = (pred: (m: ServerMessage) => boolean, ms = 5000) => new Promise<ServerMessage>((res, rej) => {
      const hit = got.find(pred); if (hit) return res(hit);
      const t = setTimeout(() => rej(new Error(`timeout waiting; got ${got.map((m) => m.type).join(",")}`)), ms);
      const h = (d: WebSocket.RawData) => { const m = JSON.parse(d.toString()) as ServerMessage; if (pred(m)) { clearTimeout(t); ws.off("message", h); res(m); } };
      ws.on("message", h);
    });
    ws.on("message", (d) => got.push(JSON.parse(d.toString()) as ServerMessage));
    ws.send(JSON.stringify({ type: "session.attach", callId: "call-bot" }));
    const snap = await waitFor((m) => m.type === "session.snapshot");
    expect(snap).toMatchObject({ type: "session.snapshot", callId: "call-bot", bot: { botId: "bot-42", status: "requested" }, transcript: [], events: [] });

    // Bot lifecycle from Recall.
    await app.inject({ method: "POST", url: "/v1/webhooks/recall", payload: { event: "bot.status_change", data: { bot: { id: "bot-42" }, data: { code: "in_call_recording", sub_code: null } } } });
    expect(await waitFor((m) => m.type === "bot.status")).toMatchObject({ status: "in_call" });

    // The prospect asks a pricing question. Partial first, then final.
    await app.inject({ method: "POST", url: "/v1/webhooks/recall", payload: recallTranscript("bot-42", "Sam Prospect", "So what does a", 12, false) });
    await app.inject({ method: "POST", url: "/v1/webhooks/recall", payload: recallTranscript("bot-42", "Sam Prospect", "So what does a bid review actually cost?", 12) });
    const done = await waitFor((m) => m.type === "coach.done");
    expect(done).toMatchObject({ event: { type: "answer", stage: "pricing", headline: "Answer pricing, then qualify" } });
    const script = got.filter((m): m is Extract<ServerMessage, { type: "coach.delta" }> => m.type === "coach.delta" && m.field === "script").map((m) => m.text).join("");
    expect(script).toContain("£1,500");
    expect(script).toContain("Which lot are you going for");
    expect(got.some((m) => m.type === "transcript.partial")).toBe(true);

    // Two more prospect turns trip the discovery tracker (default every 3).
    await app.inject({ method: "POST", url: "/v1/webhooks/recall", payload: recallTranscript("bot-42", "Sam Prospect", "The tender is due at the end of the month and we have never bid before.", 20) });
    await app.inject({ method: "POST", url: "/v1/webhooks/recall", payload: recallTranscript("bot-42", "Sam Prospect", "We do groundworks and piling mostly for two main contractors.", 28) });
    const ins = await waitFor((m) => m.type === "insight");
    expect(ins).toMatchObject({ insight: { stage: "discovery", nextQuestions: [{ question: "Which lot are you going for?" }] } });
    expect(insightCalls).toBe(1);

    // The rep's own words are attributed to the rep, not the prospect.
    await app.inject({ method: "POST", url: "/v1/webhooks/recall", payload: recallTranscript("bot-42", "JP", "Great, and which lot were you thinking of?", 35) });
    const repLine = await waitFor((m) => m.type === "transcript.final" && m.segment.speaker === "rep");
    expect(repLine).toMatchObject({ segment: { participant: "JP" } });

    // REST view of the live call, and a rep asking through REST (Teams tab without a socket).
    const view = await app.inject({ method: "GET", url: "/v1/calls/call-bot", headers: { authorization: "Bearer k" } });
    expect(view.json()).toMatchObject({ callId: "call-bot", insight: { stage: "discovery" } });
    expect((view.json() as { events: unknown[] }).events).toHaveLength(1);
    const ask = await app.inject({ method: "POST", url: "/v1/calls/call-bot/ask", headers: { authorization: "Bearer k" }, payload: { question: "give me a close" } });
    expect(ask.statusCode).toBe(202);

    // Call ends: session closes, hub forgets it, onCallEnded fired.
    await app.inject({ method: "POST", url: "/v1/webhooks/recall", payload: { event: "bot.done", data: { bot: { id: "bot-42" }, data: { code: "done" } } } });
    expect(await waitFor((m) => m.type === "bot.status" && m.status === "ended")).toBeTruthy();
    expect(ended).toEqual(["call-bot"]);
    const gone = await app.inject({ method: "GET", url: "/v1/calls/call-bot", headers: { authorization: "Bearer k" } });
    expect(gone.statusCode).toBe(404);
    ws.close();
  });

  it("refuses an attach to an unknown call and a bot when no provider is configured", async () => {
    const ws = new WebSocket(`ws://${base}/v1/live?token=k`);
    await new Promise<void>((r) => ws.once("open", () => r()));
    const err = await new Promise<ServerMessage>((res) => { ws.once("message", (d) => res(JSON.parse(d.toString()) as ServerMessage)); ws.send(JSON.stringify({ type: "session.attach", callId: "nope" })); });
    expect(err).toMatchObject({ type: "error", code: "no_such_call" });
    ws.close();

    const { app: bare } = await buildApp({ auth: new DevAuth("k"), makeStt: () => new NoopStt(), model: coach });
    const res = await bare.inject({ method: "POST", url: "/v1/bots", headers: { authorization: "Bearer k" }, payload: { meetingUrl: "https://teams.microsoft.com/x", context: { callId: "c", rep: { name: "a", company: "b" } } } });
    expect(res.statusCode).toBe(501);
    await bare.close();
  });
});
