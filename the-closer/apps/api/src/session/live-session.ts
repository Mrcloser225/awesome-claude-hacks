import {
  CoachEngine,
  DiscoveryTracker,
  TranscriptStore,
  TriggerEngine,
  type CallContext,
  type CallMetrics,
  type CoachEvent,
  type CoachModel,
  type Insight,
  type InsightModel,
  type KnowledgeDoc,
  type Playbook,
  type ServerMessage,
  type TranscriptSegment,
} from "@closer/core";
import type { SttProvider } from "../stt/types.js";

export interface LiveSessionDeps {
  stt: SttProvider;
  model: CoachModel;
  /** Optional: without it the call still gets coach cards, just no running deal picture. */
  insightModel?: InsightModel;
  playbook: Playbook;
  knowledge?: KnowledgeDoc[];
  send: (msg: ServerMessage) => void;
  log?: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void };
  tickMs?: number;
}

/**
 * One live call: transcript in (from audio or a meeting bot), coach events and
 * insights out. Owns the store, trigger engine, coach engine and discovery
 * tracker for the call. Source-agnostic: `ingest()` is the only entry point
 * for words, whoever heard them.
 */
export class LiveSession {
  readonly store = new TranscriptStore();
  readonly events: CoachEvent[] = [];
  readonly startedAt = Date.now();
  private readonly triggers: TriggerEngine;
  private readonly coach: CoachEngine;
  private readonly tracker?: DiscoveryTracker;
  private tick?: NodeJS.Timeout;
  private metricsTick?: NodeJS.Timeout;
  private started = false;
  private stopped = false;

  constructor(readonly ctx: CallContext, private readonly deps: LiveSessionDeps) {
    this.triggers = new TriggerEngine(this.store);
    if (deps.insightModel) {
      this.tracker = new DiscoveryTracker(deps.insightModel, this.store, deps.playbook, ctx, (insight) => deps.send({ type: "insight", insight }));
    }
    this.coach = new CoachEngine(
      deps.model,
      this.store,
      deps.playbook,
      ctx,
      {
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
      },
      { knowledge: deps.knowledge, insight: () => this.tracker?.insight ?? null },
    );
  }

  get insight(): Insight | null {
    return this.tracker?.insight ?? null;
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
    if (this.stopped) return;
    this.store.upsert(seg);
    this.deps.send({ type: seg.isFinal ? "transcript.final" : "transcript.partial", segment: seg });
    if (seg.isFinal) {
      const t = this.triggers.onFinalSegment(seg);
      if (t) this.coach.handle(t);
      if (seg.speaker === "prospect") this.tracker?.onProspectTurn();
    }
  }

  audio(frame: Buffer): void {
    this.deps.stt.sendAudio(frame);
  }

  ask(question: string): void {
    this.coach.handle(this.triggers.onRepAsk(question));
  }

  /** Force a fresh deal picture now (e.g. the rep pressed "where are we?"). */
  refreshInsight(): Promise<Insight | null> {
    return this.tracker?.run() ?? Promise.resolve(null);
  }

  metrics(): CallMetrics {
    const m = this.store.metrics();
    m.objectionsRaised = this.coach.objectionsRaised;
    return m;
  }

  private sendMetrics(): void {
    this.deps.send({ type: "metrics", metrics: this.metrics() });
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    if (this.tick) clearInterval(this.tick);
    if (this.metricsTick) clearInterval(this.metricsTick);
    this.coach.abort();
    this.tracker?.abort();
    await this.deps.stt.stop();
    this.sendMetrics();
  }
}
