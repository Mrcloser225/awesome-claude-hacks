export interface ApiConfig {
  port: number;
  anthropicApiKey?: string;
  deepgramApiKey?: string;
  devApiKey?: string;
  coachModel: string;
  coachEffort: "low" | "medium" | "high";
  summaryModel: string;
  databaseUrl?: string;
  recallApiKey?: string;
  recallRegion: string;
  recallWebhookSecret?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const effort = env.COACH_EFFORT ?? "low";
  return {
    port: Number(env.PORT ?? 8787),
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    deepgramApiKey: env.DEEPGRAM_API_KEY,
    devApiKey: env.CLOSER_DEV_API_KEY,
    coachModel: env.COACH_MODEL ?? "claude-opus-5-5",
    coachEffort: effort === "medium" || effort === "high" ? effort : "low",
    summaryModel: env.SUMMARY_MODEL ?? "claude-opus-5-5",
    databaseUrl: env.DATABASE_URL,
    recallApiKey: env.RECALL_API_KEY,
    recallRegion: env.RECALL_REGION ?? "us-east-1",
    recallWebhookSecret: env.RECALL_WEBHOOK_SECRET,
  };
}
