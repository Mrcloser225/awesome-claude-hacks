import { buildInsightSystemPrompt, buildInsightUserPrompt } from "./prompt-builder.js";
import type { TranscriptStore } from "./transcript-store.js";
import type { CallContext, Insight, Playbook } from "./types.js";
import { newId } from "./coach-engine.js";

export type InsightDraft = Omit<Insight, "id" | "createdAt">;

/** A model that returns a structured read of the call. Implemented with Claude structured outputs in the API. */
export interface InsightModel {
  extract(req: { system: string; user: string; signal: AbortSignal }): Promise<InsightDraft>;
}

/**
 * Keeps the running picture of the deal: facts learned, questions answered,
 * questions still worth asking, prospect questions still owed an answer.
 * Runs off the critical path: it never delays a coach card.
 */
export class DiscoveryTracker {
  private readonly system: string;
  private current: Insight | null = null;
  private inflight?: AbortController;
  private prospectTurnsSinceRun = 0;
  private lastRunAt = -Infinity;

  constructor(
    private readonly model: InsightModel,
    private readonly store: TranscriptStore,
    playbook: Playbook,
    ctx: CallContext,
    private readonly onInsight: (insight: Insight) => void,
    private readonly opts: { everyProspectTurns?: number; minIntervalMs?: number; now?: () => number } = {},
  ) {
    this.system = buildInsightSystemPrompt(playbook, ctx);
  }

  get insight(): Insight | null {
    return this.current;
  }

  /** Call on each final prospect segment. Runs the model when enough has happened. */
  onProspectTurn(): void {
    this.prospectTurnsSinceRun += 1;
    const now = this.opts.now?.() ?? Date.now();
    if (this.prospectTurnsSinceRun >= (this.opts.everyProspectTurns ?? 3) && now - this.lastRunAt >= (this.opts.minIntervalMs ?? 20_000)) {
      void this.run();
    }
  }

  async run(): Promise<Insight | null> {
    if (this.inflight) return this.current;
    const controller = new AbortController();
    this.inflight = controller;
    this.prospectTurnsSinceRun = 0;
    this.lastRunAt = this.opts.now?.() ?? Date.now();
    try {
      const transcript = this.store.render({ maxChars: 40_000, finalsOnly: true });
      const draft = await this.model.extract({ system: this.system, user: buildInsightUserPrompt(transcript, this.current), signal: controller.signal });
      if (controller.signal.aborted) return this.current;
      const insight: Insight = { ...draft, id: newId("in"), createdAt: this.lastRunAt };
      this.current = insight;
      this.onInsight(insight);
      return insight;
    } catch {
      return this.current;
    } finally {
      if (this.inflight === controller) this.inflight = undefined;
    }
  }

  abort(): void {
    this.inflight?.abort();
    this.inflight = undefined;
  }
}
