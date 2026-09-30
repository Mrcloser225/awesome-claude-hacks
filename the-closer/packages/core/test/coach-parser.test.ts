import { describe, expect, it } from "vitest";
import { CoachStreamParser, parseCoachText } from "../src/coach-parser.js";

const FULL = `TYPE: objection
STAGE: pricing
HEADLINE: Price pushback, reframe to value
SAY:
I hear you, and I'd rather you spend nothing than spend it on a bid you can't win. Can I ask what one of these contracts is worth to you over the year?
That's the number the fee should be measured against.
WHY: Reframes fee against contract value and hands the floor back with a question.`;

describe("CoachStreamParser", () => {
  it("parses a complete response", () => {
    const p = parseCoachText(FULL);
    expect(p.type).toBe("objection");
    expect(p.stage).toBe("pricing");
    expect(p.headline).toBe("Price pushback, reframe to value");
    expect(p.script.startsWith("I hear you")).toBe(true);
    expect(p.script.endsWith("measured against.")).toBe(true);
    expect(p.rationale).toMatch(/^Reframes/);
  });

  it("streams script deltas without leaking a partial WHY label", () => {
    const deltas: Array<[string, string]> = [];
    const p = new CoachStreamParser((f, t) => deltas.push([f, t]));
    // Feed in awkward chunks, splitting inside labels.
    const chunks = ["TYPE: obj", "ection\nSTA", "GE: pricing\nHEADLINE: Price push", "back\nSAY:\nI hear you.\nW", "H", "Y: Because.\n"];
    for (const c of chunks) p.push(c);
    const done = p.finish();
    const script = deltas.filter(([f]) => f === "script").map(([, t]) => t).join("");
    expect(script).toBe("I hear you.");
    expect(done.script).toBe("I hear you.");
    expect(done.rationale).toBe("Because.");
    expect(deltas.filter(([f]) => f === "headline").map(([, t]) => t).join("")).toBe("Price pushback");
  });

  it("is prefix-stable for every chunk size", () => {
    for (let size = 1; size <= 25; size++) {
      const deltas: Array<[string, string]> = [];
      const p = new CoachStreamParser((f, t) => deltas.push([f, t]));
      for (const c of FULL.match(new RegExp(`.{1,${size}}`, "gs")) ?? []) p.push(c);
      const done = p.finish();
      const script = deltas.filter(([f]) => f === "script").map(([, t]) => t).join("");
      expect(script, `chunk size ${size}`).toBe(done.script);
      expect(done.script.startsWith("I hear you")).toBe(true);
      expect(deltas.filter(([f]) => f === "headline").map(([, t]) => t).join("")).toBe("Price pushback, reframe to value");
    }
  });

  it("falls back gracefully on malformed output", () => {
    const p = parseCoachText("Just say: thanks for your time.");
    expect(p.type).toBe("say_this");
    expect(p.script).toBe("");
  });
});
