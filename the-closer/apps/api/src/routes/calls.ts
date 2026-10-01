import type { FastifyInstance, FastifyReply } from "fastify";
import { CallContextSchema, type CallContext, type KnowledgeDoc, type Playbook, type ServerMessage } from "@closer/core";
import { z } from "zod";
import type { Principal } from "../auth.js";
import { buildChatSystemPrompt, buildChatUserTurn, type ChatModel, type ChatTurn } from "../coach/call-chat.js";
import type { CallSummary } from "../coach/summary.js";
import { FirefliesClient } from "../integrations/fireflies.js";
import type { CallRecord, CallStore } from "../session/call-store.js";
import type { SessionHub } from "../session/hub.js";
import type { LiveSession } from "../session/live-session.js";

export interface CallsDeps {
  hub: SessionHub;
  calls: CallStore;
  chat: ChatModel;
  playbookFor: (orgId: string, id?: string) => Promise<Playbook>;
  knowledgeFor: (orgId: string) => Promise<KnowledgeDoc[]>;
  summarise?: (rec: CallRecord) => Promise<CallSummary>;
  createBot?: (input: { meetingUrl: string; callId: string; repName: string; botName?: string; joinAt?: number }) => Promise<{ botId: string }>;
  createSession: (orgId: string, ctx: CallContext, send: (m: ServerMessage) => void) => Promise<LiveSession>;
  firefliesClient?: (apiKey: string) => FirefliesClient;
}

type Authed = { principal: Principal };
const p = (req: unknown) => (req as Authed).principal;

function toRecordView(rec: CallRecord, live: LiveSession | undefined) {
  return live
    ? { ...rec, live: true, transcript: live.store.finals(), events: live.events, insight: live.insight, metrics: live.metrics() }
    : { ...rec, live: false };
}

export function registerCallRoutes(app: FastifyInstance, deps: CallsDeps): void {
  // ---- Bots: send a bot into a meeting and get a call you can attach to ----
  app.post("/v1/bots", async (req, reply) => {
    if (!deps.createBot) return reply.code(501).send({ error: "meeting bot provider not configured (set RECALL_API_KEY)" });
    const body = z.object({ meetingUrl: z.string().url(), context: CallContextSchema, botName: z.string().min(1).max(80).optional(), title: z.string().max(200).optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const ctx = body.data.context;
    if (deps.hub.get(ctx.callId)) return reply.code(409).send({ error: `call ${ctx.callId} already live` });
    const session = await deps.createSession(p(req).orgId, ctx, deps.hub.broadcaster(ctx.callId));
    const bot = await deps.createBot({ meetingUrl: body.data.meetingUrl, callId: ctx.callId, repName: ctx.rep.name, botName: body.data.botName });
    deps.hub.register(session, { botId: bot.botId, orgId: p(req).orgId });
    await deps.calls.upsert({
      id: ctx.callId, orgId: p(req).orgId, title: body.data.title ?? (ctx.prospect?.company ? `Call with ${ctx.prospect.company}` : "Live call"),
      source: "bot", context: ctx, startedAt: Date.now(), endedAt: null, transcript: [], events: [], insight: null, summary: null,
    });
    await session.start();
    return reply.code(201).send({ botId: bot.botId, callId: ctx.callId, attach: { ws: "/v1/live", message: { type: "session.attach", callId: ctx.callId } } });
  });

  // ---- Calls: live and finished ----
  app.get("/v1/calls", async (req) => {
    const stored = await deps.calls.list(p(req).orgId);
    const liveIds = new Set(deps.hub.list().map((l) => l.callId));
    return stored.map((r) => ({ id: r.id, title: r.title, source: r.source, startedAt: r.startedAt, endedAt: r.endedAt, live: liveIds.has(r.id), prospect: r.context.prospect ?? null, outcome: r.summary?.outcome ?? null }));
  });

  app.get("/v1/calls/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const rec = await deps.calls.get(p(req).orgId, id);
    if (!rec) return reply.code(404).send({ error: "no such call" });
    return toRecordView(rec, deps.hub.get(id));
  });

  app.post("/v1/calls/:id/ask", async (req, reply) => {
    const s = deps.hub.get((req.params as { id: string }).id);
    if (!s) return reply.code(404).send({ error: "call is not live" });
    const body = z.object({ question: z.string().min(1).max(500) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    s.ask(body.data.question);
    return reply.code(202).send({ ok: true });
  });

  app.post("/v1/calls/:id/insight", async (req, reply) => {
    const s = deps.hub.get((req.params as { id: string }).id);
    if (!s) return reply.code(404).send({ error: "call is not live" });
    return (await s.refreshInsight()) ?? reply.code(204).send();
  });

  app.post("/v1/calls/:id/summary", async (req, reply) => {
    const rec = await deps.calls.get(p(req).orgId, (req.params as { id: string }).id);
    if (!rec) return reply.code(404).send({ error: "no such call" });
    if (!deps.summarise) return reply.code(501).send({ error: "summary model not configured" });
    const live = deps.hub.get(rec.id);
    const src = live ? { ...rec, transcript: live.store.finals(), events: live.events, insight: live.insight } : rec;
    const summary = await deps.summarise(src);
    await deps.calls.upsert({ ...rec, summary });
    return summary;
  });

  /**
   * Chat with Claude about the call. Streams text/event-stream. The client
   * keeps the thread and sends it back each turn; the server supplies the
   * transcript, playbook and knowledge base so the model always sees the
   * current state of the call.
   */
  app.post("/v1/calls/:id/chat", async (req, reply: FastifyReply) => {
    const id = (req.params as { id: string }).id;
    const rec = await deps.calls.get(p(req).orgId, id);
    if (!rec) return reply.code(404).send({ error: "no such call" });
    const body = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) })).min(1).max(60) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const thread = body.data.messages;
    const last = thread[thread.length - 1]!;
    if (last.role !== "user") return reply.code(400).send({ error: "last message must be from the user" });

    const live = deps.hub.get(id);
    const transcript = live ? live.store.finals() : rec.transcript;
    const insight = live ? live.insight : rec.insight;
    const system = buildChatSystemPrompt(await deps.playbookFor(p(req).orgId, rec.context.playbookId), rec.context, await deps.knowledgeFor(p(req).orgId));
    // Earlier turns go through as plain history; only the latest user turn carries the transcript, so the cached prefix is the system prompt + history.
    const messages: ChatTurn[] = [...thread.slice(0, -1), { role: "user", content: buildChatUserTurn(transcript, insight, last.content, Boolean(live)) }];

    reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const controller = new AbortController();
    req.raw.on("close", () => controller.abort());
    try {
      for await (const delta of deps.chat.stream({ system, messages, signal: controller.signal })) {
        reply.raw.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
      reply.raw.write(`event: done\ndata: {}\n\n`);
    } catch (err) {
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: err instanceof Error ? err.message : String(err) })}\n\n`);
    }
    reply.raw.end();
    return reply;
  });

  /** Server-sent events feed of the same messages the WebSocket carries, for dashboards and Teams tabs. */
  app.get("/v1/calls/:id/events", async (req, reply: FastifyReply) => {
    const callId = (req.params as { id: string }).id;
    if (!deps.hub.get(callId)) return reply.code(404).send({ error: "call is not live" });
    reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const write = (m: ServerMessage) => reply.raw.write(`event: ${m.type}\ndata: ${JSON.stringify(m)}\n\n`);
    const detach = deps.hub.attach(callId, write);
    const ka = setInterval(() => reply.raw.write(": keep-alive\n\n"), 15000);
    await new Promise<void>((resolve) => req.raw.on("close", () => { clearInterval(ka); detach?.(); resolve(); }));
    return reply;
  });

  // ---- Fireflies: bring existing transcripts in and work them with Claude ----
  app.post("/v1/integrations/fireflies/transcripts", async (req, reply) => {
    const body = z.object({ apiKey: z.string().min(10), limit: z.number().int().min(1).max(50).optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const client = (deps.firefliesClient ?? ((k: string) => new FirefliesClient(k)))(body.data.apiKey);
    return client.list(body.data.limit ?? 20);
  });

  app.post("/v1/integrations/fireflies/import", async (req, reply) => {
    const body = z.object({ apiKey: z.string().min(10), transcriptId: z.string().min(1), repName: z.string().optional(), context: CallContextSchema.partial().optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const principal = p(req);
    const client = (deps.firefliesClient ?? ((k: string) => new FirefliesClient(k)))(body.data.apiKey);
    const repName = body.data.repName ?? principal.name;
    const { meta, segments } = await client.get(body.data.transcriptId, repName);
    const id = `ff_${meta.id}`;
    const ctx: CallContext = {
      callId: id,
      rep: { name: repName, company: principal.company },
      ...(body.data.context ?? {}),
    } as CallContext;
    const rec: CallRecord = {
      id, orgId: principal.orgId, title: meta.title || "Fireflies call", source: "fireflies", context: ctx,
      startedAt: meta.date, endedAt: meta.date + Math.round(meta.duration * 1000), transcript: segments, events: [], insight: null, summary: null, externalId: meta.id,
    };
    await deps.calls.upsert(rec);
    return reply.code(201).send({ callId: id, title: rec.title, segments: segments.length });
  });
}
