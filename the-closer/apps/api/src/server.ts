import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { DevAuth } from "./auth.js";
import { AnthropicCoachModel } from "./coach/anthropic-model.js";
import { DeepgramLive } from "./stt/deepgram.js";
import { NoopStt } from "./stt/none.js";
import { RecallClient } from "./recall-client.js";

const cfg = loadConfig();

if (!cfg.anthropicApiKey) console.warn("ANTHROPIC_API_KEY not set; relying on ant auth profile or env token");
if (!cfg.deepgramApiKey) console.warn("DEEPGRAM_API_KEY not set; audio streaming disabled, transcript.push still works");

const recall = cfg.recallApiKey
  ? new RecallClient({ apiKey: cfg.recallApiKey, region: cfg.recallRegion, webhookUrl: `${process.env.PUBLIC_URL ?? `http://localhost:${cfg.port}`}/v1/webhooks/recall` })
  : undefined;

const app = await buildApp({
  auth: new DevAuth(cfg.devApiKey),
  makeStt: () => (cfg.deepgramApiKey ? new DeepgramLive(cfg.deepgramApiKey) : new NoopStt()),
  model: new AnthropicCoachModel({ apiKey: cfg.anthropicApiKey, model: cfg.coachModel, effort: cfg.coachEffort }),
  recallWebhookSecret: cfg.recallWebhookSecret,
  createBot: recall ? (i) => recall.createBot(i) : undefined,
  onCallEnded: (s) => {
    app.log.info({ callId: s.ctx.callId, segments: s.store.finals().length, events: s.events.length }, "call ended");
  },
  logger: true,
});

await app.listen({ port: cfg.port, host: "0.0.0.0" });
