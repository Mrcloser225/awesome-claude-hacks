import {
  CoachEngine,
  TranscriptStore,
  TriggerEngine,
  type CallContext,
  type CoachEvent,
  type CoachModel,
  type Playbook,
  type ServerMessage,
  type TranscriptSegment,
} from "@closer/core";
import type { SttProvider } from "../stt/types.js";

export interface LiveSessionDeps {
  stt: SttProvider;
  model: CoachModel;
  playbook: Playbook;
  send: (msg: ServerMessage) => void;
  log?: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void };
  tickMs?: number;
}

/**
 * One live call: audio in, transcript + coach events out.
 * Owns the store, the trigger engine and the coach engine for the call.
 */
export class LiveSession {
  readonly store = new TranscriptStore();
  readonly events: CoachEvent[] = [];
  private readonly triggers: TriggerEngine;
  private readonly coach: CoachEngine;
  private tick?: NodeJS.Timeout;
  private metricsTick?: NodeJS.Timeout;
  private started = false;

  constructor(readonly ctx: CallContext, private readonly deps: LiveSessionDeps) {
    this.triggers = new TriggerEngine(this.store);
    this.coach = new CoachEngine(deps.model, this.store, deps.playbook, ctx, {
      onStart: (event) => deps.send({ type: "coach.start", event }),
      onDelta: (id, field, text) => deps.send({ type: "coach.delta", id, field, text }),
      onDone: (event) => {
        this.events.push(event);
        deps.send({ type: "coach.done", event });
      },
      onCancelled: (id) => deps.send({ type: "coach.cancelled", id }),
      onError: (id, err) => {
        deps.log?.error({ err, id }, "coach error");
        deps.send({ type: "error", code: "coach_failed", message: err instanceof Error ? err.message : String(err) });
      },
    });
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.deps.stt.start({
      onSegment: (seg) => this.ingest(seg),
      onError: (err) => {
        this.deps.log?.error({ err }, "stt error");
        this.deps.send({ type: "error", code: "stt_failed", message: err.message });
      },
      onClose: () => this.deps.log?.info({ callId: this.ctx.callId }, "stt closed"),
    });
    const tickMs = this.deps.tickMs ?? 1000;
    this.tick = setInterval(() => {
      const t = this.triggers.onTick();
      if (t) this.coach.handle(t);
    }, tickMs);
    this.metricsTick = setInterval(() => this.sendMetrics(), 5000);
    this.deps.send({ type: "session.ready", callId: this.ctx.callId });
  }

  /** Transcript from any source: Deepgram, a meeting bot, or a test. */
  ingest(seg: TranscriptSegment): void {
    this.store.upsert(seg);
    this.deps.send({ type: seg.isFinal ? "transcript.final" : "transcript.partial", segment: seg });
    if (seg.isFinal) {
      const t = this.triggers.onFinalSegment(seg);
      if (t) this.coach.handle(t);
    }
  }

  audio(frame: Buffer): void {
    this.deps.stt.sendAudio(frame);
  }

  ask(question: string): void {
    this.coach.handle(this.triggers.onRepAsk(question));
  }

  private sendMetrics(): void {
    const m = this.store.metrics();
    m.objectionsRaised = this.coach.objectionsRaised;
    this.deps.send({ type: "metrics", metrics: m });
  }

  async stop(): Promise<void> {
    if (this.tick) clearInterval(this.tick);
    if (this.metricsTick) clearInterval(this.metricsTick);
    this.coach.abort();
    await this.deps.stt.stop();
    this.sendMetrics();
  }
}
