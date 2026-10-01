import type { ServerMessage, TranscriptSegment } from "@closer/core";

/**
 * Cross-instance event bus. With one API process the memory bus is a no-op
 * passthrough. With several, the Redis bus carries two things between them:
 *   - call events, so a watcher attached to instance B sees a call owned by A
 *   - inbound transcript for a bot-owned call, so a Recall webhook that lands
 *     on B is delivered to the instance that owns the session on A
 */
export interface EventBus {
  publishEvent(callId: string, msg: ServerMessage): Promise<void>;
  subscribeEvents(callId: string, handler: (msg: ServerMessage) => void): Promise<() => void>;
  /** Claims ownership of a call for this instance; returns false if another instance already owns it. */
  claimCall(callId: string, instanceId: string, ttlSec: number): Promise<boolean>;
  releaseCall(callId: string): Promise<void>;
  ownerOf(callId: string): Promise<string | null>;
  /** Routing table for bot ids to call ids, shared across instances. */
  setBotCall(botId: string, callId: string): Promise<void>;
  getBotCall(botId: string): Promise<string | null>;
  forwardIngest(callId: string, seg: TranscriptSegment): Promise<void>;
  onIngest(instanceId: string, handler: (callId: string, seg: TranscriptSegment) => void): Promise<() => void>;
  close(): Promise<void>;
}

export class MemoryBus implements EventBus {
  private readonly owners = new Map<string, string>();
  private readonly bots = new Map<string, string>();
  async publishEvent() {}
  async subscribeEvents() { return () => {}; }
  async claimCall(callId: string, instanceId: string) { const o = this.owners.get(callId); if (o && o !== instanceId) return false; this.owners.set(callId, instanceId); return true; }
  async releaseCall(callId: string) { this.owners.delete(callId); }
  async ownerOf(callId: string) { return this.owners.get(callId) ?? null; }
  async setBotCall(botId: string, callId: string) { this.bots.set(botId, callId); }
  async getBotCall(botId: string) { return this.bots.get(botId) ?? null; }
  async forwardIngest() {}
  async onIngest() { return () => {}; }
  async close() {}
}

/** Minimal surface of ioredis we use, so tests can stub it and the import stays optional. */
export interface RedisClient {
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(event: "message", handler: (channel: string, message: string) => void): unknown;
  set(key: string, value: string, mode: "EX", ttl: number, flag: "NX"): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
  expire(key: string, ttl: number): Promise<unknown>;
  quit(): Promise<unknown>;
  duplicate(): RedisClient;
}

export class RedisBus implements EventBus {
  private readonly sub: RedisClient;
  private readonly handlers = new Map<string, Set<(msg: string) => void>>();
  private closed = false;
  constructor(private readonly pub: RedisClient, private readonly prefix = "closer") {
    this.sub = pub.duplicate();
    this.sub.on("message", (channel, message) => { for (const h of this.handlers.get(channel) ?? []) h(message); });
  }
  private ch(kind: string, id: string) { return `${this.prefix}:${kind}:${id}`; }
  private async listen(channel: string, h: (m: string) => void) {
    let set = this.handlers.get(channel);
    if (!set) { set = new Set(); this.handlers.set(channel, set); await this.sub.subscribe(channel); }
    set.add(h);
    return async () => { set!.delete(h); if (set!.size === 0) { this.handlers.delete(channel); if (!this.closed) await this.sub.unsubscribe(channel).catch(() => {}); } };
  }
  async publishEvent(callId: string, msg: ServerMessage) { if (this.closed) return; await this.pub.publish(this.ch("ev", callId), JSON.stringify(msg)).catch(() => {}); }
  async subscribeEvents(callId: string, handler: (msg: ServerMessage) => void) { const off = await this.listen(this.ch("ev", callId), (m) => handler(JSON.parse(m) as ServerMessage)); return () => { void off(); }; }
  async claimCall(callId: string, instanceId: string, ttlSec: number) {
    const r = await this.pub.set(this.ch("owner", callId), instanceId, "EX", ttlSec, "NX");
    if (r === "OK") return true;
    return (await this.pub.get(this.ch("owner", callId))) === instanceId && (await this.pub.expire(this.ch("owner", callId), ttlSec), true);
  }
  async releaseCall(callId: string) { if (this.closed) return; await this.pub.del(this.ch("owner", callId)).catch(() => {}); }
  async ownerOf(callId: string) { return this.pub.get(this.ch("owner", callId)); }
  async setBotCall(botId: string, callId: string) { await this.pub.set(this.ch("bot", botId), callId, "EX", 24 * 3600, "NX"); }
  async getBotCall(botId: string) { return this.pub.get(this.ch("bot", botId)); }
  async forwardIngest(callId: string, seg: TranscriptSegment) {
    const owner = await this.ownerOf(callId);
    if (!owner) return;
    await this.pub.publish(this.ch("ingest", owner), JSON.stringify({ callId, seg }));
  }
  async onIngest(instanceId: string, handler: (callId: string, seg: TranscriptSegment) => void) {
    const off = await this.listen(this.ch("ingest", instanceId), (m) => { const { callId, seg } = JSON.parse(m) as { callId: string; seg: TranscriptSegment }; handler(callId, seg); });
    return () => { void off(); };
  }
  async close() { if (this.closed) return; this.closed = true; await this.sub.quit().catch(() => {}); await this.pub.quit().catch(() => {}); }
}
