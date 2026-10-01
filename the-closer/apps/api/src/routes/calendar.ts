import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import type { Principal } from "../auth.js";
import type { AutoJoinScheduler } from "../autojoin/scheduler.js";
import type { CalendarProvider, CalendarProviderId, CalendarStore } from "../autojoin/types.js";

export interface CalendarRouteDeps {
  store: CalendarStore;
  providers: Partial<Record<CalendarProviderId, CalendarProvider>>;
  scheduler: AutoJoinScheduler;
  /** Signs the OAuth state so the callback can trust who started the flow. */
  stateSecret: string;
  /** Where to send the browser after the callback. */
  webUrl: string;
}

type Authed = { principal: Principal };
const p = (req: unknown) => (req as Authed).principal;
const PROVIDER = z.enum(["microsoft", "google"]);

/**
 * Connect a calendar, choose auto-join settings, preview what will be joined.
 * Flow: GET /connect returns the provider's consent URL; the provider redirects
 * back to /callback with a code; we store tokens and bounce to the web app.
 */
export function registerCalendarRoutes(app: FastifyInstance, deps: CalendarRouteDeps): void {
  const key = new TextEncoder().encode(deps.stateSecret);

  app.get("/v1/integrations/calendar", async (req) => {
    const conns = await deps.store.listForUser(p(req).userId);
    return conns.map(({ accessToken: _a, refreshToken: _r, ...c }) => c);
  });

  app.get("/v1/integrations/calendar/providers", async () => Object.keys(deps.providers));

  app.get("/v1/integrations/calendar/:provider/connect", async (req, reply) => {
    const prov = PROVIDER.safeParse((req.params as { provider: string }).provider);
    if (!prov.success) return reply.code(400).send({ error: "unknown provider" });
    const provider = deps.providers[prov.data];
    if (!provider) return reply.code(501).send({ error: `${prov.data} calendar is not configured on this server` });
    const state = await new SignJWT({ uid: p(req).userId, org: p(req).orgId, prov: prov.data }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("15m").sign(key);
    return { url: provider.authorizeUrl(state) };
  });

  // The callback arrives from the provider without our cookie on some browsers; the signed state carries identity.
  app.get("/v1/integrations/calendar/:provider/callback", async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string; error_description?: string };
    const back = (status: string) => reply.redirect(`${deps.webUrl}/app/settings?calendar=${status}`);
    if (q.error) return back(`error:${encodeURIComponent(q.error_description ?? q.error)}`);
    if (!q.code || !q.state) return back("error:missing_code");
    let claims: { uid: string; org: string; prov: CalendarProviderId };
    try { claims = (await jwtVerify(q.state, key)).payload as unknown as typeof claims; } catch { return back("error:bad_state"); }
    const provider = deps.providers[claims.prov];
    if (!provider) return back("error:provider");
    try {
      const t = await provider.exchangeCode(q.code);
      const existing = (await deps.store.listForUser(claims.uid)).find((c) => c.provider === claims.prov);
      await deps.store.save({
        id: existing?.id ?? randomUUID(), orgId: claims.org, userId: claims.uid, provider: claims.prov, accountEmail: t.accountEmail ?? existing?.accountEmail,
        accessToken: t.accessToken, refreshToken: t.refreshToken ?? existing?.refreshToken, expiresAt: t.expiresAt,
        autoJoin: existing?.autoJoin ?? true, externalOnly: existing?.externalOnly ?? true, botName: existing?.botName,
      });
      return back(`connected:${claims.prov}`);
    } catch (err) {
      req.log.error({ err }, "calendar callback failed");
      return back("error:exchange_failed");
    }
  });

  app.patch("/v1/integrations/calendar/:id", async (req, reply) => {
    const conn = await deps.store.get((req.params as { id: string }).id);
    if (!conn || conn.userId !== p(req).userId) return reply.code(404).send({ error: "no such connection" });
    const body = z.object({ autoJoin: z.boolean().optional(), externalOnly: z.boolean().optional(), botName: z.string().max(80).nullable().optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    if (body.data.autoJoin !== undefined) conn.autoJoin = body.data.autoJoin;
    if (body.data.externalOnly !== undefined) conn.externalOnly = body.data.externalOnly;
    if (body.data.botName !== undefined) conn.botName = body.data.botName || undefined;
    await deps.store.save(conn);
    const { accessToken: _a, refreshToken: _r, ...safe } = conn;
    return safe;
  });

  app.delete("/v1/integrations/calendar/:id", async (req, reply) => {
    const conn = await deps.store.get((req.params as { id: string }).id);
    if (!conn || conn.userId !== p(req).userId) return reply.code(404).send({ error: "no such connection" });
    await deps.store.delete(conn.id);
    return reply.code(204).send();
  });

  /** What the next 24 hours look like: every meeting, whether a bot will go, and why not if not. */
  app.get("/v1/integrations/calendar/:id/upcoming", async (req, reply) => {
    const conn = await deps.store.get((req.params as { id: string }).id);
    if (!conn || conn.userId !== p(req).userId) return reply.code(404).send({ error: "no such connection" });
    return deps.scheduler.preview(conn);
  });

  /** Run the scheduler now instead of waiting for the next tick (settings page "check now"). */
  app.post("/v1/integrations/calendar/run", async () => deps.scheduler.tick());
}
