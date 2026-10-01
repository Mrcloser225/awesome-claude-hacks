import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { GLAXTONS_PLAYBOOK, type CallContext, type CoachModel, type InsightModel, type Playbook, type ServerMessage } from "@closer/core";
import { CompositeAuth, DevAuth, JwtAuth, MemoryUserStore, type AuthResolver, type UserStore } from "./auth.js";
import { AutoJoinScheduler } from "./autojoin/scheduler.js";
import { MemoryCalendarStore, type CalendarProvider, type CalendarProviderId, type CalendarStore } from "./autojoin/types.js";
import { registerCalendarRoutes } from "./routes/calendar.js";
import { MemoryKnowledgeStore, MemoryPlaybookStore, type KnowledgeStore, type PlaybookStore } from "./stores.js";
import { ApiKeyAuth } from "./auth.js";
import type { CrmOAuth } from "./crm/types.js";
import { MemoryOrgStore, type OrgStore } from "./org-store.js";
import { ConsoleMailer, type Mailer } from "./platform/mailer.js";
import { Metrics } from "./platform/metrics.js";
import { limitsFor, MemoryRateLimiter, type RateLimiter } from "./platform/rate-limit.js";
import { RetentionJob } from "./platform/retention.js";
import type { StripeClient, StripePlan } from "./platform/stripe.js";
import { registerAccountRoutes } from "./routes/account.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { pushCallToCrm, registerCrmRoutes } from "./routes/crm.js";
import { MemoryBus, type EventBus } from "./session/bus.js";
import { todayKey } from "./org-store.js";
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
  orgs?: OrgStore;
  mailer?: Mailer;
  limiter?: RateLimiter;
  bus?: EventBus;
  instanceId?: string;
  stripe?: StripeClient;
  stripePlans?: StripePlan[];
  crmProviders?: Partial<Record<"salesforce" | "hubspot", CrmOAuth>>;
  /** Posts the recording disclosure into the meeting chat (Recall sendChatMessage). */
  sendBotChat?: (botId: string, message: string) => Promise<void>;
  retentionIntervalMs?: number;
  metrics?: Metrics;
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
export async function buildApp(deps: AppDeps): Promise<{ app: FastifyInstance; hub: SessionHub; calls: CallStore; auth: AuthResolver; scheduler: AutoJoinScheduler; orgs: OrgStore; metrics: Metrics; mailer: Mailer; retention: RetentionJob }> {
  const app = Fastify({ logger: deps.logger ?? false });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(websocket, { options: { maxPayload: 1 << 20 } });
  // Keep the raw body for webhook signature checks (Stripe, Recall).
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    (req as unknown as { rawBody: string }).rawBody = body as string;
    try { done(null, body ? JSON.parse(body as string) : {}); } catch (err) { done(err as Error); }
  });

  const memUsers = deps.users ? undefined : new MemoryUserStore();
  const users = deps.users ?? memUsers!;
  const orgs = deps.orgs ?? new MemoryOrgStore(memUsers?.byId as unknown as ConstructorParameters<typeof MemoryOrgStore>[0]);
  const calls = deps.calls ?? new MemoryCallStore();
  const mailer = deps.mailer ?? new ConsoleMailer((m) => app.log.info(m));
  const limiter = deps.limiter ?? new MemoryRateLimiter();
  const metrics = deps.metrics ?? new Metrics();
  const bus = deps.bus ?? new MemoryBus();
  const webUrl = deps.webUrl ?? "http://localhost:3000";
  const jwtSecret = deps.jwtSecret ?? "dev-only-secret-change-me";
  const jwt = new JwtAuth(jwtSecret, users);
  const auth = new CompositeAuth([new DevAuth(deps.devApiKey), new ApiKeyAuth((h) => orgs.findApiKey(h), users), jwt]);

  const playbooks = deps.playbooks ?? new MemoryPlaybookStore(GLAXTONS_PLAYBOOK);
  const knowledge = deps.knowledge ?? new MemoryKnowledgeStore();
  const calendars = deps.calendars ?? new MemoryCalendarStore();
  const hub = new SessionHub(bus, deps.instanceId);
  metrics.gauge("live_calls", () => hub.list().length);
  for (const c of ["coach_calls", "bots_booked", "disclosures_sent", "errors"]) metrics.inc(c, 0);

  const resolvePlaybook = async (orgId: string, id?: string): Promise<Playbook> =>
    (id && (await playbooks.get(orgId, id))) || (await playbooks.list(orgId))[0] || GLAXTONS_PLAYBOOK;

  /** Coach calls are rate limited per org by plan; the limit shows up as a coach error card rather than silence. */
  const gatedModel = (orgId: string): CoachModel => ({
    stream: (req) => {
      const check = (async () => {
        const org = await orgs.getOrg(orgId);
        const ok = await limiter.take(`coach:${orgId}`, limitsFor(org?.plan ?? "trial").coachCallsPerMinute, 60_000);
        if (!ok) throw new Error("Coach rate limit reached for this minute on your plan");
        metrics.inc("coach_calls");
        await orgs.incrementUsage(orgId, todayKey(), "coach_calls");
      })();
      const inner = deps.model;
      return { async *[Symbol.asyncIterator]() { await check; yield* inner.stream(req); } };
    },
  });

  const createSession = async (orgId: string, ctx: CallContext, send: (m: ServerMessage) => void, opts: { audio: boolean }) =>
    new LiveSession(ctx, {
      stt: opts.audio ? deps.makeStt() : new NoopStt(),
      model: gatedModel(orgId),
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

  registerAuthRoutes(app, { users, orgs, mailer, webUrl, jwt, secureCookies: deps.secureCookies ?? false });
  registerAccountRoutes(app, { users, orgs, calls, knowledge, playbooks, calendars, mailer, jwt, webUrl });
  registerBillingRoutes(app, { orgs, stripe: deps.stripe, plans: deps.stripePlans ?? [], webUrl, log: app.log });
  const crmDeps = { orgs, calls, providers: deps.crmProviders ?? {}, log: app.log };
  registerCrmRoutes(app, { ...crmDeps, stateSecret: jwtSecret, webUrl });

  app.get("/metrics", async (_req, reply) => reply.type("text/plain; version=0.0.4").send(metrics.render()));

  registerRestRoutes(app, {
    auth,
    staleJobs: () => metrics.stale({ ...(deps.calendarProviders && Object.keys(deps.calendarProviders).length ? { autojoin: 15 * 60_000 } : {}), retention: 26 * 3600_000 }),
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
    orgs,
    limiter,
    afterSummary: async (rec) => { if (Object.keys(deps.crmProviders ?? {}).length) await pushCallToCrm(crmDeps, rec); },
    log: app.log,
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
  const origTick = scheduler.tick.bind(scheduler);
  scheduler.tick = async () => { const r = await origTick(); metrics.beat("autojoin"); metrics.inc("bots_booked", r.scheduled); return r; };

  registerLiveRoute(app, {
    auth,
    hub,
    createSession: (org, ctx, send) => createSession(org, ctx, send, { audio: true }),
    onCallStarted: async (s, orgId) => {
      await calls.upsert({ id: s.ctx.callId, orgId, title: s.ctx.prospect?.company ? `Call with ${s.ctx.prospect.company}` : "Live call", source: "desktop", context: s.ctx, startedAt: s.startedAt, endedAt: null, transcript: [], events: [], insight: null, summary: null });
    },
    onCallEnded,
  });

  registerRecallRoute(app, {
    webhookSecret: deps.recallWebhookSecret,
    hub,
    onCallEnded,
    forwardIngest: (callId, seg) => bus.forwardIngest(callId, seg),
    onInCall: async (botId, callId) => {
      const orgId = hub.orgOf(callId);
      const org = orgId ? await orgs.getOrg(orgId) : null;
      const s = hub.get(callId);
      if (org?.disclosure === "chat_message" && deps.sendBotChat && s) {
        await deps.sendBotChat(botId, `${s.ctx.rep.name} is using The Closer to take notes on this call. The conversation is being transcribed. Say so if you would rather it stopped.`);
        metrics.inc("disclosures_sent");
      }
    },
  });
  // Transcript for calls this instance owns can arrive via another instance's webhook.
  const offIngest = await bus.onIngest(hub.instanceId, (callId, seg) => hub.get(callId)?.ingest(seg));
  app.addHook("onClose", async () => { offIngest(); await bus.close(); });

  const retention = new RetentionJob({
    calls, orgs,
    listOrgIds: async () => [...new Set(hub.list().map((l) => l.orgId).filter((x): x is string => Boolean(x)))].concat(deps.orgs && "listOrgIds" in deps.orgs ? await (deps.orgs as unknown as { listOrgIds: () => Promise<string[]> }).listOrgIds() : []),
    log: app.log, onRun: () => metrics.beat("retention"),
  });
  app.addHook("onReady", async () => retention.start(deps.retentionIntervalMs ?? 24 * 3600_000));
  app.addHook("onClose", async () => retention.stop());

  return { app, hub, calls, auth, scheduler, orgs, metrics, mailer, retention };
}
