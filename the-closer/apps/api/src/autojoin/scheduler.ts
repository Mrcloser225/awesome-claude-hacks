import type { CallContext } from "@closer/core";
import type { CalendarConnection, CalendarProvider, CalendarStore, MeetingEvent } from "./types.js";

export interface AutoJoinDeps {
  store: CalendarStore;
  providers: Partial<Record<CalendarConnection["provider"], CalendarProvider>>;
  /** Looks up the user behind a connection: name for attribution and bot naming, email domain for external-only. */
  userFor: (userId: string) => Promise<{ name: string; company: string; email?: string } | null>;
  /** Creates the call record, registers it with the hub, sends the bot. Returns the bot id. */
  startBot: (input: { orgId: string; userId: string; context: CallContext; meetingUrl: string; botName: string; joinAt: number; title: string }) => Promise<{ botId: string }>;
  now?: () => number;
  /** How far ahead to look for meetings. Bots are requested this far in advance so Recall has time to spin up. */
  lookaheadMs?: number;
  /** How early before the start the bot should be in the waiting room. */
  leadMs?: number;
  log?: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void };
}

/**
 * Fireflies-style auto-join. Every tick, for every connected calendar with
 * auto-join on, read the next window of meetings, and for each one with a
 * join link that has not been handled yet, request a bot timed to arrive
 * just before the start. Idempotent: an event key is recorded the moment a
 * bot is requested, so restarts and overlapping ticks never double-join.
 */
export class AutoJoinScheduler {
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private readonly d: AutoJoinDeps) {}

  start(intervalMs = 5 * 60_000): void {
    this.stop();
    this.timer = setInterval(() => void this.tick(), intervalMs);
    void this.tick();
  }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined; }

  async tick(): Promise<{ scheduled: number; skipped: number }> {
    if (this.running) return { scheduled: 0, skipped: 0 };
    this.running = true;
    let scheduled = 0, skipped = 0;
    try {
      for (const conn of await this.d.store.listAll()) {
        if (!conn.autoJoin) continue;
        try {
          const r = await this.processConnection(conn);
          scheduled += r.scheduled; skipped += r.skipped;
        } catch (err) {
          this.d.log?.error({ err, connectionId: conn.id }, "auto-join: connection failed");
        }
      }
    } finally { this.running = false; }
    return { scheduled, skipped };
  }

  /** Meetings the scheduler can see for one connection, with whether a bot is already booked. Used by the settings page. */
  async preview(conn: CalendarConnection, hours = 24): Promise<Array<MeetingEvent & { eligible: boolean; reason?: string; scheduled: boolean }>> {
    const { provider, token } = await this.ready(conn);
    const now = this.d.now?.() ?? Date.now();
    const events = await provider.listEvents(token, now - 5 * 60_000, now + hours * 3_600_000);
    const user = await this.d.userFor(conn.userId);
    const booked = new Set((await this.d.store.scheduledForConnection(conn.id)).map((s) => s.eventKey));
    return events.map((e) => { const el = this.eligibility(e, conn, user?.email); return { ...e, ...el, scheduled: booked.has(`${conn.id}:${e.id}`) }; });
  }

  private eligibility(e: MeetingEvent, conn: CalendarConnection, userEmail?: string): { eligible: boolean; reason?: string } {
    if (e.isCancelled) return { eligible: false, reason: "cancelled" };
    if (!e.joinUrl) return { eligible: false, reason: "no join link" };
    if (conn.externalOnly && userEmail) {
      const domain = userEmail.split("@")[1];
      const external = e.attendeeEmails.some((a) => a.split("@")[1] !== domain) || (e.organiserEmail ? e.organiserEmail.split("@")[1] !== domain : false);
      if (!external) return { eligible: false, reason: "internal meeting" };
    }
    return { eligible: true };
  }

  private async ready(conn: CalendarConnection): Promise<{ provider: CalendarProvider; token: string }> {
    const provider = this.d.providers[conn.provider];
    if (!provider) throw new Error(`no provider configured for ${conn.provider}`);
    const now = this.d.now?.() ?? Date.now();
    if (conn.expiresAt - now < 2 * 60_000 && conn.refreshToken) {
      const t = await provider.refresh(conn.refreshToken);
      conn.accessToken = t.accessToken; conn.expiresAt = t.expiresAt; if (t.refreshToken) conn.refreshToken = t.refreshToken;
      await this.d.store.save(conn);
    }
    return { provider, token: conn.accessToken };
  }

  private async processConnection(conn: CalendarConnection): Promise<{ scheduled: number; skipped: number }> {
    const { provider, token } = await this.ready(conn);
    const now = this.d.now?.() ?? Date.now();
    const lookahead = this.d.lookaheadMs ?? 20 * 60_000;
    const lead = this.d.leadMs ?? 60_000;
    const user = await this.d.userFor(conn.userId);
    if (!user) return { scheduled: 0, skipped: 0 };
    const events = await provider.listEvents(token, now - 5 * 60_000, now + lookahead);
    let scheduled = 0, skipped = 0;
    for (const e of events) {
      const key = `${conn.id}:${e.id}`;
      if (e.endsAt < now) continue;
      if (await this.d.store.isScheduled(key)) { skipped++; continue; }
      const el = this.eligibility(e, conn, user.email);
      if (!el.eligible || !e.joinUrl) { skipped++; continue; }
      const joinAt = Math.max(now, e.startsAt - lead);
      const callId = `cal_${conn.provider}_${e.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40)}_${e.startsAt.toString(36)}`;
      const external = e.attendeeEmails.find((a) => user.email && a.split("@")[1] !== user.email.split("@")[1]);
      const context: CallContext = {
        callId,
        rep: { name: user.name, company: user.company },
        prospect: external ? { name: external.split("@")[0]?.replace(/[._]/g, " "), company: external.split("@")[1]?.split(".")[0] } : undefined,
        briefing: `Calendar event: ${e.title}. Attendees: ${e.attendeeEmails.join(", ") || "unknown"}.`,
      };
      try {
        const { botId } = await this.d.startBot({ orgId: conn.orgId, userId: conn.userId, context, meetingUrl: e.joinUrl, botName: conn.botName ?? `${user.name} (notes)`, joinAt, title: e.title });
        await this.d.store.markScheduled({ eventKey: key, connectionId: conn.id, callId, botId, joinAt });
        scheduled++;
        this.d.log?.info({ callId, botId, title: e.title, joinAt: new Date(joinAt).toISOString() }, "auto-join: bot booked");
      } catch (err) {
        this.d.log?.error({ err, event: e.title }, "auto-join: could not book bot");
      }
    }
    return { scheduled, skipped };
  }
}
