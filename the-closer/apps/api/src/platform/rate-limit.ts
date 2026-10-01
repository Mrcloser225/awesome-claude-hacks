/**
 * Per-key sliding-window limiter and per-org daily quotas. Memory version for
 * a single instance; the Redis version shares counters across instances.
 */
export interface RateLimiter {
  /** Returns true if the action is allowed, and consumes one unit. */
  take(key: string, limit: number, windowMs: number): Promise<boolean>;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly now: () => number = () => Date.now()) {}
  async take(key: string, limit: number, windowMs: number) {
    const t = this.now();
    const arr = (this.hits.get(key) ?? []).filter((x) => t - x < windowMs);
    if (arr.length >= limit) { this.hits.set(key, arr); return false; }
    arr.push(t);
    this.hits.set(key, arr);
    return true;
  }
}

export interface RedisLike { eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown> }

export class RedisRateLimiter implements RateLimiter {
  private static readonly SCRIPT = `
    local key = KEYS[1]; local now = tonumber(ARGV[1]); local window = tonumber(ARGV[2]); local limit = tonumber(ARGV[3])
    redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
    local n = redis.call('ZCARD', key)
    if n >= limit then return 0 end
    redis.call('ZADD', key, now, tostring(now) .. '-' .. tostring(math.random()))
    redis.call('PEXPIRE', key, window)
    return 1`;
  constructor(private readonly redis: RedisLike, private readonly now: () => number = () => Date.now()) {}
  async take(key: string, limit: number, windowMs: number) {
    return (await this.redis.eval(RedisRateLimiter.SCRIPT, 1, `rl:${key}`, this.now(), windowMs, limit)) === 1;
  }
}

/** Plan limits. Numbers are per org unless stated. */
export interface PlanLimits {
  coachCallsPerMinute: number;
  chatTurnsPerMinute: number;
  botsPerDay: number;
  /** Trial only: total calls before a plan is required. */
  trialCalls?: number;
}
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  trial: { coachCallsPerMinute: 20, chatTurnsPerMinute: 10, botsPerDay: 5, trialCalls: 5 },
  solo: { coachCallsPerMinute: 40, chatTurnsPerMinute: 30, botsPerDay: 20 },
  team: { coachCallsPerMinute: 200, chatTurnsPerMinute: 120, botsPerDay: 200 },
  enterprise: { coachCallsPerMinute: 1000, chatTurnsPerMinute: 600, botsPerDay: 2000 },
};
export function limitsFor(plan: string): PlanLimits { return PLAN_LIMITS[plan] ?? PLAN_LIMITS.trial!; }
