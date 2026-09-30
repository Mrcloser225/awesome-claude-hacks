import { describe, expect, it } from "vitest";
import { TranscriptStore } from "../src/transcript-store.js";
import { TriggerEngine } from "../src/trigger-engine.js";

function seg(id: string, speaker: "rep" | "prospect", text: string, start: number, end: number) {
  return { id, speaker, text, startMs: start, endMs: end, isFinal: true } as const;
}

describe("TriggerEngine", () => {
  it("fires priority 1 on objections regardless of rate limit", () => {
    let now = 0;
    const store = new TranscriptStore();
    const eng = new TriggerEngine(store, { now: () => now, minIntervalMs: 3000 });
    const a = seg("a", "prospect", "We have six tenders coming up over the next two months.", 0, 4000);
    store.upsert(a);
    expect(eng.onFinalSegment(a)?.reason).toBe("prospect_finished");
    now = 500;
    const b = seg("b", "prospect", "But honestly it sounds too expensive for us", 4000, 6000);
    store.upsert(b);
    const t = eng.onFinalSegment(b);
    expect(t?.reason).toBe("objection_detected");
    expect(t?.priority).toBe(1);
  });

  it("rate limits ordinary prospect turns", () => {
    let now = 0;
    const store = new TranscriptStore();
    const eng = new TriggerEngine(store, { now: () => now, minIntervalMs: 3000 });
    const a = seg("a", "prospect", "We are a groundworks contractor based in Kent doing about eight million a year.", 0, 4000);
    store.upsert(a);
    expect(eng.onFinalSegment(a)).not.toBeNull();
    now = 1000;
    const b = seg("b", "prospect", "Most of our work comes through two main contractors at the moment.", 4000, 7000);
    store.upsert(b);
    expect(eng.onFinalSegment(b)).toBeNull();
    now = 5000;
    const c = seg("c", "prospect", "We have never been on a framework before and want to change that.", 7000, 9000);
    store.upsert(c);
    expect(eng.onFinalSegment(c)?.reason).toBe("prospect_finished");
  });

  it("fires silence once after the prospect stops", () => {
    let now = 0;
    const store = new TranscriptStore();
    const eng = new TriggerEngine(store, { now: () => now, silenceMs: 5000 });
    const a = seg("a", "prospect", "Right.", 0, 500);
    store.upsert(a);
    eng.onFinalSegment(a);
    now = 3000;
    expect(eng.onTick()).toBeNull();
    now = 6000;
    expect(eng.onTick()?.reason).toBe("silence");
    now = 9000;
    expect(eng.onTick()).toBeNull();
  });

  it("warns on rep monologue", () => {
    let now = 0;
    const store = new TranscriptStore();
    const eng = new TriggerEngine(store, { now: () => now, monologueMs: 60_000 });
    const a = seg("a", "rep", "So let me tell you about everything we do...", 0, 70_000);
    store.upsert(a);
    const t = eng.onFinalSegment(a);
    expect(t?.reason).toBe("rep_monologue");
    expect(t?.priority).toBe(3);
  });
});
