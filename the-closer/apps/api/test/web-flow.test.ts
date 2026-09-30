import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CoachModel } from "@closer/core";
import { buildApp } from "../src/app.js";
import type { ChatModel } from "../src/coach/call-chat.js";
import { FirefliesClient } from "../src/integrations/fireflies.js";
import { NoopStt } from "../src/stt/none.js";

/**
 * The website's loop: sign up, import a Fireflies transcript, chat with Claude
 * about it, get a summary. Fake Fireflies (GraphQL over a stubbed fetch) and
 * fake models; the routes, auth, cookies, SSE framing and stores are real.
 */
const coach: CoachModel = { async *stream() { yield "TYPE: say_this\nSTAGE: discovery\nHEADLINE: x\nSAY:\ny\nWHY: z\n"; } };

const chat: ChatModel = {
  async *stream({ system, messages }) {
    expect(system).toContain("Bid review from £1,500");
    const last = messages[messages.length - 1]!;
    expect(last.content).toContain("call has ended");
    expect(last.content).toContain("SAM: We liked the deck but the price is steep");
    expect(last.content).toContain("Rep asks");
    for (const c of ["Sam's real objection is ", "value, not price. Say: ", "\"What would one won lot be worth to you?\""]) yield c;
  },
};

const firefliesFetch: typeof fetch = async (_url, init) => {
  const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
  expect(init?.headers).toMatchObject({ Authorization: "Bearer ff-test-key-1234" });
  if (body.query.startsWith("query List")) {
    return new Response(JSON.stringify({ data: { transcripts: [{ id: "t1", title: "Acme discovery", date: 1700000000000, duration: 1800 }] } }));
  }
  return new Response(JSON.stringify({ data: { transcript: {
    id: "t1", title: "Acme discovery", date: 1700000000000, duration: 1800, sentences: [
      { index: 0, speaker_name: "JP Olivier", text: "Thanks for joining, Sam.", start_time: 0, end_time: 1.5 },
      { index: 1, speaker_name: "Sam", text: "We liked the deck but the price is steep.", start_time: 2, end_time: 5 },
      { index: 2, speaker_name: "JP Olivier", text: "Understood. What is one lot worth to you?", start_time: 5.5, end_time: 8 },
      { index: 3, speaker_name: "Sam", text: "Maybe two million over the term.", start_time: 8.5, end_time: 10 },
    ] } } }));
};

let app: Awaited<ReturnType<typeof buildApp>>["app"];
beforeAll(async () => {
  ({ app } = await buildApp({
    makeStt: () => new NoopStt(), model: coach, chatModel: chat,
    knowledge: new Map([["pricing", { id: "pricing", title: "Price list", body: "Bid review from £1,500." }]]),
    firefliesClient: (key) => new FirefliesClient(key, firefliesFetch),
    summarise: async (rec) => ({
      outcome: "advanced", oneLine: `Priced against ${rec.transcript.length} lines`, prospectPains: [], objectionsRaised: [{ objection: "price", handled: true, note: "reframed" }],
      commitments: [], nextStep: "Send proposal", dealStage: "pricing", coachingNotes: [], crmNote: "n", followUpEmail: { subject: "s", body: "b" },
    }),
  }));
});
afterAll(async () => { await app.close(); });

describe("website flow", () => {
  let cookie = "";

  it("signs up, sets a session cookie, and rejects bad logins", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/auth/signup", payload: { email: "JP@Glaxtons.co.uk", password: "correct horse battery", name: "JP Olivier", company: "Glaxtons" } });
    expect(res.statusCode).toBe(201);
    cookie = res.headers["set-cookie"] as string;
    expect(cookie).toMatch(/^closer_session=.+HttpOnly/);
    expect(cookie).toContain("SameSite=Lax");

    const dup = await app.inject({ method: "POST", url: "/v1/auth/signup", payload: { email: "jp@glaxtons.co.uk", password: "correct horse battery", name: "x", company: "y" } });
    expect(dup.statusCode).toBe(409);
    const bad = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "jp@glaxtons.co.uk", password: "wrong password!" } });
    expect(bad.statusCode).toBe(401);
    const ok = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "jp@glaxtons.co.uk", password: "correct horse battery" } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ user: { name: "JP Olivier", company: "Glaxtons" } });

    const anon = await app.inject({ method: "GET", url: "/v1/auth/me" });
    expect(anon.statusCode).toBe(401);
    const me = await app.inject({ method: "GET", url: "/v1/auth/me", headers: { cookie } });
    expect(me.json()).toMatchObject({ user: { email: "jp@glaxtons.co.uk", company: "Glaxtons" } });
    // The JWT also works as a Bearer token for the desktop app.
    const bearer = await app.inject({ method: "GET", url: "/v1/auth/me", headers: { authorization: `Bearer ${(ok.json() as { token: string }).token}` } });
    expect(bearer.statusCode).toBe(200);
  });

  it("lists and imports a Fireflies transcript with the rep attributed by name", async () => {
    const list = await app.inject({ method: "POST", url: "/v1/integrations/fireflies/transcripts", headers: { cookie }, payload: { apiKey: "ff-test-key-1234" } });
    expect(list.json()).toEqual([{ id: "t1", title: "Acme discovery", date: 1700000000000, duration: 1800 }]);
    const imp = await app.inject({ method: "POST", url: "/v1/integrations/fireflies/import", headers: { cookie }, payload: { apiKey: "ff-test-key-1234", transcriptId: "t1", context: { prospect: { name: "Sam", company: "Acme" } } } });
    expect(imp.statusCode).toBe(201);
    expect(imp.json()).toMatchObject({ callId: "ff_t1", segments: 4 });
    const rec = await app.inject({ method: "GET", url: "/v1/calls/ff_t1", headers: { cookie } });
    const body = rec.json() as { transcript: Array<{ speaker: string; participant: string }>; live: boolean; source: string };
    expect(body.source).toBe("fireflies");
    expect(body.live).toBe(false);
    expect(body.transcript.map((t) => t.speaker)).toEqual(["rep", "prospect", "rep", "prospect"]);
  });

  it("chats with Claude about the call over SSE and summarises it", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/calls/ff_t1/chat", headers: { cookie }, payload: { messages: [{ role: "user", content: "What is Sam's real objection and what do I say?" }] } });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    const deltas = [...res.body.matchAll(/^data: (\{"delta".*)$/gm)].map((m) => (JSON.parse(m[1]!) as { delta: string }).delta).join("");
    expect(deltas).toBe("Sam's real objection is value, not price. Say: \"What would one won lot be worth to you?\"");
    expect(res.body).toContain("event: done");

    const bad = await app.inject({ method: "POST", url: "/v1/calls/ff_t1/chat", headers: { cookie }, payload: { messages: [{ role: "assistant", content: "hi" }] } });
    expect(bad.statusCode).toBe(400);

    const sum = await app.inject({ method: "POST", url: "/v1/calls/ff_t1/summary", headers: { cookie } });
    expect(sum.json()).toMatchObject({ outcome: "advanced", oneLine: "Priced against 4 lines" });
    const again = await app.inject({ method: "GET", url: "/v1/calls/ff_t1", headers: { cookie } });
    expect((again.json() as { summary: { nextStep: string } }).summary.nextStep).toBe("Send proposal");
  });

  it("keeps tenants apart", async () => {
    const other = await app.inject({ method: "POST", url: "/v1/auth/signup", payload: { email: "someone@else.com", password: "another password", name: "S", company: "Else Ltd" } });
    const otherCookie = other.headers["set-cookie"] as string;
    const rec = await app.inject({ method: "GET", url: "/v1/calls/ff_t1", headers: { cookie: otherCookie } });
    expect(rec.statusCode).toBe(404);
    const list = await app.inject({ method: "GET", url: "/v1/calls", headers: { cookie: otherCookie } });
    expect(list.json()).toEqual([]);
  });
});
