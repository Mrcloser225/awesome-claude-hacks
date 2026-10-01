import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import type { Principal } from "../auth.js";
import type { CrmOAuth } from "../crm/types.js";
import type { CrmConnection, OrgStore } from "../org-store.js";
import type { CallRecord, CallStore } from "../session/call-store.js";

export interface CrmDeps {
  orgs: OrgStore;
  calls: CallStore;
  providers: Partial<Record<"salesforce" | "hubspot", CrmOAuth>>;
  stateSecret: string;
  webUrl: string;
  log?: { info: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void };
}

type Authed = { principal: Principal };
const p = (req: unknown) => (req as Authed).principal;
const PROVIDER = z.enum(["salesforce", "hubspot"]);

/** Pushes a summarised call to every connected CRM with auto-push on (or the one named). Returns record ids. */
export async function pushCallToCrm(d: Pick<CrmDeps, "orgs" | "calls" | "providers" | "log">, rec: CallRecord, only?: "salesforce" | "hubspot"): Promise<Array<{ provider: string; id: string; url?: string }>> {
  if (!rec.summary) throw new Error("Summarise the call before pushing it to the CRM");
  const out: Array<{ provider: string; id: string; url?: string }> = [];
  for (const conn of await d.orgs.listCrm(rec.orgId)) {
    if (only ? conn.provider !== only : !conn.autoPush) continue;
    const oauth = d.providers[conn.provider];
    if (!oauth) continue;
    const live = await freshen(conn, oauth, d.orgs);
    const adapter = oauth.adapter({ accessToken: live.accessToken, instanceUrl: live.instanceUrl });
    const prospect = rec.context.prospect;
    const r = await adapter.logCall({ callId: rec.id, title: rec.title, prospectEmail: prospectEmailFrom(rec), prospectName: prospect?.name, prospectCompany: prospect?.company, summary: rec.summary, durationMs: (rec.endedAt ?? rec.startedAt) - rec.startedAt, startedAt: rec.startedAt });
    out.push({ provider: conn.provider, ...r });
    await d.calls.upsert({ ...rec, crmRecordId: r.id });
    d.log?.info({ callId: rec.id, provider: conn.provider, recordId: r.id }, "crm: call logged");
  }
  return out;
}

function prospectEmailFrom(rec: CallRecord): string | undefined {
  const m = /Attendees: ([^\n]+)/.exec(rec.context.briefing ?? "");
  const emails = (m?.[1] ?? "").split(",").map((s) => s.trim()).filter((s) => s.includes("@"));
  const repDomain = rec.context.rep.name ? undefined : undefined;
  void repDomain;
  return emails[0];
}

async function freshen(conn: CrmConnection, oauth: CrmOAuth, orgs: OrgStore): Promise<CrmConnection> {
  if (conn.expiresAt - Date.now() > 2 * 60_000 || !conn.refreshToken) return conn;
  const t = await oauth.refresh(conn.refreshToken);
  const next = { ...conn, accessToken: t.accessToken, refreshToken: t.refreshToken ?? conn.refreshToken, expiresAt: t.expiresAt, instanceUrl: t.instanceUrl ?? conn.instanceUrl };
  await orgs.saveCrm(next);
  return next;
}

export function registerCrmRoutes(app: FastifyInstance, d: CrmDeps): void {
  const key = new TextEncoder().encode(d.stateSecret);

  app.get("/v1/integrations/crm", async (req) => (await d.orgs.listCrm(p(req).orgId)).map(({ accessToken: _a, refreshToken: _r, ...c }) => c));
  app.get("/v1/integrations/crm/providers", async () => Object.keys(d.providers));

  app.get("/v1/integrations/crm/:provider/connect", async (req, reply) => {
    const me = p(req);
    if (me.role !== "admin") return reply.code(403).send({ error: "This needs admin access" });
    const prov = PROVIDER.safeParse((req.params as { provider: string }).provider);
    if (!prov.success) return reply.code(400).send({ error: "unknown provider" });
    const oauth = d.providers[prov.data];
    if (!oauth) return reply.code(501).send({ error: `${prov.data} is not configured on this server` });
    const state = await new SignJWT({ org: me.orgId, prov: prov.data }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("15m").sign(key);
    return { url: oauth.authorizeUrl(state) };
  });

  app.get("/v1/integrations/crm/:provider/callback", async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string };
    const back = (s: string) => reply.redirect(`${d.webUrl}/app/settings?crm=${s}`);
    if (q.error || !q.code || !q.state) return back(`error:${encodeURIComponent(q.error ?? "missing_code")}`);
    let claims: { org: string; prov: "salesforce" | "hubspot" };
    try { claims = (await jwtVerify(q.state, key)).payload as unknown as typeof claims; } catch { return back("error:bad_state"); }
    const oauth = d.providers[claims.prov];
    if (!oauth) return back("error:provider");
    try {
      const t = await oauth.exchangeCode(q.code);
      const existing = (await d.orgs.listCrm(claims.org)).find((c) => c.provider === claims.prov);
      await d.orgs.saveCrm({ id: existing?.id ?? randomUUID(), orgId: claims.org, provider: claims.prov, instanceUrl: t.instanceUrl ?? existing?.instanceUrl, accessToken: t.accessToken, refreshToken: t.refreshToken ?? existing?.refreshToken, expiresAt: t.expiresAt, autoPush: existing?.autoPush ?? true });
      return back(`connected:${claims.prov}`);
    } catch (err) { d.log?.error({ err }, "crm callback failed"); return back("error:exchange_failed"); }
  });

  app.patch("/v1/integrations/crm/:id", async (req, reply) => {
    const me = p(req);
    if (me.role !== "admin") return reply.code(403).send({ error: "This needs admin access" });
    const conn = (await d.orgs.listCrm(me.orgId)).find((c) => c.id === (req.params as { id: string }).id);
    if (!conn) return reply.code(404).send({ error: "no such connection" });
    const body = z.object({ autoPush: z.boolean() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    await d.orgs.saveCrm({ ...conn, autoPush: body.data.autoPush });
    return { ok: true };
  });

  app.delete("/v1/integrations/crm/:id", async (req, reply) => {
    const me = p(req);
    if (me.role !== "admin") return reply.code(403).send({ error: "This needs admin access" });
    await d.orgs.deleteCrm(me.orgId, (req.params as { id: string }).id);
    return reply.code(204).send();
  });

  /** Push one call now. */
  app.post("/v1/calls/:id/crm", async (req, reply) => {
    const rec = await d.calls.get(p(req).orgId, (req.params as { id: string }).id);
    if (!rec) return reply.code(404).send({ error: "no such call" });
    const body = z.object({ provider: PROVIDER.optional() }).safeParse(req.body ?? {});
    try {
      const pushed = await pushCallToCrm(d, rec, body.success ? body.data.provider : undefined);
      if (pushed.length === 0) return reply.code(400).send({ error: "No CRM connected with auto-push, or none matching that provider" });
      return { pushed };
    } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) }); }
  });
}
