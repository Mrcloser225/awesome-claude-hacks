import type { FastifyInstance } from "fastify";
import type { KnowledgeDoc, Playbook } from "@closer/core";
import { listProviders } from "../llm/providers.js";
import { z } from "zod";
import { extractToken, type AuthResolver, type Principal } from "../auth.js";

export interface RestDeps {
  auth: AuthResolver;
  /** Returns the names of background jobs that have not run on schedule. */
  staleJobs?: () => string[];
  listPlaybooks: (orgId: string) => Promise<Playbook[]>;
  savePlaybook: (orgId: string, playbook: Playbook) => Promise<Playbook>;
  listKnowledge: (orgId: string) => Promise<KnowledgeDoc[]>;
  saveKnowledge: (orgId: string, doc: KnowledgeDoc) => Promise<KnowledgeDoc>;
  deleteKnowledge: (orgId: string, id: string) => Promise<void>;
}

const PlaybookSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string(),
  product: z.string(),
  positioning: z.string(),
  idealCustomer: z.string(),
  valueProps: z.array(z.string()),
  proofPoints: z.array(z.string()),
  discoveryQuestions: z.array(z.string()),
  objections: z.array(z.object({ trigger: z.string(), response: z.string() })),
  competitors: z.array(z.object({ name: z.string(), counter: z.string() })),
  stageGuides: z.record(z.string()),
  tone: z.string(),
  guardrails: z.array(z.string()),
});

const KnowledgeSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(200_000),
  tags: z.array(z.string()).optional(),
});

type Authed = { principal: Principal };

export function registerRestRoutes(app: FastifyInstance, deps: RestDeps): void {
  app.addHook("preHandler", async (req, reply) => {
    const open = ["/v1/live", "/v1/webhooks", "/v1/auth/signup", "/v1/auth/login", "/v1/auth/verify", "/v1/auth/forgot", "/v1/auth/reset", "/v1/auth/invite", "/v1/auth/accept-invite", "/v1/integrations/calendar/microsoft/callback", "/v1/integrations/calendar/google/callback", "/v1/integrations/crm/salesforce/callback", "/v1/integrations/crm/hubspot/callback"];
    if (!req.url.startsWith("/v1/") || open.some((o) => req.url.startsWith(o))) return;
    const token = extractToken(req);
    const principal = token ? await deps.auth.resolve(token) : null;
    if (!principal) return reply.code(401).send({ error: "unauthorised" });
    (req as unknown as Authed).principal = principal;
  });

  app.get("/health", async (_req, reply) => {
    const stale = deps.staleJobs?.() ?? [];
    if (stale.length) return reply.code(503).send({ ok: false, service: "the-closer-api", degraded: stale });
    return { ok: true, service: "the-closer-api" };
  });
  /** Which model providers this build can run on. Public, no keys. */
  app.get("/providers", async () => listProviders());

  // ---- Playbooks ----
  app.get("/v1/playbooks", async (req) => deps.listPlaybooks((req as unknown as Authed).principal.orgId));
  app.put("/v1/playbooks/:id", async (req, reply) => {
    const parsed = PlaybookSchema.safeParse({ ...(req.body as object), id: (req.params as { id: string }).id });
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return deps.savePlaybook((req as unknown as Authed).principal.orgId, parsed.data as Playbook);
  });

  // ---- Knowledge base the coach answers from ----
  app.get("/v1/knowledge", async (req) => deps.listKnowledge((req as unknown as Authed).principal.orgId));
  app.put("/v1/knowledge/:id", async (req, reply) => {
    const parsed = KnowledgeSchema.safeParse({ ...(req.body as object), id: (req.params as { id: string }).id });
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return deps.saveKnowledge((req as unknown as Authed).principal.orgId, { ...parsed.data, updatedAt: Date.now() });
  });
  app.delete("/v1/knowledge/:id", async (req, reply) => {
    await deps.deleteKnowledge((req as unknown as Authed).principal.orgId, (req.params as { id: string }).id);
    return reply.code(204).send();
  });
}
