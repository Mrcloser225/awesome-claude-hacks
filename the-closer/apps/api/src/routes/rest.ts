import type { FastifyInstance } from "fastify";
import { CallContextSchema, type Playbook } from "@closer/core";
import { z } from "zod";
import { extractToken, type AuthResolver } from "../auth.js";

export interface RestDeps {
  auth: AuthResolver;
  listPlaybooks: (orgId: string) => Promise<Playbook[]>;
  savePlaybook: (orgId: string, playbook: Playbook) => Promise<Playbook>;
  /** Kick off a meeting bot for a scheduled call (Recall.ai). Returns bot id. */
  createBot?: (input: { meetingUrl: string; callId: string; repName: string }) => Promise<{ botId: string }>;
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

export function registerRestRoutes(app: FastifyInstance, deps: RestDeps): void {
  app.addHook("preHandler", async (req, reply) => {
    if (!req.url.startsWith("/v1/") || req.url.startsWith("/v1/live") || req.url.startsWith("/v1/webhooks")) return;
    const token = extractToken(req);
    const principal = token ? await deps.auth.resolve(token) : null;
    if (!principal) return reply.code(401).send({ error: "unauthorised" });
    (req as unknown as { principal: typeof principal }).principal = principal;
  });

  app.get("/health", async () => ({ ok: true, service: "the-closer-api" }));

  app.get("/v1/playbooks", async (req) => {
    const { principal } = req as unknown as { principal: { orgId: string } };
    return deps.listPlaybooks(principal.orgId);
  });

  app.put("/v1/playbooks/:id", async (req, reply) => {
    const { principal } = req as unknown as { principal: { orgId: string } };
    const parsed = PlaybookSchema.safeParse({ ...(req.body as object), id: (req.params as { id: string }).id });
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return deps.savePlaybook(principal.orgId, parsed.data as Playbook);
  });

  app.post("/v1/bots", async (req, reply) => {
    if (!deps.createBot) return reply.code(501).send({ error: "meeting bot provider not configured" });
    const body = z.object({ meetingUrl: z.string().url(), context: CallContextSchema }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const bot = await deps.createBot({ meetingUrl: body.data.meetingUrl, callId: body.data.context.callId, repName: body.data.context.rep.name });
    return { botId: bot.botId };
  });
}
