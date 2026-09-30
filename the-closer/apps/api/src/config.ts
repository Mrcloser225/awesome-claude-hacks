export interface ApiConfig {
  port: number;
  anthropicApiKey?: string;
  deepgramApiKey?: string;
  devApiKey?: string;
  coachModel: string;
  coachEffort: "low" | "medium" | "high";
  summaryModel: string;
  insightModel: string;
  chatModel: string;
  jwtSecret: string;
  secureCookies: boolean;
  coachWebSearch: boolean;
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
    insightModel: env.INSIGHT_MODEL ?? env.COACH_MODEL ?? "claude-opus-5-5",
    chatModel: env.CHAT_MODEL ?? "claude-opus-5-5",
    jwtSecret: env.JWT_SECRET ?? "dev-only-secret-change-me",
    secureCookies: (env.SECURE_COOKIES ?? (env.NODE_ENV === "production" ? "true" : "false")) === "true",
    coachWebSearch: (env.COACH_WEB_SEARCH ?? "false").toLowerCase() === "true",
    databaseUrl: env.DATABASE_URL,
    recallApiKey: env.RECALL_API_KEY,
    recallRegion: env.RECALL_REGION ?? "us-east-1",
    recallWebhookSecret: env.RECALL_WEBHOOK_SECRET,
  };
}
