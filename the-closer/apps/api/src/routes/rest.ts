import type { FastifyInstance, FastifyReply } from "fastify";
import { CallContextSchema, type CallContext, type KnowledgeDoc, type Playbook, type ServerMessage } from "@closer/core";
import { z } from "zod";
import { extractToken, type AuthResolver, type Principal } from "../auth.js";
import type { SessionHub } from "../session/hub.js";
import type { LiveSession } from "../session/live-session.js";

export interface RestDeps {
  auth: AuthResolver;
  hub: SessionHub;
  listPlaybooks: (orgId: string) => Promise<Playbook[]>;
  savePlaybook: (orgId: string, playbook: Playbook) => Promise<Playbook>;
  listKnowledge: (orgId: string) => Promise<KnowledgeDoc[]>;
  saveKnowledge: (orgId: string, doc: KnowledgeDoc) => Promise<KnowledgeDoc>;
  deleteKnowledge: (orgId: string, id: string) => Promise<void>;
  /** Start a meeting bot (Recall.ai). Returns the provider's bot id. */
  createBot?: (input: { meetingUrl: string; callId: string; repName: string }) => Promise<{ botId: string }>;
  /** Build a session for a bot-driven call (no audio; transcripts arrive via webhook). */
  createSession: (ctx: CallContext, send: (m: ServerMessage) => void) => Promise<LiveSession>;
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
    if (!req.url.startsWith("/v1/") || req.url.startsWith("/v1/live") || req.url.startsWith("/v1/webhooks")) return;
    const token = extractToken(req);
    const principal = token ? await deps.auth.resolve(token) : null;
    if (!principal) return reply.code(401).send({ error: "unauthorised" });
    (req as unknown as Authed).principal = principal;
  });

  app.get("/health", async () => ({ ok: true, service: "the-closer-api" }));

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

  // ---- Bots: send a bot into a meeting and get a call you can attach to ----
  app.post("/v1/bots", async (req, reply) => {
    if (!deps.createBot) return reply.code(501).send({ error: "meeting bot provider not configured (set RECALL_API_KEY)" });
    const body = z.object({ meetingUrl: z.string().url(), context: CallContextSchema }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const ctx = body.data.context;
    if (deps.hub.get(ctx.callId)) return reply.code(409).send({ error: `call ${ctx.callId} already live` });
    const session = await deps.createSession(ctx, deps.hub.broadcaster(ctx.callId));
    const bot = await deps.createBot({ meetingUrl: body.data.meetingUrl, callId: ctx.callId, repName: ctx.rep.name });
    deps.hub.register(session, { botId: bot.botId });
    await session.start();
    return reply.code(201).send({ botId: bot.botId, callId: ctx.callId, attach: { ws: "/v1/live", message: { type: "session.attach", callId: ctx.callId } } });
  });

  // ---- Live calls ----
  app.get("/v1/calls", async () => deps.hub.list());

  app.get("/v1/calls/:id", async (req, reply) => {
    const s = deps.hub.get((req.params as { id: string }).id);
    if (!s) return reply.code(404).send({ error: "no such live call" });
    return { callId: s.ctx.callId, context: s.ctx, metrics: s.metrics(), insight: s.insight, events: s.events, transcript: s.store.finals() };
  });

  app.post("/v1/calls/:id/ask", async (req, reply) => {
    const s = deps.hub.get((req.params as { id: string }).id);
    if (!s) return reply.code(404).send({ error: "no such live call" });
    const body = z.object({ question: z.string().min(1).max(500) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    s.ask(body.data.question);
    return reply.code(202).send({ ok: true });
  });

  app.post("/v1/calls/:id/insight", async (req, reply) => {
    const s = deps.hub.get((req.params as { id: string }).id);
    if (!s) return reply.code(404).send({ error: "no such live call" });
    return (await s.refreshInsight()) ?? reply.code(204).send();
  });

  /** Server-sent events feed of the same messages the WebSocket carries, for dashboards and Teams tabs. */
  app.get("/v1/calls/:id/events", async (req, reply: FastifyReply) => {
    const callId = (req.params as { id: string }).id;
    if (!deps.hub.get(callId)) return reply.code(404).send({ error: "no such live call" });
    reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" });
    const write = (m: ServerMessage) => reply.raw.write(`event: ${m.type}\ndata: ${JSON.stringify(m)}\n\n`);
    const detach = deps.hub.attach(callId, write);
    const ka = setInterval(() => reply.raw.write(": keep-alive\n\n"), 15000);
    req.raw.on("close", () => { clearInterval(ka); detach?.(); });
    await new Promise<void>((resolve) => req.raw.on("close", () => resolve()));
    return reply;
  });
}
