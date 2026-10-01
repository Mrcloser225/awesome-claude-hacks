/**
 * Process metrics in Prometheus text format at GET /metrics, plus a health
 * verdict that turns "degraded" when a background job stops running.
 */
export class Metrics {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, () => number>();
  private readonly heartbeats = new Map<string, number>();
  readonly startedAt = Date.now();

  inc(name: string, by = 1): void { this.counters.set(name, (this.counters.get(name) ?? 0) + by); }
  get(name: string): number { return this.counters.get(name) ?? 0; }
  gauge(name: string, read: () => number): void { this.gauges.set(name, read); }
  beat(job: string): void { this.heartbeats.set(job, Date.now()); }
  lastBeat(job: string): number | undefined { return this.heartbeats.get(job); }

  /** Jobs that must beat at least every maxAgeMs; returns the stale ones. */
  stale(expectations: Record<string, number>, now = Date.now()): string[] {
    return Object.entries(expectations).filter(([job, maxAge]) => { const b = this.heartbeats.get(job); return b === undefined || now - b > maxAge; }).map(([job]) => job);
  }

  render(): string {
    const lines: string[] = [];
    for (const [k, v] of this.counters) lines.push(`# TYPE closer_${k} counter`, `closer_${k} ${v}`);
    for (const [k, read] of this.gauges) lines.push(`# TYPE closer_${k} gauge`, `closer_${k} ${read()}`);
    for (const [k, v] of this.heartbeats) lines.push(`# TYPE closer_job_last_run_seconds gauge`, `closer_job_last_run_seconds{job="${k}"} ${Math.round(v / 1000)}`);
    lines.push(`# TYPE closer_uptime_seconds gauge`, `closer_uptime_seconds ${Math.round((Date.now() - this.startedAt) / 1000)}`);
    return lines.join("\n") + "\n";
  }
}

/** Ships errors to an HTTP sink (Sentry's store endpoint, a Slack webhook, or your own). Fire and forget. */
export class ErrorReporter {
  constructor(private readonly o: { webhookUrl?: string; service: string; fetchImpl?: typeof fetch; log?: (o: unknown, m?: string) => void }) {}
  report(err: unknown, context: Record<string, unknown> = {}): void {
    const e = err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : { message: String(err) };
    this.o.log?.({ err: e, ...context }, "error reported");
    if (!this.o.webhookUrl) return;
    const f = this.o.fetchImpl ?? fetch;
    void f(this.o.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: this.o.service, at: new Date().toISOString(), error: e, context, text: `[${this.o.service}] ${e.message}` }) }).catch(() => {});
  }
}
