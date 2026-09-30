import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { registerRecallRoute, verifyRecallSignature } from "../src/routes/recall.js";
import type { LiveSession } from "../src/session/live-session.js";

describe("recall webhook", () => {
  it("verifies HMAC signatures", () => {
    const body = JSON.stringify({ a: 1 });
    const sig = createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(verifyRecallSignature("s3cret", body, sig)).toBe(true);
    expect(verifyRecallSignature("s3cret", body, "deadbeef")).toBe(false);
  });

  it("maps participants to speakers and ingests", async () => {
    const ingested: unknown[] = [];
    const fake = { ingest: (s: unknown) => ingested.push(s) } as unknown as LiveSession;
    const app = Fastify();
    registerRecallRoute(app, { sessionForBot: (id) => (id === "bot1" ? fake : undefined) });
    const payload = {
      event: "transcript.data",
      data: {
        bot: { id: "bot1", metadata: { callId: "c1", repName: "JP" } },
        data: {
          participant: { id: 2, name: "Sam Prospect" },
          words: [
            { text: "How", start_timestamp: { relative: 10.0 }, end_timestamp: { relative: 10.2 } },
            { text: "much?", start_timestamp: { relative: 10.2 }, end_timestamp: { relative: 10.6 } },
          ],
        },
      },
    };
    const res = await app.inject({ method: "POST", url: "/v1/webhooks/recall", payload });
    expect(res.statusCode).toBe(204);
    expect(ingested[0]).toMatchObject({ speaker: "prospect", participant: "Sam Prospect", text: "How much?", startMs: 10000, endMs: 10600, isFinal: true });

    payload.data.data.participant.name = "JP";
    await app.inject({ method: "POST", url: "/v1/webhooks/recall", payload });
    expect(ingested[1]).toMatchObject({ speaker: "rep" });
    const missing = await app.inject({ method: "POST", url: "/v1/webhooks/recall", payload: { ...payload, data: { ...payload.data, bot: { id: "nope" } } } });
    expect(missing.statusCode).toBe(404);
  });
});
