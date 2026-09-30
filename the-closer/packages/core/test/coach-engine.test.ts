import { describe, expect, it } from "vitest";
import { CoachEngine, type CoachModel, type CoachSink } from "../src/coach-engine.js";
import { GLAXTONS_PLAYBOOK } from "../src/default-playbook.js";
import { TranscriptStore } from "../src/transcript-store.js";
import type { CoachEvent } from "../src/types.js";

const ctx = { callId: "c1", rep: { name: "JP", company: "Glaxtons" } };

function fakeModel(text: string, delayMs = 0): CoachModel {
  return {
    async *stream({ signal }) {
      for (const ch of text.match(/.{1,12}/gs) ?? []) {
        if (signal.aborted) return;
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        yield ch;
      }
    },
  };
}

function sink() {
  const events: string[] = [];
  const done: CoachEvent[] = [];
  const s: CoachSink = {
    onStart: (e) => events.push(`start:${e.id}`),
    onDelta: () => {},
    onDone: (e) => { events.push(`done:${e.id}`); done.push(e); },
    onCancelled: (id) => events.push(`cancel:${id}`),
    onError: (id, err) => events.push(`error:${id}:${String(err)}`),
  };
  return { s, events, done };
}

const RESPONSE = "TYPE: say_this\nSTAGE: discovery\nHEADLINE: Ask for the deadline\nSAY:\nWhen is it due, and when is the clarification cut-off?\nWHY: Deadline is the real constraint.\n";

describe("CoachEngine", () => {
  it("streams and completes an event", async () => {
    const { s, events, done } = sink();
    const eng = new CoachEngine(fakeModel(RESPONSE), new TranscriptStore(), GLAXTONS_PLAYBOOK, ctx, s);
    const id = eng.handle({ reason: "prospect_finished", priority: 2, at: 0 });
    expect(id).not.toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    expect(events).toEqual([`start:${id}`, `done:${id}`]);
    expect(done[0]?.script).toBe("When is it due, and when is the clarification cut-off?");
    expect(done[0]?.stage).toBe("discovery");
  });

  it("higher priority trigger cancels a lower one; equal priority is dropped", async () => {
    const { s, events } = sink();
    const eng = new CoachEngine(fakeModel(RESPONSE, 5), new TranscriptStore(), GLAXTONS_PLAYBOOK, ctx, s);
    const slow = eng.handle({ reason: "prospect_finished", priority: 2, at: 0 });
    expect(eng.handle({ reason: "silence", priority: 2, at: 1 })).toBeNull();
    const fast = eng.handle({ reason: "objection_detected", priority: 1, at: 2 });
    await new Promise((r) => setTimeout(r, 200));
    expect(events).toContain(`cancel:${slow}`);
    expect(events).toContain(`done:${fast}`);
    expect(events).not.toContain(`done:${slow}`);
    expect(eng.objectionsRaised).toBe(1);
  });

  it("system prompt is stable across calls for caching", () => {
    const a = new CoachEngine(fakeModel(""), new TranscriptStore(), GLAXTONS_PLAYBOOK, ctx, sink().s);
    const b = new CoachEngine(fakeModel(""), new TranscriptStore(), GLAXTONS_PLAYBOOK, ctx, sink().s);
    expect(a.systemPrompt).toBe(b.systemPrompt);
    expect(a.systemPrompt).toContain("93% success rate");
    expect(a.systemPrompt).toContain("Never quote a discount");
  });
});
