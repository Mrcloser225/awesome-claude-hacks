import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { hashKey, hashPassword, type JwtAuth, type Principal, type UserStore } from "../auth.js";
import type { OrgStore, Role } from "../org-store.js";
import { randomToken, sha256 } from "../platform/crypto.js";
import { templates, type Mailer } from "../platform/mailer.js";
import type { CallStore } from "../session/call-store.js";
import type { KnowledgeStore, PlaybookStore } from "../stores.js";
import type { CalendarStore } from "../autojoin/types.js";

export interface AccountDeps {
  users: UserStore;
  orgs: OrgStore;
  calls: CallStore;
  knowledge: KnowledgeStore;
  playbooks: PlaybookStore;
  calendars: CalendarStore;
  mailer: Mailer;
  jwt: JwtAuth;
  webUrl: string;
  now?: () => number;
}

type Authed = { principal: Principal };
const p = (req: unknown) => (req as Authed).principal;
const ROLES: Role[] = ["rep", "manager", "admin"];
const can = (role: Role, min: Role) => ROLES.indexOf(role) >= ROLES.indexOf(min);

export function forbid(reply: FastifyReply, what = "admin") { return reply.code(403).send({ error: `This needs ${what} access` }); }

/** Mints a one-time token, stores its hash, returns the link to put in an email. */
export async function issueToken(d: Pick<AccountDeps, "orgs" | "webUrl" | "now">, t: { orgId: string; userId?: string; email: string; kind: "verify" | "reset" | "invite"; role?: Role; ttlMs: number }): Promise<string> {
  const raw = randomToken();
  await d.orgs.createToken({ id: randomUUID(), orgId: t.orgId, userId: t.userId, email: t.email.toLowerCase(), kind: t.kind, role: t.role, tokenHash: sha256(raw), expiresAt: (d.now?.() ?? Date.now()) + t.ttlMs });
  const path = t.kind === "verify" ? "verify" : t.kind === "reset" ? "reset" : "invite";
  return `${d.webUrl}/${path}?token=${raw}`;
}

export function registerAccountRoutes(app: FastifyInstance, d: AccountDeps): void {
  const now = () => d.now?.() ?? Date.now();
  const validToken = async (raw: string, kind: "verify" | "reset" | "invite") => {
    const t = await d.orgs.findToken(sha256(raw));
    if (!t || t.kind !== kind || t.usedAt || t.expiresAt < now()) return null;
    return t;
  };

  // ---- Email verification ----
  app.post("/v1/auth/verify", async (req, reply) => {
    const body = z.object({ token: z.string().min(10) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "token required" });
    const t = await validToken(body.data.token, "verify");
    if (!t || !t.userId) return reply.code(400).send({ error: "This link is invalid or has expired" });
    await d.orgs.markVerified(t.userId, now());
    await d.orgs.consumeToken(t.id, now());
    return { ok: true };
  });
  app.post("/v1/auth/resend-verification", async (req) => {
    const me = p(req);
    if (!me.email) return { ok: true };
    const link = await issueToken(d, { orgId: me.orgId, userId: me.userId, email: me.email, kind: "verify", ttlMs: 24 * 3600_000 });
    await d.mailer.send({ to: me.email, ...templates.verify(link) });
    return { ok: true };
  });

  // ---- Password reset. Always 200 so the endpoint does not reveal which emails exist. ----
  app.post("/v1/auth/forgot", async (req, reply) => {
    const body = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "email required" });
    const user = await d.users.findByEmail(body.data.email);
    if (user) {
      const link = await issueToken(d, { orgId: user.orgId, userId: user.id, email: user.email, kind: "reset", ttlMs: 3600_000 });
      await d.mailer.send({ to: user.email, ...templates.reset(link) });
    }
    return { ok: true };
  });
  app.post("/v1/auth/reset", async (req, reply) => {
    const body = z.object({ token: z.string().min(10), password: z.string().min(8).max(200) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const t = await validToken(body.data.token, "reset");
    if (!t || !t.userId) return reply.code(400).send({ error: "This link is invalid or has expired" });
    await d.orgs.setPassword(t.userId, hashPassword(body.data.password));
    await d.orgs.consumeToken(t.id, now());
    return { ok: true };
  });

  // ---- Team: invitations, members, roles ----
  app.get("/v1/org", async (req) => {
    const me = p(req);
    const org = await d.orgs.getOrg(me.orgId);
    return { org, me: { id: me.userId, role: me.role, email: me.email } };
  });
  app.patch("/v1/org", async (req, reply) => {
    const me = p(req);
    if (!can(me.role, "admin")) return forbid(reply);
    const body = z.object({ name: z.string().min(1).max(160).optional(), retentionDays: z.number().int().min(0).max(3650).optional(), disclosure: z.enum(["chat_message", "name_only", "off"]).optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    return d.orgs.updateOrg(me.orgId, body.data);
  });
  app.get("/v1/org/members", async (req) => d.orgs.listMembers(p(req).orgId));
  app.post("/v1/org/invites", async (req, reply) => {
    const me = p(req);
    if (!can(me.role, "manager")) return forbid(reply, "manager");
    const body = z.object({ email: z.string().email(), role: z.enum(["rep", "manager", "admin"]).default("rep") }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    if (body.data.role === "admin" && !can(me.role, "admin")) return forbid(reply);
    const org = await d.orgs.getOrg(me.orgId);
    const members = await d.orgs.listMembers(me.orgId);
    if (org && members.length >= org.seats) return reply.code(402).send({ error: `Your plan has ${org.seats} seat${org.seats === 1 ? "" : "s"}. Add seats under Billing to invite more people.` });
    if (await d.users.findByEmail(body.data.email)) return reply.code(409).send({ error: "That email already has an account" });
    const link = await issueToken(d, { orgId: me.orgId, email: body.data.email, kind: "invite", role: body.data.role, ttlMs: 7 * 86_400_000 });
    await d.mailer.send({ to: body.data.email, ...templates.invite(link, me.name, me.company) });
    return reply.code(201).send({ ok: true });
  });
  app.get("/v1/auth/invite", async (req, reply) => {
    const raw = (req.query as { token?: string }).token;
    const t = raw ? await validToken(raw, "invite") : null;
    if (!t) return reply.code(400).send({ error: "This invitation is invalid or has expired" });
    const org = await d.orgs.getOrg(t.orgId);
    return { email: t.email, role: t.role, company: org?.name };
  });
  app.post("/v1/auth/accept-invite", async (req, reply) => {
    const body = z.object({ token: z.string().min(10), name: z.string().min(1).max(120), password: z.string().min(8).max(200) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const t = await validToken(body.data.token, "invite");
    if (!t) return reply.code(400).send({ error: "This invitation is invalid or has expired" });
    if (await d.users.findByEmail(t.email)) return reply.code(409).send({ error: "That email already has an account" });
    const org = await d.orgs.getOrg(t.orgId);
    const user = { id: randomUUID(), orgId: t.orgId, email: t.email, name: body.data.name, company: org?.name ?? "", role: t.role ?? "rep", passwordHash: hashPassword(body.data.password), emailVerifiedAt: now(), createdAt: now() };
    await d.users.create(user);
    await d.orgs.consumeToken(t.id, now());
    const token = await d.jwt.issue(user);
    return reply.code(201).send({ token, user: { id: user.id, orgId: user.orgId, email: user.email, name: user.name, company: user.company, role: user.role } });
  });
  app.patch("/v1/org/members/:id", async (req, reply) => {
    const me = p(req);
    if (!can(me.role, "admin")) return forbid(reply);
    const body = z.object({ role: z.enum(["rep", "manager", "admin"]) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const id = (req.params as { id: string }).id;
    if (id === me.userId && body.data.role !== "admin") return reply.code(400).send({ error: "You cannot remove your own admin role" });
    await d.orgs.setRole(me.orgId, id, body.data.role);
    return { ok: true };
  });
  app.delete("/v1/org/members/:id", async (req, reply) => {
    const me = p(req);
    if (!can(me.role, "admin")) return forbid(reply);
    const id = (req.params as { id: string }).id;
    if (id === me.userId) return reply.code(400).send({ error: "You cannot remove yourself" });
    await d.orgs.removeMember(me.orgId, id);
    return reply.code(204).send();
  });

  // ---- API keys ----
  app.get("/v1/org/api-keys", async (req) => (await d.orgs.listApiKeys(p(req).orgId)).map(({ keyHash: _h, ...k }) => k));
  app.post("/v1/org/api-keys", async (req, reply) => {
    const me = p(req);
    if (!can(me.role, "admin")) return forbid(reply);
    const body = z.object({ label: z.string().max(80).optional() }).safeParse(req.body ?? {});
    const raw = `ck_${randomToken(30)}`;
    const rec = { id: randomUUID(), orgId: me.orgId, userId: me.userId, keyHash: hashKey(raw), label: body.success ? body.data.label : undefined, createdAt: now() };
    await d.orgs.createApiKey(rec);
    // The plaintext is shown exactly once.
    return reply.code(201).send({ id: rec.id, key: raw, label: rec.label });
  });
  app.delete("/v1/org/api-keys/:id", async (req, reply) => {
    const me = p(req);
    if (!can(me.role, "admin")) return forbid(reply);
    await d.orgs.revokeApiKey(me.orgId, (req.params as { id: string }).id, now());
    return reply.code(204).send();
  });

  // ---- Usage ----
  app.get("/v1/org/usage", async (req) => d.orgs.getUsage(p(req).orgId, new Date(now()).toISOString().slice(0, 10)));

  // ---- Data: export everything, delete everything ----
  app.get("/v1/org/export", async (req, reply) => {
    const me = p(req);
    if (!can(me.role, "admin")) return forbid(reply);
    const [org, members, calls, knowledge, playbooks, calendars] = await Promise.all([
      d.orgs.getOrg(me.orgId), d.orgs.listMembers(me.orgId), d.calls.list(me.orgId), d.knowledge.list(me.orgId), d.playbooks.list(me.orgId), d.calendars.listForUser(me.userId),
    ]);
    reply.header("Content-Disposition", `attachment; filename="the-closer-export-${me.orgId}.json"`);
    return { exportedAt: new Date(now()).toISOString(), org, members, calls, knowledge, playbooks, calendars: calendars.map(({ accessToken: _a, refreshToken: _r, ...c }) => c) };
  });
  app.delete("/v1/org", async (req, reply) => {
    const me = p(req);
    if (!can(me.role, "admin")) return forbid(reply);
    const body = z.object({ confirm: z.literal("DELETE") }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Send {"confirm":"DELETE"} to delete the organisation and all its data' });
    await d.orgs.deleteOrg(me.orgId);
    return reply.code(204).send();
  });
}
