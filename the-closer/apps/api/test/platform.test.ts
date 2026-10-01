import { describe, expect, it } from "vitest";
import { AesGcmCipher } from "../src/platform/crypto.js";
import { MemoryRateLimiter, RedisRateLimiter } from "../src/platform/rate-limit.js";
import { Metrics } from "../src/platform/metrics.js";
import { StripeClient, planFromPrice } from "../src/platform/stripe.js";
import { createHmac } from "node:crypto";
import { RetentionJob } from "../src/platform/retention.js";
import { MemoryCallStore } from "../src/session/call-store.js";
import { MemoryOrgStore } from "../src/org-store.js";

describe("AES-GCM cipher", () => {
  it("round-trips and rejects tampering, passes legacy plaintext through", () => {
    const c = new AesGcmCipher("a-long-enough-secret-key");
    const enc = c.encrypt("refresh-token-123");
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("refresh-token");
    expect(c.decrypt(enc)).toBe("refresh-token-123");
    expect(c.decrypt("plain-old-value")).toBe("plain-old-value");
    const tampered = "v1:" + Buffer.from(Buffer.from(enc.slice(3), "base64").map((b, i) => (i === 40 ? b ^ 1 : b))).toString("base64");
    expect(() => c.decrypt(tampered)).toThrow();
    expect(new AesGcmCipher("another-secret-key-xyz").decrypt.bind(null, enc)).toThrow();
  });
});

describe("rate limiter", () => {
  it("memory: allows up to the limit in a window and recovers", async () => {
    let now = 0;
    const rl = new MemoryRateLimiter(() => now);
    expect(await rl.take("k", 2, 1000)).toBe(true);
    expect(await rl.take("k", 2, 1000)).toBe(true);
    expect(await rl.take("k", 2, 1000)).toBe(false);
    now = 1001;
    expect(await rl.take("k", 2, 1000)).toBe(true);
  });
  it("redis: runs the sliding-window script", async () => {
    const calls: unknown[][] = [];
    let answer = 1;
    const rl = new RedisRateLimiter({ eval: async (...args) => { calls.push(args); return answer; } }, () => 5000);
    expect(await rl.take("org1", 10, 60_000)).toBe(true);
    expect(calls[0]!.slice(1)).toEqual([1, "rl:org1", 5000, 60_000, 10]);
    answer = 0;
    expect(await rl.take("org1", 10, 60_000)).toBe(false);
  });
});

describe("metrics and health", () => {
  it("renders counters, gauges and heartbeats, and flags stale jobs", () => {
    const m = new Metrics();
    m.inc("coach_calls", 3); m.gauge("live_calls", () => 2); m.beat("autojoin");
    const out = m.render();
    expect(out).toContain("closer_coach_calls 3");
    expect(out).toContain("closer_live_calls 2");
    expect(out).toMatch(/closer_job_last_run_seconds\{job="autojoin"\} \d+/);
    expect(m.stale({ autojoin: 60_000, retention: 60_000 })).toEqual(["retention"]);
    expect(m.stale({ autojoin: 60_000 }, Date.now() + 120_000)).toEqual(["autojoin"]);
  });
});

describe("Stripe", () => {
  const secret = "whsec_test";
  const sign = (body: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
  it("verifies webhook signatures and rejects bad or stale ones", () => {
    const s = new StripeClient({ secretKey: "sk", webhookSecret: secret });
    const body = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", data: { object: { id: "sub_1", customer: "cus_1", status: "active", items: { data: [{ price: { id: "price_team" }, quantity: 5 }] } } } });
    expect(s.verifyWebhook(body, sign(body)).type).toBe("customer.subscription.updated");
    expect(() => s.verifyWebhook(body, sign(body).replace(/v1=./, "v1=0"))).toThrow(/bad Stripe signature/);
    expect(() => s.verifyWebhook(body, sign(body, Math.floor(Date.now() / 1000) - 1000))).toThrow(/too old/);
    expect(() => s.verifyWebhook(body, undefined)).toThrow(/missing/);
    expect(planFromPrice("price_team", [{ id: "solo", priceId: "price_solo" }, { id: "team", priceId: "price_team" }])).toBe("team");
  });
  it("creates checkout sessions with seats and org reference", async () => {
    let sent: URLSearchParams | undefined;
    const s = new StripeClient({ secretKey: "sk", fetchImpl: async (url, init) => { expect(String(url)).toBe("https://api.stripe.com/v1/checkout/sessions"); sent = new URLSearchParams(String(init?.body)); return new Response(JSON.stringify({ url: "https://checkout.stripe.com/x" })); } });
    const r = await s.createCheckout({ priceId: "price_team", seats: 4, orgId: "org1", customerEmail: "jp@x.com", successUrl: "s", cancelUrl: "c" });
    expect(r.url).toContain("checkout.stripe.com");
    expect(sent!.get("line_items[0][quantity]")).toBe("4");
    expect(sent!.get("client_reference_id")).toBe("org1");
    expect(sent!.get("customer_email")).toBe("jp@x.com");
  });
});

describe("retention job", () => {
  it("purges only orgs with a retention window", async () => {
    const calls = new MemoryCallStore();
    const orgs = new MemoryOrgStore();
    orgs.ensureOrg("keep", "Keep"); await orgs.updateOrg("purge", { name: "Purge", retentionDays: 30 });
    const now = Date.now();
    const base = { source: "bot" as const, context: { callId: "x", rep: { name: "a", company: "b" } }, endedAt: null, transcript: [], events: [], insight: null, summary: null };
    await calls.upsert({ ...base, id: "old-keep", orgId: "keep", title: "t", startedAt: now - 100 * 86_400_000 });
    await calls.upsert({ ...base, id: "old-purge", orgId: "purge", title: "t", startedAt: now - 100 * 86_400_000 });
    await calls.upsert({ ...base, id: "new-purge", orgId: "purge", title: "t", startedAt: now - 2 * 86_400_000 });
    const job = new RetentionJob({ calls, orgs, listOrgIds: async () => ["keep", "purge"], now: () => now });
    expect(await job.run()).toBe(1);
    expect((await calls.list("keep")).length).toBe(1);
    expect((await calls.list("purge")).map((c) => c.id)).toEqual(["new-purge"]);
  });
});
