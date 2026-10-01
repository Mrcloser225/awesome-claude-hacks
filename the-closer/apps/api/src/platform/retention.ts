import type { CallStore } from "../session/call-store.js";
import type { OrgStore } from "../org-store.js";

/** Nightly purge of calls older than each org's retention window. Orgs with retentionDays 0 keep everything. */
export class RetentionJob {
  private timer?: NodeJS.Timeout;
  constructor(private readonly d: { calls: CallStore; orgs: OrgStore; listOrgIds: () => Promise<string[]>; now?: () => number; log?: { info: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void }; onRun?: () => void }) {}
  start(intervalMs = 24 * 3600_000) { this.stop(); this.timer = setInterval(() => void this.run(), intervalMs); void this.run(); }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
  async run(): Promise<number> {
    let purged = 0;
    const now = this.d.now?.() ?? Date.now();
    for (const orgId of await this.d.listOrgIds()) {
      try {
        const org = await this.d.orgs.getOrg(orgId);
        if (!org || org.retentionDays <= 0) continue;
        const n = await this.d.calls.purgeOlderThan(orgId, now - org.retentionDays * 86_400_000);
        purged += n;
        if (n) this.d.log?.info({ orgId, purged: n, retentionDays: org.retentionDays }, "retention: purged calls");
      } catch (err) { this.d.log?.error({ err, orgId }, "retention: failed"); }
    }
    this.d.onRun?.();
    return purged;
  }
}
