import { describe, expect, it } from "vitest";
import { detectObjection, isQuestion } from "../src/objections.js";

describe("detectObjection", () => {
  it("flags price", () => expect(detectObjection("Honestly that feels too expensive for us")).toBe("price"));
  it("flags brush-off", () => expect(detectObjection("Can you send me some information and I'll have a look")).toBe("brush_off"));
  it("flags competitor", () => expect(detectObjection("We already use another consultancy for this")).toBe("competitor"));
  it("flags authority", () => expect(detectObjection("I'd need to check with my director first")).toBe("authority"));
  it("ignores neutral talk", () => expect(detectObjection("We have a tender due at the end of the month")).toBeNull());
});

describe("isQuestion", () => {
  it("detects trailing question mark", () => expect(isQuestion("How long does it take?")).toBe(true));
  it("detects wh-openers without punctuation", () => expect(isQuestion("what does the fixed fee include")).toBe(true));
  it("rejects statements", () => expect(isQuestion("We are looking at the Pagabo lot")).toBe(false));
});
