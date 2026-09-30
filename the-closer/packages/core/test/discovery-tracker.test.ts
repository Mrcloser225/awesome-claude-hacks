import { describe, expect, it } from "vitest";
import { DiscoveryTracker, type InsightModel } from "../src/discovery-tracker.js";
import { GLAXTONS_PLAYBOOK } from "../src/default-playbook.js";
import { TranscriptStore } from "../src/transcript-store.js";
import { buildKnowledgePack, buildSystemPrompt, buildUserPrompt } from "../src/prompt-builder.js";

const ctx = { callId: "c1", rep: { name: "JP", company: "Glaxtons" } };

describe("DiscoveryTracker", () => {
  it("runs after N prospect turns and exposes the insight", async () => {
    let calls = 0;
    const model: InsightModel = {
      async extract({ user }) {
        calls += 1;
        expect(user).toContain("PROSPECT:");
        return {
          stage: "discovery",
          facts: [{ key: "timeline", value: "tender due end of month", evidence: "due at the end of the month", confidence: "high" }],
          answeredQuestions: ["What is the deadline?"],
          nextQuestions: [{ question: "Which lot are you going for?", why: "Lot choice drives win probability", priority: 1 }],
          openProspectQuestions: [],
          risks: [],
          buyingSignals: ["asked about start dates"],
        };
      },
    };
    const store = new TranscriptStore();
    const seen: string[] = [];
    let now = 0;
    const tracker = new DiscoveryTracker(model, store, GLAXTONS_PLAYBOOK, ctx, (i) => seen.push(i.stage), { everyProspectTurns: 2, minIntervalMs: 0, now: () => now });
    store.upsert({ id: "p1", speaker: "prospect", text: "It is due at the end of the month.", startMs: 0, endMs: 1000, isFinal: true });
    tracker.onProspectTurn();
    expect(calls).toBe(0);
    store.upsert({ id: "p2", speaker: "prospect", text: "We want to go for it.", startMs: 1000, endMs: 2000, isFinal: true });
    tracker.onProspectTurn();
    await new Promise((r) => setTimeout(r, 5));
    expect(calls).toBe(1);
    expect(tracker.insight?.facts[0]?.key).toBe("timeline");
    expect(seen).toEqual(["discovery"]);

    const prompt = buildUserPrompt("PROSPECT: hi", { reason: "prospect_finished", priority: 2, at: 0 }, undefined, tracker.insight);
    expect(prompt).toContain("Which lot are you going for?");
    expect(prompt).toContain("timeline: tender due end of month");
  });
});

describe("knowledge pack", () => {
  it("is deterministic and included in the system prompt", () => {
    const docs = [
      { id: "b-pricing", title: "Pricing", body: "Bid review from £1,500. Full bid management from £6,000." },
      { id: "a-faq", title: "FAQ", body: "Q: Do you sign NDAs? A: Yes, as standard." },
    ];
    const pack = buildKnowledgePack(docs);
    expect(pack.indexOf("## FAQ")).toBeLessThan(pack.indexOf("## Pricing"));
    const sys = buildSystemPrompt(GLAXTONS_PLAYBOOK, ctx, docs);
    expect(sys).toContain("Full bid management from £6,000");
    expect(sys).toBe(buildSystemPrompt(GLAXTONS_PLAYBOOK, ctx, [...docs].reverse()));
  });
});
