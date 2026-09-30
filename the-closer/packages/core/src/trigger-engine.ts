import { detectObjection, isQuestion, wordCount } from "./objections.js";
import type { TranscriptStore } from "./transcript-store.js";
import type { TranscriptSegment, Trigger } from "./types.js";

export interface TriggerEngineOptions {
  /** Minimum gap between model invocations for low-priority triggers. */
  minIntervalMs?: number;
  /** Silence after the prospect stops that should prompt the rep. */
  silenceMs?: number;
  /** Rep speaking continuously for longer than this gets a warning. */
  monologueMs?: number;
  /** Prospect utterances shorter than this do not, on their own, wake the model. */
  minProspectWords?: number;
  now?: () => number;
}

/**
 * Decides when the coach should think. Cheap, synchronous, fully testable.
 *
 * Priorities:
 *   1  objection detected, prospect question, rep asked directly  -> cancel in-flight, respond now
 *   2  prospect finished a substantive turn, silence               -> respond if not rate limited
 *   3  rep monologue / talk-ratio warnings                          -> background hint
 */
export class TriggerEngine {
  private readonly opts: Required<TriggerEngineOptions>;
  private lastFireAt = -Infinity;
  private lastProspectFinalAt = -Infinity;
  private silenceFiredFor?: string;
  private monologueWarnedAt = -Infinity;

  constructor(private readonly store: TranscriptStore, opts: TriggerEngineOptions = {}) {
    this.opts = {
      minIntervalMs: opts.minIntervalMs ?? 3000,
      silenceMs: opts.silenceMs ?? 5000,
      monologueMs: opts.monologueMs ?? 75_000,
      minProspectWords: opts.minProspectWords ?? 6,
      now: opts.now ?? (() => Date.now()),
    };
  }

  /** Call on every finalised segment. Returns a trigger or null. */
  onFinalSegment(seg: TranscriptSegment): Trigger | null {
    const now = this.opts.now();
    if (seg.speaker === "prospect") {
      this.lastProspectFinalAt = now;
      this.silenceFiredFor = undefined;

      const objection = detectObjection(seg.text);
      if (objection) return this.fire({ reason: "objection_detected", priority: 1, segmentId: seg.id, at: now });
      if (isQuestion(seg.text)) return this.fire({ reason: "prospect_question", priority: 1, segmentId: seg.id, at: now });
      if (wordCount(seg.text) >= this.opts.minProspectWords && this.rateOk(now)) {
        return this.fire({ reason: "prospect_finished", priority: 2, segmentId: seg.id, at: now });
      }
      return null;
    }

    if (seg.speaker === "rep") {
      const m = this.store.metrics();
      if (m.longestRepMonologueMs >= this.opts.monologueMs && now - this.monologueWarnedAt > this.opts.monologueMs) {
        this.monologueWarnedAt = now;
        return { reason: "rep_monologue", priority: 3, segmentId: seg.id, at: now };
      }
    }
    return null;
  }

  /** Call on a timer (e.g. every second). Fires once per silence window. */
  onTick(): Trigger | null {
    const now = this.opts.now();
    const lastProspect = this.store.lastFinalBy("prospect");
    if (!lastProspect) return null;
    const lastAny = this.store.last(1)[0];
    if (!lastAny || lastAny.id !== lastProspect.id) return null; // someone spoke since
    if (now - this.lastProspectFinalAt < this.opts.silenceMs) return null;
    if (this.silenceFiredFor === lastProspect.id) return null;
    this.silenceFiredFor = lastProspect.id;
    return this.fire({ reason: "silence", priority: 2, segmentId: lastProspect.id, at: now });
  }

  onRepAsk(question: string): Trigger {
    return this.fire({ reason: "rep_ask", priority: 1, question, at: this.opts.now() });
  }

  private rateOk(now: number): boolean {
    return now - this.lastFireAt >= this.opts.minIntervalMs;
  }

  private fire(t: Trigger): Trigger {
    this.lastFireAt = t.at;
    return t;
  }
}
