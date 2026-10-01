import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { createModels } from "./llm/factory.js";
import { resolveProvider } from "./llm/providers.js";
import { summariseCall } from "./coach/summary.js";
import { TranscriptStore } from "@closer/core";
import { DeepgramLive } from "./stt/deepgram.js";
import { NoopStt } from "./stt/none.js";
import { RecallClient } from "./recall-client.js";
import { createDb, runMigrations } from "./db/client.js";
import { PgCalendarStore, PgCallStore, PgKnowledgeStore, PgOrgStore, PgPlaybookStore, PgUserStore } from "./db/stores.js";
import { AesGcmCipher, NoopCipher, type Cipher } from "./platform/crypto.js";
import { ConsoleMailer, ResendMailer, type Mailer } from "./platform/mailer.js";
import { ErrorReporter, Metrics } from "./platform/metrics.js";
import { MemoryRateLimiter, RedisRateLimiter, type RateLimiter } from "./platform/rate-limit.js";
import { StripeClient, type StripePlan } from "./platform/stripe.js";
import { MemoryBus, RedisBus, type EventBus } from "./session/bus.js";
import { SalesforceOAuth } from "./crm/salesforce.js";
import { HubSpotOAuth } from "./crm/hubspot.js";
import type { CrmOAuth } from "./crm/types.js";
import { orgs as orgsTable } from "./db/schema.js";
import { Redis } from "ioredis";
import { MicrosoftCalendar } from "./autojoin/microsoft.js";
import { GoogleCalendar } from "./autojoin/google.js";
import type { CalendarProvider, CalendarProviderId } from "./autojoin/types.js";
import { GLAXTONS_PLAYBOOK } from "@closer/core";

const cfg = loadConfig();
const provider = resolveProvider(process.env);
const models = createModels(provider, { effort: cfg.coachEffort, webSearch: cfg.coachWebSearch, insightModel: cfg.insightModel, chatModel: cfg.chatModel });
console.log(`Models: ${models.label}`);

if (provider.provider === "anthropic" && !provider.apiKey) console.warn("ANTHROPIC_API_KEY not set; relying on ant auth profile or env token");
if (provider.provider !== "anthropic" && !provider.apiKey && provider.provider !== "ollama") console.warn(`LLM_PROVIDER=${provider.provider} but no API key found; set LLM_API_KEY`);
if (!cfg.deepgramApiKey) console.warn("DEEPGRAM_API_KEY not set; desktop audio streaming disabled, bot path and transcript.push still work");
if (!cfg.recallApiKey) console.warn("RECALL_API_KEY not set; POST /v1/bots will return 501");

const publicUrl = process.env.PUBLIC_URL ?? `http://localhost:${cfg.port}`;
const recall = cfg.recallApiKey
  ? new RecallClient({ apiKey: cfg.recallApiKey, region: cfg.recallRegion, webhookUrl: `${publicUrl}/v1/webhooks/recall` })
  : undefined;

// Persistence: Postgres when DATABASE_URL is set, otherwise in-memory (development only).
const cipher: Cipher = cfg.encryptionKey ? new AesGcmCipher(cfg.encryptionKey) : new NoopCipher();
if (!cfg.encryptionKey) console.warn("ENCRYPTION_KEY not set; calendar and CRM tokens will be stored in plaintext. Set it before connecting real accounts.");

let stores: Partial<Parameters<typeof buildApp>[0]> = {};
if (cfg.databaseUrl) {
  await runMigrations(cfg.databaseUrl);
  const { db } = createDb(cfg.databaseUrl);
  const orgStore = Object.assign(new PgOrgStore(db, cipher), { listOrgIds: async () => (await db.select({ id: orgsTable.id }).from(orgsTable)).map((r) => r.id) });
  stores = { users: new PgUserStore(db), orgs: orgStore, calls: new PgCallStore(db), knowledge: new PgKnowledgeStore(db), playbooks: new PgPlaybookStore(db, GLAXTONS_PLAYBOOK), calendars: new PgCalendarStore(db, cipher) };
  console.log("Persistence: Postgres");
} else {
  console.warn("DATABASE_URL not set; using in-memory stores. Everything is forgotten on restart.");
}

// Multi-instance: Redis carries call events and webhook routing between API processes, and shares rate limits.
let bus: EventBus = new MemoryBus();
let limiter: RateLimiter = new MemoryRateLimiter();
if (cfg.redisUrl) {
  const client = new Redis(cfg.redisUrl, { maxRetriesPerRequest: 3 });
  bus = new RedisBus(client);
  limiter = new RedisRateLimiter(client);
  console.log("Scale-out: Redis bus and shared rate limits");
} else {
  console.log("Single instance: in-memory bus. Set REDIS_URL to run more than one API process.");
}

const mailer: Mailer = cfg.resendApiKey ? new ResendMailer({ apiKey: cfg.resendApiKey, from: cfg.mailFrom }) : new ConsoleMailer();
if (!cfg.resendApiKey) console.warn("RESEND_API_KEY not set; verification, reset and invite emails are printed to the log instead of sent.");

const stripe = cfg.stripeSecretKey ? new StripeClient({ secretKey: cfg.stripeSecretKey, webhookSecret: cfg.stripeWebhookSecret }) : undefined;
const stripePlans: StripePlan[] = [cfg.stripePriceSolo && { id: "solo" as const, priceId: cfg.stripePriceSolo }, cfg.stripePriceTeam && { id: "team" as const, priceId: cfg.stripePriceTeam }].filter((x): x is StripePlan => Boolean(x));
console.log(stripe ? `Billing: Stripe (${stripePlans.map((p) => p.id).join(", ") || "no prices set"})` : "Billing: not configured (STRIPE_SECRET_KEY)");

const crmProviders: Partial<Record<"salesforce" | "hubspot", CrmOAuth>> = {};
if (cfg.sfClientId && cfg.sfClientSecret) crmProviders.salesforce = new SalesforceOAuth({ clientId: cfg.sfClientId, clientSecret: cfg.sfClientSecret, loginUrl: cfg.sfLoginUrl, redirectUri: `${publicUrl}/v1/integrations/crm/salesforce/callback` });
if (cfg.hsClientId && cfg.hsClientSecret) crmProviders.hubspot = new HubSpotOAuth({ clientId: cfg.hsClientId, clientSecret: cfg.hsClientSecret, redirectUri: `${publicUrl}/v1/integrations/crm/hubspot/callback` });
console.log(`CRM providers: ${Object.keys(crmProviders).join(", ") || "none"}`);

const metrics = new Metrics();
const reporter = new ErrorReporter({ webhookUrl: cfg.errorWebhookUrl, service: "the-closer-api" });

const calendarProviders: Partial<Record<CalendarProviderId, CalendarProvider>> = {};
if (cfg.msClientId && cfg.msClientSecret) calendarProviders.microsoft = new MicrosoftCalendar({ clientId: cfg.msClientId, clientSecret: cfg.msClientSecret, tenant: cfg.msTenant, redirectUri: `${publicUrl}/v1/integrations/calendar/microsoft/callback` });
if (cfg.googleClientId && cfg.googleClientSecret) calendarProviders.google = new GoogleCalendar({ clientId: cfg.googleClientId, clientSecret: cfg.googleClientSecret, redirectUri: `${publicUrl}/v1/integrations/calendar/google/callback` });
console.log(`Calendar auto-join providers: ${Object.keys(calendarProviders).join(", ") || "none (set MS_CLIENT_ID/MS_CLIENT_SECRET or GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)"}`);

const { app, calls } = await buildApp({
  ...stores,
  calendarProviders,
  webUrl: cfg.webUrl,
  bus,
  limiter,
  mailer,
  metrics,
  stripe,
  stripePlans,
  crmProviders,
  sendBotChat: recall ? (botId, message) => recall.sendChatMessage(botId, message) : undefined,
  devApiKey: cfg.devApiKey,
  jwtSecret: cfg.jwtSecret,
  secureCookies: cfg.secureCookies,
  makeStt: () => (cfg.deepgramApiKey ? new DeepgramLive(cfg.deepgramApiKey) : new NoopStt()),
  model: models.coach,
  insightModel: models.insight,
  chatModel: models.chat,
  summarise: async (rec) => {
    const store = new TranscriptStore({ maxSegments: 100_000 });
    for (const seg of rec.transcript) store.upsert(seg);
    return summariseCall({ apiKey: cfg.anthropicApiKey, model: cfg.summaryModel, ctx: rec.context, store, events: rec.events });
  },
  recallWebhookSecret: cfg.recallWebhookSecret,
  createBot: recall ? (i) => recall.createBot(i) : undefined,
  onCallEnded: async (s, rec) => {
    app.log.info({ callId: s.ctx.callId, segments: s.store.finals().length, events: s.events.length }, "call ended");
    if (!rec || rec.transcript.length < 4) return;
    try {
      const summary = await summariseCall({ apiKey: cfg.anthropicApiKey, model: cfg.summaryModel, ctx: s.ctx, store: s.store, events: s.events });
      await calls.upsert({ ...rec, summary });
      app.log.info({ callId: s.ctx.callId, outcome: summary.outcome, nextStep: summary.nextStep }, "call summarised");
    } catch (err) {
      app.log.error({ err, callId: s.ctx.callId }, "summary failed");
    }
  },
  logger: true,
});

app.setErrorHandler((err, req, reply) => {
  metrics.inc("errors");
  reporter.report(err, { url: req.url, method: req.method });
  req.log.error({ err }, "unhandled");
  reply.code((err as { statusCode?: number }).statusCode ?? 500).send({ error: "Something went wrong on our side. It has been reported." });
});
process.on("unhandledRejection", (err) => { metrics.inc("errors"); reporter.report(err, { where: "unhandledRejection" }); });

await app.listen({ port: cfg.port, host: "0.0.0.0" });
app.log.info({ publicUrl }, "The Closer API up. Recall webhook must reach PUBLIC_URL/v1/webhooks/recall");
