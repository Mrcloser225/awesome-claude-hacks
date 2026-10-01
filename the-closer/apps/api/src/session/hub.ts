import type { BotStatus, ServerMessage } from "@closer/core";
import type { EventBus } from "./bus.js";
import type { LiveSession } from "./live-session.js";

type Subscriber = (msg: ServerMessage) => void;

interface Entry {
  session: LiveSession;
  subscribers: Set<Subscriber>;
  bot: { botId: string; status: BotStatus; detail?: string } | null;
  orgId?: string;
}

/**
 * Registry of running calls. A call started by the desktop overlay has one
 * subscriber (its socket). A call driven by a meeting bot may have none at
 * first, then the rep attaches from the overlay, a Teams side panel or a
 * manager's dashboard; every subscriber gets the same live stream.
 */
export class SessionHub {
  private readonly byCall = new Map<string, Entry>();
  private readonly byBot = new Map<string, string>();
  /** Watchers of calls that live on another instance; events arrive over the bus. */
  private readonly remote = new Map<string, { subscribers: Set<Subscriber>; off: () => void }>();

  constructor(private readonly bus?: EventBus, readonly instanceId: string = `api_${Math.random().toString(36).slice(2, 8)}`) {}

  /** Creates the broadcaster a LiveSession should use as its `send`. */
  broadcaster(callId: string): (msg: ServerMessage) => void {
    return (msg) => {
      const e = this.byCall.get(callId);
      if (!e) return;
      for (const s of e.subscribers) {
        try { s(msg); } catch { /* a dead subscriber must not break the others */ }
      }
      void this.bus?.publishEvent(callId, msg);
    };
  }

  /** Attach to a call that another instance owns. Returns null when no instance owns it. */
  async attachRemote(callId: string, sub: Subscriber): Promise<(() => void) | null> {
    if (!this.bus) return null;
    const owner = await this.bus.ownerOf(callId);
    if (!owner || owner === this.instanceId) return null;
    let r = this.remote.get(callId);
    if (!r) {
      const subscribers = new Set<Subscriber>();
      const off = await this.bus.subscribeEvents(callId, (m) => { for (const s of subscribers) { try { s(m); } catch { /* ignore */ } } });
      r = { subscribers, off };
      this.remote.set(callId, r);
    }
    r.subscribers.add(sub);
    return () => { r!.subscribers.delete(sub); if (r!.subscribers.size === 0) { r!.off(); this.remote.delete(callId); } };
  }

  /** True when this instance owns the call, false when another does, null when nobody does. */
  async whereIs(callId: string): Promise<"here" | "elsewhere" | null> {
    if (this.byCall.has(callId)) return "here";
    const owner = await this.bus?.ownerOf(callId);
    return owner ? "elsewhere" : null;
  }

  /** Bot id to call id, including bots owned by other instances. */
  async callForBot(botId: string): Promise<string | null> {
    return this.byBot.get(botId) ?? (await this.bus?.getBotCall(botId)) ?? null;
  }

  register(session: LiveSession, opts: { botId?: string; orgId?: string } = {}): void {
    const entry: Entry = { session, subscribers: new Set(), bot: opts.botId ? { botId: opts.botId, status: "requested" } : null, orgId: opts.orgId };
    this.byCall.set(session.ctx.callId, entry);
    if (opts.botId) { this.byBot.set(opts.botId, session.ctx.callId); void this.bus?.setBotCall(opts.botId, session.ctx.callId); }
    void this.bus?.claimCall(session.ctx.callId, this.instanceId, 6 * 3600);
  }

  get(callId: string): LiveSession | undefined {
    return this.byCall.get(callId)?.session;
  }

  forBot(botId: string): LiveSession | undefined {
    const callId = this.byBot.get(botId);
    return callId ? this.get(callId) : undefined;
  }

  setBotStatus(botId: string, status: BotStatus, detail?: string): LiveSession | undefined {
    const callId = this.byBot.get(botId);
    const e = callId ? this.byCall.get(callId) : undefined;
    if (!e || !callId) return undefined;
    e.bot = { botId, status, detail };
    this.broadcaster(callId)({ type: "bot.status", botId, status, detail });
    return e.session;
  }

  /** Subscribe and immediately receive a snapshot so a late joiner sees the current state. Returns unsubscribe. */
  attach(callId: string, sub: Subscriber): (() => void) | null {
    const e = this.byCall.get(callId);
    if (!e) return null;
    e.subscribers.add(sub);
    const s = e.session;
    sub({
      type: "session.snapshot",
      callId,
      transcript: [...s.store.all()],
      events: [...s.events],
      insight: s.insight,
      metrics: s.metrics(),
      bot: e.bot,
    });
    return () => { e.subscribers.delete(sub); };
  }

  list(): Array<{ callId: string; bot: Entry["bot"]; subscribers: number; startedAt: number; orgId?: string }> {
    return [...this.byCall.entries()].map(([callId, e]) => ({ callId, bot: e.bot, subscribers: e.subscribers.size, startedAt: e.session.startedAt, orgId: e.orgId }));
  }

  orgOf(callId: string): string | undefined {
    return this.byCall.get(callId)?.orgId;
  }

  remove(callId: string): void {
    const e = this.byCall.get(callId);
    if (e?.bot) this.byBot.delete(e.bot.botId);
    this.byCall.delete(callId);
    void this.bus?.releaseCall(callId);
  }
}
