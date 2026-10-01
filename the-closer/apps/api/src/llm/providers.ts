/**
 * Model providers. Claude is the native path (prompt caching, structured
 * outputs, refusal fallback). Everyone else speaks the OpenAI chat-completions
 * dialect, so one adapter covers OpenAI, xAI Grok, Google Gemini, Alibaba
 * Qwen, DeepSeek, Mistral, Groq, OpenRouter, a local Ollama, or any custom
 * OpenAI-compatible endpoint.
 */
export type ProviderId = "anthropic" | "openai" | "xai" | "google" | "qwen" | "deepseek" | "mistral" | "groq" | "openrouter" | "ollama" | "custom";

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  baseUrl: string;
  defaultModel: string;
  /** Environment variable conventionally holding the key. */
  keyEnv: string;
  /** Whether the endpoint supports response_format json_object (used for the deal picture). */
  jsonMode: boolean;
  docs: string;
}

export const PROVIDERS: Record<ProviderId, ProviderPreset> = {
  anthropic: { id: "anthropic", label: "Claude (Anthropic)", baseUrl: "https://api.anthropic.com", defaultModel: "claude-opus-5-5", keyEnv: "ANTHROPIC_API_KEY", jsonMode: true, docs: "https://platform.claude.com/docs" },
  openai: { id: "openai", label: "OpenAI (ChatGPT models)", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-5", keyEnv: "OPENAI_API_KEY", jsonMode: true, docs: "https://platform.openai.com/docs" },
  xai: { id: "xai", label: "xAI Grok", baseUrl: "https://api.x.ai/v1", defaultModel: "grok-4", keyEnv: "XAI_API_KEY", jsonMode: true, docs: "https://docs.x.ai" },
  google: { id: "google", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.5-pro", keyEnv: "GEMINI_API_KEY", jsonMode: true, docs: "https://ai.google.dev/gemini-api/docs/openai" },
  qwen: { id: "qwen", label: "Alibaba Qwen", baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus", keyEnv: "DASHSCOPE_API_KEY", jsonMode: true, docs: "https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope" },
  deepseek: { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat", keyEnv: "DEEPSEEK_API_KEY", jsonMode: true, docs: "https://api-docs.deepseek.com" },
  mistral: { id: "mistral", label: "Mistral", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-large-latest", keyEnv: "MISTRAL_API_KEY", jsonMode: true, docs: "https://docs.mistral.ai" },
  groq: { id: "groq", label: "Groq (open models, fast)", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile", keyEnv: "GROQ_API_KEY", jsonMode: true, docs: "https://console.groq.com/docs/openai" },
  openrouter: { id: "openrouter", label: "OpenRouter (hundreds of models)", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "anthropic/claude-sonnet-4.5", keyEnv: "OPENROUTER_API_KEY", jsonMode: true, docs: "https://openrouter.ai/docs" },
  ollama: { id: "ollama", label: "Ollama (local)", baseUrl: "http://localhost:11434/v1", defaultModel: "llama3.1", keyEnv: "OLLAMA_API_KEY", jsonMode: true, docs: "https://github.com/ollama/ollama/blob/main/docs/openai.md" },
  custom: { id: "custom", label: "Custom OpenAI-compatible endpoint", baseUrl: "", defaultModel: "", keyEnv: "LLM_API_KEY", jsonMode: false, docs: "" },
};

export interface ProviderConfig {
  provider: ProviderId;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export function resolveProvider(env: NodeJS.ProcessEnv): ProviderConfig {
  const id = (env.LLM_PROVIDER ?? "anthropic") as ProviderId;
  const preset = PROVIDERS[id] ?? PROVIDERS.anthropic;
  return {
    provider: preset.id,
    apiKey: env.LLM_API_KEY ?? env[preset.keyEnv],
    baseUrl: env.LLM_BASE_URL ?? preset.baseUrl,
    model: env.LLM_MODEL ?? (preset.id === "anthropic" ? env.COACH_MODEL ?? preset.defaultModel : preset.defaultModel),
  };
}

/** Public, key-free view for the settings UI. */
export function listProviders(): Array<Omit<ProviderPreset, "keyEnv">> {
  return Object.values(PROVIDERS).map(({ keyEnv: _k, ...p }) => p);
}
