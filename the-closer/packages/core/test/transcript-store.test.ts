import { describe, expect, it } from "vitest";
import { TranscriptStore } from "../src/transcript-store.js";

describe("TranscriptStore", () => {
  it("replaces partials in place and computes metrics", () => {
    const s = new TranscriptStore();
    s.upsert({ id: "a", speaker: "rep", text: "Hi, thanks for", startMs: 0, endMs: 1000, isFinal: false });
    s.upsert({ id: "a", speaker: "rep", text: "Hi, thanks for joining. What's the deadline?", startMs: 0, endMs: 3000, isFinal: true });
    s.upsert({ id: "b", speaker: "prospect", text: "End of the month.", startMs: 3500, endMs: 5000, isFinal: true });
    expect(s.all()).toHaveLength(2);
    const m = s.metrics();
    expect(m.repTalkMs).toBe(3000);
    expect(m.prospectTalkMs).toBe(1500);
    expect(m.repTalkRatio).toBeCloseTo(3000 / 4500);
    expect(m.questionsAskedByRep).toBe(1);
  });

  it("renders newest-last within a char budget", () => {
    const s = new TranscriptStore();
    for (let i = 0; i < 10; i++) {
      s.upsert({ id: `s${i}`, speaker: i % 2 ? "prospect" : "rep", text: `line ${i} ${"x".repeat(20)}`, startMs: i * 1000, endMs: i * 1000 + 900, isFinal: true });
    }
    const out = s.render({ maxChars: 120 });
    const lines = out.split("\n");
    expect(lines[lines.length - 1]).toContain("line 9");
    expect(lines.length).toBeLessThan(10);
    expect(lines[0]).toMatch(/^(REP|PROSPECT):/);
  });
});
