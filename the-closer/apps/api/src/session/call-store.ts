import type { CallContext, CoachEvent, Insight, TranscriptSegment } from "@closer/core";
import type { CallSummary } from "../coach/summary.js";

export type CallSource = "desktop" | "bot" | "fireflies" | "upload";

export interface CallRecord {
  id: string;
  orgId: string;
  /** The rep who owns the call. Managers and admins can see every call in the org. */
  userId?: string;
  crmRecordId?: string;
  title: string;
  source: CallSource;
  context: CallContext;
  startedAt: number;
  endedAt: number | null;
  transcript: TranscriptSegment[];
  events: CoachEvent[];
  insight: Insight | null;
  summary: CallSummary | null;
  /** e.g. Fireflies transcript id */
  externalId?: string;
}

export interface CallStore {
  upsert(rec: CallRecord): Promise<void>;
  get(orgId: string, id: string): Promise<CallRecord | null>;
  list(orgId: string): Promise<CallRecord[]>;
  delete(orgId: string, id: string): Promise<void>;
  /** Retention: removes calls that started before the cutoff. Returns how many went. */
  purgeOlderThan(orgId: string, cutoffMs: number): Promise<number>;
}

export class MemoryCallStore implements CallStore {
  private readonly rows = new Map<string, CallRecord>();
  async upsert(rec: CallRecord) { this.rows.set(rec.id, rec); }
  async get(orgId: string, id: string) { const r = this.rows.get(id); return r && r.orgId === orgId ? r : null; }
  async list(orgId: string) { return [...this.rows.values()].filter((r) => r.orgId === orgId).sort((a, b) => b.startedAt - a.startedAt); }
  async delete(orgId: string, id: string) { const r = this.rows.get(id); if (r && r.orgId === orgId) this.rows.delete(id); }
  async purgeOlderThan(orgId: string, cutoffMs: number) { let n = 0; for (const [id, r] of this.rows) if (r.orgId === orgId && r.startedAt < cutoffMs) { this.rows.delete(id); n++; } return n; }
}
