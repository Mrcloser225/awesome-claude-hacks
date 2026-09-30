import { CoachStreamParser, type CoachField } from "./coach-parser.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt-builder.js";
import type { TranscriptStore } from "./transcript-store.js";
import type { CallContext, CoachEvent, Playbook, Priority, Trigger } from "./types.js";

/** Anything that can stream text for a (system, user) prompt pair. */
export interface CoachModel {
  stream(req: { system: string; user: string; signal: AbortSignal }): AsyncIterable<string>;
}

export interface CoachSink {
  onStart(event: Pick<CoachEvent, "id" | "type" | "priority" | "triggerSegmentId" | "createdAt">): void;
  onDelta(id: string, field: CoachField, text: string): void;
  onDone(event: CoachEvent): void;
  onCancelled(id: string): void;
  onError(id: string, err: unknown): void;
}

let counter = 0;
export function newId(prefix = "ce"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

/**
 * Turns triggers into streamed coach events. At most one model call is in
 * flight per call; a higher-priority trigger aborts a lower-priority one.
 */
export class CoachEngine {
  private inflight?: { id: string; priority: Priority; controller: AbortController };
  private readonly system: string;
  public objectionsRaised = 0;

  constructor(
    private readonly model: CoachModel,
    private readonly store: TranscriptStore,
    playbook: Playbook,
    ctx: CallContext,
    private readonly sink: CoachSink,
    private readonly opts: { transcriptChars?: number } = {},
  ) {
    this.system = buildSystemPrompt(playbook, ctx);
  }

  get systemPrompt(): string {
    return this.system;
  }

  /** Returns the event id if a model call was started, else null (rate limited / superseded). */
  handle(trigger: Trigger): string | null {
    if (this.inflight) {
      if (trigger.priority < this.inflight.priority) {
        this.inflight.controller.abort();
        this.sink.onCancelled(this.inflight.id);
        this.inflight = undefined;
      } else {
        return null;
      }
    }
    if (trigger.reason === "objection_detected") this.objectionsRaised += 1;

    const id = newId();
    const controller = new AbortController();
    this.inflight = { id, priority: trigger.priority, controller };
    const initialType: CoachEvent["type"] =
      trigger.reason === "objection_detected" ? "objection"
      : trigger.reason === "prospect_question" ? "question"
      : trigger.reason === "rep_monologue" ? "warning"
      : trigger.reason === "rep_ask" ? "answer"
      : "say_this";
    const createdAt = trigger.at;
    this.sink.onStart({ id, type: initialType, priority: trigger.priority, triggerSegmentId: trigger.segmentId, createdAt });

    const transcript = this.store.render({ maxChars: this.opts.transcriptChars ?? 6000, finalsOnly: true });
    const user = buildUserPrompt(transcript, trigger, this.store.metrics());

    void this.run(id, trigger, user, controller);
    return id;
  }

  private async run(id: string, trigger: Trigger, user: string, controller: AbortController): Promise<void> {
    const parser = new CoachStreamParser((field, text) => this.sink.onDelta(id, field, text));
    try {
      for await (const delta of this.model.stream({ system: this.system, user, signal: controller.signal })) {
        if (controller.signal.aborted) return;
        parser.push(delta);
      }
      if (controller.signal.aborted) return;
      const parsed = parser.finish();
      const event: CoachEvent = {
        id,
        type: parsed.type,
        priority: trigger.priority,
        headline: parsed.headline,
        script: parsed.script,
        rationale: parsed.rationale,
        stage: parsed.stage,
        triggerSegmentId: trigger.segmentId,
        createdAt: trigger.at,
      };
      this.sink.onDone(event);
    } catch (err) {
      if (controller.signal.aborted) return;
      this.sink.onError(id, err);
    } finally {
      if (this.inflight?.id === id) this.inflight = undefined;
    }
  }

  abort(): void {
    if (this.inflight) {
      this.inflight.controller.abort();
      this.sink.onCancelled(this.inflight.id);
      this.inflight = undefined;
    }
  }
}
