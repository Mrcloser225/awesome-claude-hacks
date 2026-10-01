import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { createModels } from "./llm/factory.js";
import { resolveProvider } from "./llm/providers.js";
import { summariseCall } from "./coach/summary.js";
import { TranscriptStore } from "@closer/core";
import { DeepgramLive } from "./stt/deepgram.js";
import { NoopStt } from "./stt/none.js";
import { RecallClient } from "./recall-client.js";

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

const { app, calls } = await buildApp({
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

await app.listen({ port: cfg.port, host: "0.0.0.0" });
app.log.info({ publicUrl }, "The Closer API up. Recall webhook must reach PUBLIC_URL/v1/webhooks/recall");
