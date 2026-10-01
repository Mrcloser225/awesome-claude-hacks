import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CoachModel } from "@closer/core";
import { buildApp } from "../src/app.js";
import { NoopStt } from "../src/stt/none.js";
import { ConsoleMailer } from "../src/platform/mailer.js";
import { StripeClient } from "../src/platform/stripe.js";
import { createHmac } from "node:crypto";
import type { CrmOAuth } from "../src/crm/types.js";

const coach: CoachModel = { async *stream() { yield "TYPE: say_this\nHEADLINE: x\nSAY:\ny\nWHY: z\n"; } };
const mailer = new ConsoleMailer(() => {});
const linkFrom = (i = -1) => /https?:\/\/\S+/.exec(mailer.sent.at(i)!.text)![0];
const tokenFrom = (link: string) => new URL(link).searchParams.get("token")!;
const whsec = "whsec_t";
const sign = (body: string) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${createHmac("sha256", whsec).update(`${t}.${body}`).digest("hex")}`; };

const crmCalls: unknown[] = [];
const fakeCrm: CrmOAuth = {
  provider: "hubspot",
  authorizeUrl: (s) => `https://hubspot.fake/auth?state=${s}`,
  exchangeCode: async () => ({ accessToken: "hs-at", refreshToken: "hs-rt", expiresAt: Date.now() + 3_600_000 }),
  refresh: async () => ({ accessToken: "hs-at2", expiresAt: Date.now() + 3_600_000 }),
  adapter: () => ({ logCall: async (i) => { crmCalls.push(i); return { id: "call-999" }; } }),
};

let app: Awaited<ReturnType<typeof buildApp>>["app"];
let built: Awaited<ReturnType<typeof buildApp>>;
beforeAll(async () => {
  built = await buildApp({
    makeStt: () => new NoopStt(), model: coach, mailer, webUrl: "https://thecloser.ai",
    stripe: new StripeClient({ secretKey: "sk", webhookSecret: whsec, fetchImpl: async () => new Response(JSON.stringify({ url: "https://checkout.stripe.com/s" })) }),
    stripePlans: [{ id: "solo", priceId: "price_solo" }, { id: "team", priceId: "price_team" }],
    crmProviders: { hubspot: fakeCrm },
    createBot: async () => ({ botId: `bot-${Math.random().toString(36).slice(2)}` }),
    summarise: async () => ({ outcome: "advanced", oneLine: "Good call", prospectPains: [], objectionsRaised: [], commitments: [], nextStep: "Proposal", dealStage: "pricing", coachingNotes: [], crmNote: "note", followUpEmail: { subject: "s", body: "b" } }),
  });
  app = built.app;
});
afterAll(async () => { await app.close(); });

const json = (res: { json: () => unknown }) => res.json() as Record<string, unknown>;

describe("accounts, team, roles", () => {
  let admin = ""; let adminId = "";
  it("signup sends a verification email; the link verifies the account", async () => {
    const r = await app.inject({ method: "POST", url: "/v1/auth/signup", payload: { email: "jp@glaxtons.co.uk", password: "password123", name: "JP Olivier", company: "Glaxtons" } });
    expect(r.statusCode).toBe(201);
    admin = r.headers["set-cookie"] as string;
    adminId = (json(r).user as { id: string }).id;
    expect(mailer.sent.at(-1)!.subject).toMatch(/Confirm your email/);
    const v = await app.inject({ method: "POST", url: "/v1/auth/verify", payload: { token: tokenFrom(linkFrom()) } });
    expect(v.statusCode).toBe(200);
    const again = await app.inject({ method: "POST", url: "/v1/auth/verify", payload: { token: tokenFrom(linkFrom()) } });
    expect(again.statusCode).toBe(400); // single use
    const members = await app.inject({ method: "GET", url: "/v1/org/members", headers: { cookie: admin } });
    expect(json(members as never)).toBeTruthy();
    expect((members.json() as Array<{ role: string; emailVerifiedAt?: number }>)[0]).toMatchObject({ role: "admin", emailVerifiedAt: expect.any(Number) });
  });

  it("password reset: forgot never leaks, reset works once", async () => {
    const before = mailer.sent.length;
    await app.inject({ method: "POST", url: "/v1/auth/forgot", payload: { email: "nobody@nowhere.com" } });
    expect(mailer.sent.length).toBe(before);
    await app.inject({ method: "POST", url: "/v1/auth/forgot", payload: { email: "JP@glaxtons.co.uk" } });
    expect(mailer.sent.length).toBe(before + 1);
    const token = tokenFrom(linkFrom());
    const bad = await app.inject({ method: "POST", url: "/v1/auth/reset", payload: { token, password: "short" } });
    expect(bad.statusCode).toBe(400);
    const ok = await app.inject({ method: "POST", url: "/v1/auth/reset", payload: { token, password: "new-password-456" } });
    expect(ok.statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "jp@glaxtons.co.uk", password: "password123" } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "jp@glaxtons.co.uk", password: "new-password-456" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/v1/auth/reset", payload: { token, password: "another-pass-789" } })).statusCode).toBe(400);
  });

  let rep = "";
  it("invites need a seat; after upgrading, a rep joins with the invited role and sees only their own calls", async () => {
    const noSeat = await app.inject({ method: "POST", url: "/v1/org/invites", headers: { cookie: admin }, payload: { email: "emma@glaxtons.co.uk", role: "rep" } });
    expect(noSeat.statusCode).toBe(402);

    // Stripe says: team plan, 5 seats.
    const org = json(await app.inject({ method: "GET", url: "/v1/org", headers: { cookie: admin } })).org as { id: string };
    const body = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", data: { object: { id: "sub_1", customer: "cus_1", status: "active", metadata: { orgId: org.id }, items: { data: [{ price: { id: "price_team" }, quantity: 5 }] } } } });
    const wh = await app.inject({ method: "POST", url: "/v1/webhooks/stripe", headers: { "stripe-signature": sign(body), "content-type": "application/json" }, payload: body });
    expect(wh.statusCode).toBe(200);
    expect(json(await app.inject({ method: "GET", url: "/v1/billing", headers: { cookie: admin } }))).toMatchObject({ plan: "team", seats: 5, hasSubscription: true });
    const forged = await app.inject({ method: "POST", url: "/v1/webhooks/stripe", headers: { "stripe-signature": "t=1,v1=00", "content-type": "application/json" }, payload: body });
    expect(forged.statusCode).toBe(400);

    const inv = await app.inject({ method: "POST", url: "/v1/org/invites", headers: { cookie: admin }, payload: { email: "emma@glaxtons.co.uk", role: "rep" } });
    expect(inv.statusCode).toBe(201);
    const token = tokenFrom(linkFrom());
    expect(json(await app.inject({ method: "GET", url: `/v1/auth/invite?token=${token}` }))).toMatchObject({ email: "emma@glaxtons.co.uk", role: "rep", company: "Glaxtons" });
    const acc = await app.inject({ method: "POST", url: "/v1/auth/accept-invite", payload: { token, name: "Emma Ballentine", password: "emma-password-1" } });
    expect(acc.statusCode).toBe(201);
    rep = `closer_session=${encodeURIComponent((json(acc).token as string))}`;
    expect((json(acc).user as { role: string; orgId: string })).toMatchObject({ role: "rep", orgId: org.id });

    // Admin starts a call; the rep cannot see it, the admin can.
    const bot = await app.inject({ method: "POST", url: "/v1/bots", headers: { cookie: admin }, payload: { meetingUrl: "https://teams.microsoft.com/l/x", context: { callId: "admin-call", rep: { name: "JP", company: "Glaxtons" } } } });
    expect(bot.statusCode).toBe(201);
    expect((await app.inject({ method: "GET", url: "/v1/calls/admin-call", headers: { cookie: rep } })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/v1/calls/admin-call", headers: { cookie: admin } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/calls", headers: { cookie: rep } })).json()).toEqual([]);

    // Rep cannot invite or mint keys; admin promotes them to manager and then they see the org's calls.
    expect((await app.inject({ method: "POST", url: "/v1/org/invites", headers: { cookie: rep }, payload: { email: "x@y.com" } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/v1/org/api-keys", headers: { cookie: rep }, payload: {} })).statusCode).toBe(403);
    const members = (await app.inject({ method: "GET", url: "/v1/org/members", headers: { cookie: admin } })).json() as Array<{ id: string; email: string }>;
    const emma = members.find((m) => m.email === "emma@glaxtons.co.uk")!;
    expect((await app.inject({ method: "PATCH", url: `/v1/org/members/${emma.id}`, headers: { cookie: admin }, payload: { role: "manager" } })).statusCode).toBe(200);
    expect(((await app.inject({ method: "GET", url: "/v1/calls", headers: { cookie: rep } })).json() as unknown[]).length).toBe(1);
    expect((await app.inject({ method: "PATCH", url: `/v1/org/members/${adminId}`, headers: { cookie: admin }, payload: { role: "rep" } })).statusCode).toBe(400);
  });

  it("API keys authenticate as Bearer and can be revoked", async () => {
    const mint = await app.inject({ method: "POST", url: "/v1/org/api-keys", headers: { cookie: admin }, payload: { label: "desktop" } });
    expect(mint.statusCode).toBe(201);
    const { id, key } = json(mint) as { id: string; key: string };
    expect(key.startsWith("ck_")).toBe(true);
    const me = await app.inject({ method: "GET", url: "/v1/auth/me", headers: { authorization: `Bearer ${key}` } });
    expect(json(me).user).toMatchObject({ company: "Glaxtons", role: "admin", apiKeyId: key.slice(0, 10) });
    const list = (await app.inject({ method: "GET", url: "/v1/org/api-keys", headers: { cookie: admin } })).json() as Array<{ id: string; keyHash?: string }>;
    expect(list[0]!.keyHash).toBeUndefined();
    await app.inject({ method: "DELETE", url: `/v1/org/api-keys/${id}`, headers: { cookie: admin } });
    expect((await app.inject({ method: "GET", url: "/v1/auth/me", headers: { authorization: `Bearer ${key}` } })).statusCode).toBe(401);
  });

  it("quotas: trial orgs stop after their free calls; chat is rate limited", async () => {
    const r = await app.inject({ method: "POST", url: "/v1/auth/signup", payload: { email: "trial@x.com", password: "password123", name: "T", company: "Trial Co" } });
    const c = r.headers["set-cookie"] as string;
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const b = await app.inject({ method: "POST", url: "/v1/bots", headers: { cookie: c }, payload: { meetingUrl: "https://zoom.us/j/1", context: { callId: `t-${i}`, rep: { name: "T", company: "Trial Co" } } } });
      last = b.statusCode;
    }
    expect(last).toBe(402);
    const usage = json(await app.inject({ method: "GET", url: "/v1/org/usage", headers: { cookie: c } }));
    expect(usage.bots).toBe(5);
    expect((await app.inject({ method: "GET", url: "/v1/billing", headers: { cookie: c } })).json()).toMatchObject({ plan: "trial", trialCallsUsed: 5 });
  });

  it("billing checkout and CRM connect need admin; CRM push after summary logs the call", async () => {
    expect((await app.inject({ method: "POST", url: "/v1/billing/checkout", headers: { cookie: rep }, payload: { plan: "team", seats: 3 } })).statusCode).toBe(403);
    const co = await app.inject({ method: "POST", url: "/v1/billing/checkout", headers: { cookie: admin }, payload: { plan: "team", seats: 3 } });
    expect(json(co).url).toContain("checkout.stripe.com");

    const connect = json(await app.inject({ method: "GET", url: "/v1/integrations/crm/hubspot/connect", headers: { cookie: admin } }));
    const state = new URL(connect.url as string).searchParams.get("state")!;
    const cb = await app.inject({ method: "GET", url: `/v1/integrations/crm/hubspot/callback?code=c&state=${state}` });
    expect(cb.headers.location).toBe("https://thecloser.ai/app/settings?crm=connected:hubspot");
    const crm = (await app.inject({ method: "GET", url: "/v1/integrations/crm", headers: { cookie: admin } })).json() as Array<{ provider: string; autoPush: boolean; accessToken?: string }>;
    expect(crm[0]).toMatchObject({ provider: "hubspot", autoPush: true });
    expect(crm[0]!.accessToken).toBeUndefined();

    // End the admin call (webhook) then summarise: the hook pushes to HubSpot.
    const botId = (built.hub.list().find((l) => l.callId === "admin-call")!.bot!).botId;
    await app.inject({ method: "POST", url: "/v1/webhooks/recall", payload: { event: "transcript.data", data: { bot: { id: botId, metadata: { repName: "JP" } }, data: { participant: { name: "Sam" }, words: [{ text: "hello", start_timestamp: { relative: 1 }, end_timestamp: { relative: 2 } }] } } } });
    await app.inject({ method: "POST", url: "/v1/webhooks/recall", payload: { event: "bot.done", data: { bot: { id: botId }, data: { code: "done" } } } });
    const sum = await app.inject({ method: "POST", url: "/v1/calls/admin-call/summary", headers: { cookie: admin } });
    expect(sum.statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 20));
    expect(crmCalls).toHaveLength(1);
    expect(crmCalls[0]).toMatchObject({ callId: "admin-call", summary: { outcome: "advanced" } });
    expect(json(await app.inject({ method: "GET", url: "/v1/calls/admin-call", headers: { cookie: admin } })).crmRecordId).toBe("call-999");
    const manual = await app.inject({ method: "POST", url: "/v1/calls/admin-call/crm", headers: { cookie: admin }, payload: { provider: "hubspot" } });
    expect(json(manual).pushed).toEqual([{ provider: "hubspot", id: "call-999" }]);
  });

  it("export and delete the organisation", async () => {
    const exp = await app.inject({ method: "GET", url: "/v1/org/export", headers: { cookie: admin } });
    expect(exp.statusCode).toBe(200);
    expect((json(exp).calls as unknown[]).length).toBe(1);
    expect((json(exp).members as unknown[]).length).toBe(2);
    expect((await app.inject({ method: "DELETE", url: "/v1/calls/admin-call", headers: { cookie: admin } })).statusCode).toBe(204);
    expect((await app.inject({ method: "DELETE", url: "/v1/org", headers: { cookie: admin }, payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: "DELETE", url: "/v1/org", headers: { cookie: admin }, payload: { confirm: "DELETE" } })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/v1/auth/me", headers: { cookie: admin } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "emma@glaxtons.co.uk", password: "emma-password-1" } })).statusCode).toBe(401);
  });

  it("exposes metrics and a health verdict", async () => {
    const m = await app.inject({ method: "GET", url: "/metrics" });
    expect(m.body).toContain("closer_live_calls");
    expect(m.body).toContain("closer_coach_calls");
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
  });
});
