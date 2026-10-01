import type { CoachModel, InsightModel } from "@closer/core";
import { AnthropicCoachModel } from "../coach/anthropic-model.js";
import { AnthropicInsightModel } from "../coach/anthropic-insight-model.js";
import { AnthropicChatModel, type ChatModel } from "../coach/call-chat.js";
import { OpenAICompatible } from "./openai-compatible.js";
import { PROVIDERS, type ProviderConfig } from "./providers.js";

export interface Models { coach: CoachModel; chat: ChatModel; insight: InsightModel; label: string }

export function createModels(cfg: ProviderConfig, opts: { effort: "low" | "medium" | "high"; webSearch?: boolean; insightModel?: string; chatModel?: string }): Models {
  if (cfg.provider === "anthropic") {
    const model = cfg.model ?? PROVIDERS.anthropic.defaultModel;
    return {
      coach: new AnthropicCoachModel({ apiKey: cfg.apiKey, model, effort: opts.effort, webSearch: opts.webSearch }),
      chat: new AnthropicChatModel({ apiKey: cfg.apiKey, model: opts.chatModel ?? model }),
      insight: new AnthropicInsightModel({ apiKey: cfg.apiKey, model: opts.insightModel ?? model }),
      label: `Claude ${model}`,
    };
  }
  const preset = PROVIDERS[cfg.provider];
  const baseUrl = cfg.baseUrl || preset.baseUrl;
  const model = cfg.model || preset.defaultModel;
  if (!baseUrl || !model) throw new Error(`LLM_PROVIDER=${cfg.provider} needs LLM_BASE_URL and LLM_MODEL`);
  const headers = cfg.provider === "openrouter" ? { "HTTP-Referer": "https://thecloser.ai", "X-Title": "The Closer" } : undefined;
  const shared = new OpenAICompatible({ baseUrl, apiKey: cfg.apiKey, model, headers, jsonMode: preset.jsonMode });
  return { coach: shared, chat: shared, insight: shared, label: `${preset.label} ${model}` };
}
