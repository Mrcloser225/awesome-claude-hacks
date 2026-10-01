import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { GLAXTONS_PLAYBOOK, type CallContext, type CoachModel, type InsightModel, type Playbook, type ServerMessage } from "@closer/core";
import { CompositeAuth, DevAuth, JwtAuth, MemoryUserStore, type AuthResolver, type UserStore } from "./auth.js";
import { AutoJoinScheduler } from "./autojoin/scheduler.js";
import { MemoryCalendarStore, type CalendarProvider, type CalendarProviderId, type CalendarStore } from "./autojoin/types.js";
import { registerCalendarRoutes } from "./routes/calendar.js";
import { MemoryKnowledgeStore, MemoryPlaybookStore, type KnowledgeStore, type PlaybookStore } from "./stores.js";
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
  knowledge?: KnowledgeStore;
  playbooks?: PlaybookStore;
  calendars?: CalendarStore;
  calendarProviders?: Partial<Record<CalendarProviderId, CalendarProvider>>;
  /** Public URL of the web app, for OAuth redirects back to the settings page. */
  webUrl?: string;
  autoJoinIntervalMs?: number;
  makeStt: SttFactory;
  model: CoachModel;
  chatModel?: ChatModel;
  insightModel?: InsightModel;
  summarise?: (rec: CallRecord) => Promise<CallSummary>;
  recallWebhookSecret?: string;
  createBot?: (input: { meetingUrl: string; callId: string; repName: string; botName?: string; joinAt?: number }) => Promise<{ botId: string }>;
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
export async function buildApp(deps: AppDeps): Promise<{ app: FastifyInstance; hub: SessionHub; calls: CallStore; auth: AuthResolver; scheduler: AutoJoinScheduler }> {
  const app = Fastify({ logger: deps.logger ?? false });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(websocket, { options: { maxPayload: 1 << 20 } });

  const users = deps.users ?? new MemoryUserStore();
  const calls = deps.calls ?? new MemoryCallStore();
  const jwt = new JwtAuth(deps.jwtSecret ?? "dev-only-secret-change-me", users);
  const auth = new CompositeAuth([new DevAuth(deps.devApiKey), jwt]);

  const playbooks = deps.playbooks ?? new MemoryPlaybookStore(GLAXTONS_PLAYBOOK);
  const knowledge = deps.knowledge ?? new MemoryKnowledgeStore();
  const calendars = deps.calendars ?? new MemoryCalendarStore();
  const hub = new SessionHub();

  const resolvePlaybook = async (orgId: string, id?: string): Promise<Playbook> =>
    (id && (await playbooks.get(orgId, id))) || (await playbooks.list(orgId))[0] || GLAXTONS_PLAYBOOK;

  const createSession = async (orgId: string, ctx: CallContext, send: (m: ServerMessage) => void, opts: { audio: boolean }) =>
    new LiveSession(ctx, {
      stt: opts.audio ? deps.makeStt() : new NoopStt(),
      model: deps.model,
      insightModel: deps.insightModel,
      playbook: await resolvePlaybook(orgId, ctx.playbookId),
      knowledge: await knowledge.list(orgId),
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
    listPlaybooks: (org) => playbooks.list(org),
    savePlaybook: (org, pb) => playbooks.save(org, pb),
    listKnowledge: (org) => knowledge.list(org),
    saveKnowledge: (org, doc) => knowledge.save(org, doc),
    deleteKnowledge: (org, id) => knowledge.delete(org, id),
  });

  registerCallRoutes(app, {
    hub,
    calls,
    chat: deps.chatModel ?? { async *stream() { throw new Error("chat model not configured"); } },
    playbookFor: resolvePlaybook,
    knowledgeFor: (org) => knowledge.list(org),
    summarise: deps.summarise,
    createBot: deps.createBot,
    createSession: (org, ctx, send) => createSession(org, ctx, send, { audio: false }),
    firefliesClient: deps.firefliesClient,
  });

  // Fireflies-style auto-join from connected calendars.
  const scheduler = new AutoJoinScheduler({
    store: calendars,
    providers: deps.calendarProviders ?? {},
    userFor: async (userId) => { const u = await users.findById(userId); return u ? { name: u.name, company: u.company, email: u.email } : null; },
    startBot: async ({ orgId, context, meetingUrl, botName, joinAt, title }) => {
      if (!deps.createBot) throw new Error("meeting bot provider not configured");
      const session = await createSession(orgId, context, hub.broadcaster(context.callId), { audio: false });
      const bot = await deps.createBot({ meetingUrl, callId: context.callId, repName: context.rep.name, botName, joinAt });
      hub.register(session, { botId: bot.botId, orgId });
      await calls.upsert({ id: context.callId, orgId, title, source: "bot", context, startedAt: joinAt, endedAt: null, transcript: [], events: [], insight: null, summary: null });
      await session.start();
      return bot;
    },
    log: app.log,
  });
  registerCalendarRoutes(app, { store: calendars, providers: deps.calendarProviders ?? {}, scheduler, stateSecret: deps.jwtSecret ?? "dev-only-secret-change-me", webUrl: deps.webUrl ?? "http://localhost:3000" });
  if (deps.calendarProviders && Object.keys(deps.calendarProviders).length > 0) {
    app.addHook("onReady", async () => scheduler.start(deps.autoJoinIntervalMs ?? 5 * 60_000));
    app.addHook("onClose", async () => scheduler.stop());
  }

  registerLiveRoute(app, {
    auth,
    hub,
    createSession: (org, ctx, send) => createSession(org, ctx, send, { audio: true }),
    onCallStarted: async (s, orgId) => {
      await calls.upsert({ id: s.ctx.callId, orgId, title: s.ctx.prospect?.company ? `Call with ${s.ctx.prospect.company}` : "Live call", source: "desktop", context: s.ctx, startedAt: s.startedAt, endedAt: null, transcript: [], events: [], insight: null, summary: null });
    },
    onCallEnded,
  });

  registerRecallRoute(app, { webhookSecret: deps.recallWebhookSecret, hub, onCallEnded });

  return { app, hub, calls, auth, scheduler };
}
