import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { hashPassword, SESSION_COOKIE, verifyPassword, type JwtAuth, type Principal, type UserStore } from "../auth.js";
import type { OrgStore } from "../org-store.js";
import { templates, type Mailer } from "../platform/mailer.js";
import { issueToken } from "./account.js";

export interface AuthRouteDeps {
  users: UserStore;
  orgs: OrgStore;
  mailer: Mailer;
  webUrl: string;
  jwt: JwtAuth;
  /** Cross-site cookies (web on thecloser.ai, API on api.thecloser.ai) need SameSite=None; Secure. */
  secureCookies: boolean;
}

const Credentials = z.object({ email: z.string().email(), password: z.string().min(8).max(200) });
const Signup = Credentials.extend({ name: z.string().min(1).max(120), company: z.string().min(1).max(160) });

function setCookie(reply: FastifyReply, token: string, secure: boolean): void {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", `Max-Age=${30 * 24 * 3600}`];
  parts.push(secure ? "SameSite=None; Secure" : "SameSite=Lax");
  reply.header("Set-Cookie", parts.join("; "));
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  app.post("/v1/auth/signup", async (req, reply) => {
    const body = Signup.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const email = body.data.email.toLowerCase();
    if (await deps.users.findByEmail(email)) return reply.code(409).send({ error: "An account with that email already exists" });
    // The first user of an organisation is its admin.
    const user = { id: randomUUID(), orgId: randomUUID(), email, name: body.data.name, company: body.data.company, role: "admin" as const, passwordHash: hashPassword(body.data.password), createdAt: Date.now() };
    await deps.users.create(user);
    await deps.orgs.updateOrg(user.orgId, { name: user.company }).catch(() => {});
    const token = await deps.jwt.issue(user);
    setCookie(reply, token, deps.secureCookies);
    try {
      const link = await issueToken({ orgs: deps.orgs, webUrl: deps.webUrl }, { orgId: user.orgId, userId: user.id, email, kind: "verify", ttlMs: 24 * 3600_000 });
      await deps.mailer.send({ to: email, ...templates.verify(link) });
    } catch (err) { req.log.warn({ err }, "verification email failed"); }
    return reply.code(201).send({ token, user: { id: user.id, orgId: user.orgId, email, name: user.name, company: user.company, role: user.role } });
  });

  app.post("/v1/auth/login", async (req, reply) => {
    const body = Credentials.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const user = await deps.users.findByEmail(body.data.email);
    if (!user || !verifyPassword(body.data.password, user.passwordHash)) return reply.code(401).send({ error: "Wrong email or password" });
    const token = await deps.jwt.issue(user);
    setCookie(reply, token, deps.secureCookies);
    return { token, user: { id: user.id, orgId: user.orgId, email: user.email, name: user.name, company: user.company, role: user.role, emailVerified: Boolean(user.emailVerifiedAt) } };
  });

  app.post("/v1/auth/logout", async (_req, reply) => {
    reply.header("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0; ${deps.secureCookies ? "SameSite=None; Secure" : "SameSite=Lax"}`);
    return { ok: true };
  });

  app.get("/v1/auth/me", async (req) => {
    const { principal } = req as unknown as { principal: Principal };
    return { user: principal };
  });
}
