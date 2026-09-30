import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { GLAXTONS_PLAYBOOK, type CallContext, type CoachModel, type InsightModel, type KnowledgeDoc, type Playbook, type ServerMessage } from "@closer/core";
import { CompositeAuth, DevAuth, JwtAuth, MemoryUserStore, type AuthResolver, type UserStore } from "./auth.js";
import type { ChatModel } from "./coach/call-chat.js";
import type { CallSummary } from "./coach/summary.js";
import type { FirefliesClient } from "./integrations/fireflies.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerCallRoutes } from "./routes/calls.js";
import { registerLiveRoute } from "./routes/live.js";
import { registerRecallRoute } from "./routes/recall.js";
import { registerRestRoutes } from "./routes/rest.js";
import { MemoryCallStore, type CallRecord, type CallStore } from "./session/call-store.js";
import { SessionHub } from "./session/hub.js";
import { LiveSession } from "./session/live-session.js";
import { NoopStt } from "./stt/none.js";
import type { SttFactory } from "./stt/types.js";

export interface AppDeps {
  /** Dev API key for the desktop app and curl. Optional once accounts exist. */
  devApiKey?: string;
  jwtSecret?: string;
  users?: UserStore;
  calls?: CallStore;
  makeStt: SttFactory;
  model: CoachModel;
  chatModel?: ChatModel;
  insightModel?: InsightModel;
  summarise?: (rec: CallRecord) => Promise<CallSummary>;
  playbooks?: Map<string, Playbook>;
  knowledge?: Map<string, KnowledgeDoc>;
  recallWebhookSecret?: string;
  createBot?: (input: { meetingUrl: string; callId: string; repName: string; botName?: string }) => Promise<{ botId: string }>;
  firefliesClient?: (apiKey: string) => FirefliesClient;
  onCallEnded?: (session: LiveSession, record: CallRecord | null) => Promise<void> | void;
  secureCookies?: boolean;
  logger?: boolean;
}

/**
 * Builds the Fastify app with every dependency injected, so tests can run the
 * full pipeline with fake STT and fake models. In-memory stores by default;
 * the Drizzle-backed versions implement the same interfaces.
 */
export async function buildApp(deps: AppDeps): Promise<{ app: FastifyInstance; hub: SessionHub; calls: CallStore; auth: AuthResolver }> {
  const app = Fastify({ logger: deps.logger ?? false });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(websocket, { options: { maxPayload: 1 << 20 } });

  const users = deps.users ?? new MemoryUserStore();
  const calls = deps.calls ?? new MemoryCallStore();
  const jwt = new JwtAuth(deps.jwtSecret ?? "dev-only-secret-change-me", users);
  const auth = new CompositeAuth([new DevAuth(deps.devApiKey), jwt]);

  const playbooks = deps.playbooks ?? new Map<string, Playbook>([[GLAXTONS_PLAYBOOK.id, GLAXTONS_PLAYBOOK]]);
  const knowledge = deps.knowledge ?? new Map<string, KnowledgeDoc>();
  const hub = new SessionHub();

  const resolvePlaybook = (id?: string): Playbook => (id && playbooks.get(id)) || [...playbooks.values()][0] || GLAXTONS_PLAYBOOK;

  const createSession = async (ctx: CallContext, send: (m: ServerMessage) => void, opts: { audio: boolean }) =>
    new LiveSession(ctx, {
      stt: opts.audio ? deps.makeStt() : new NoopStt(),
      model: deps.model,
      insightModel: deps.insightModel,
      playbook: resolvePlaybook(ctx.playbookId),
      knowledge: [...knowledge.values()],
      send,
      log: app.log,
    });

  /** Freeze a finished live session into its stored record. */
  const persistEnded = async (s: LiveSession): Promise<CallRecord | null> => {
    const orgId = hub.orgOf(s.ctx.callId);
    if (!orgId) return null;
    const existing = await calls.get(orgId, s.ctx.callId);
    const rec: CallRecord = {
      id: s.ctx.callId, orgId, title: existing?.title ?? "Live call", source: existing?.source ?? "desktop", context: s.ctx,
      startedAt: existing?.startedAt ?? s.startedAt, endedAt: Date.now(), transcript: s.store.finals(), events: s.events, insight: s.insight, summary: existing?.summary ?? null,
    };
    await calls.upsert(rec);
    return rec;
  };
  const onCallEnded = async (s: LiveSession) => {
    const rec = await persistEnded(s);
    await deps.onCallEnded?.(s, rec);
  };

  registerAuthRoutes(app, { users, jwt, secureCookies: deps.secureCookies ?? false });

  registerRestRoutes(app, {
    auth,
    listPlaybooks: async () => [...playbooks.values()],
    savePlaybook: async (_org, pb) => { playbooks.set(pb.id, pb); return pb; },
    listKnowledge: async () => [...knowledge.values()],
    saveKnowledge: async (_org, doc) => { knowledge.set(doc.id, doc); return doc; },
    deleteKnowledge: async (_org, id) => { knowledge.delete(id); },
  });

  registerCallRoutes(app, {
    hub,
    calls,
    chat: deps.chatModel ?? { async *stream() { throw new Error("chat model not configured"); } },
    playbookFor: (_org, id) => resolvePlaybook(id),
    knowledgeFor: () => [...knowledge.values()],
    summarise: deps.summarise,
    createBot: deps.createBot,
    createSession: (ctx, send) => createSession(ctx, send, { audio: false }),
    firefliesClient: deps.firefliesClient,
  });

  registerLiveRoute(app, {
    auth,
    hub,
    createSession: (ctx, send) => createSession(ctx, send, { audio: true }),
    onCallStarted: async (s, orgId) => {
      await calls.upsert({ id: s.ctx.callId, orgId, title: s.ctx.prospect?.company ? `Call with ${s.ctx.prospect.company}` : "Live call", source: "desktop", context: s.ctx, startedAt: s.startedAt, endedAt: null, transcript: [], events: [], insight: null, summary: null });
    },
    onCallEnded,
  });

  registerRecallRoute(app, { webhookSecret: deps.recallWebhookSecret, hub, onCallEnded });

  return { app, hub, calls, auth };
}
