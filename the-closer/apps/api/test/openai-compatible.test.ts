import { describe, expect, it } from "vitest";
import { OpenAICompatible } from "../src/llm/openai-compatible.js";
import { createModels } from "../src/llm/factory.js";
import { resolveProvider } from "../src/llm/providers.js";

function sse(chunks: string[]): Response {
  const enc = new TextEncoder();
  const frames = chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`);
  frames.push("data: [DONE]\n\n");
  const stream = new ReadableStream({ start(ctrl) { for (const f of frames) ctrl.enqueue(enc.encode(f)); ctrl.close(); } });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

describe("OpenAI-compatible adapter", () => {
  it("streams the coach and chat roles and sends the right wire format", async () => {
    const seen: Array<{ url: string; body: Record<string, unknown>; auth?: string }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      seen.push({ url: String(url), body: JSON.parse(String(init?.body)), auth: (init?.headers as Record<string, string>).Authorization });
      return sse(["TYPE: say_this\n", "HEADLINE: x\nSAY:\nHello ", "there.\nWHY: y\n"]);
    };
    const m = new OpenAICompatible({ baseUrl: "https://api.x.ai/v1/", apiKey: "k", model: "grok-4", fetchImpl });
    let out = "";
    for await (const d of m.stream({ system: "SYS", user: "USER", signal: new AbortController().signal })) out += d;
    expect(out).toContain("Hello there.");
    expect(seen[0]).toMatchObject({ url: "https://api.x.ai/v1/chat/completions", auth: "Bearer k", body: { model: "grok-4", stream: true, messages: [{ role: "system", content: "SYS" }, { role: "user", content: "USER" }] } });

    out = "";
    for await (const d of m.stream({ system: "SYS", messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" }], signal: new AbortController().signal })) out += d;
    expect((seen[1]!.body.messages as unknown[]).length).toBe(4);
  });

  it("extracts the deal picture with JSON mode and validates it", async () => {
    const fetchImpl: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { response_format?: unknown };
      expect(body.response_format).toEqual({ type: "json_object" });
      const content = JSON.stringify({ stage: "discovery", facts: [{ key: "budget", value: "£40k", confidence: "medium" }], answeredQuestions: [], nextQuestions: [{ question: "Who signs?", why: "authority", priority: 1 }], openProspectQuestions: [], risks: [], buyingSignals: [] });
      return new Response(JSON.stringify({ choices: [{ message: { content: "```json\n" + content + "\n```" } }] }), { status: 200 });
    };
    const m = new OpenAICompatible({ baseUrl: "https://api.openai.com/v1", apiKey: "k", model: "gpt-5", fetchImpl });
    const d = await m.extract({ system: "s", user: "u", signal: new AbortController().signal });
    expect(d.facts[0]).toMatchObject({ key: "budget" });
    expect(d.nextQuestions[0]?.priority).toBe(1);
  });

  it("surfaces HTTP errors with the model name", async () => {
    const fetchImpl: typeof fetch = async () => new Response("quota exceeded", { status: 429 });
    const m = new OpenAICompatible({ baseUrl: "https://api.deepseek.com/v1", apiKey: "k", model: "deepseek-chat", fetchImpl });
    await expect(async () => { for await (const _ of m.stream({ system: "s", user: "u", signal: new AbortController().signal })) { /* drain */ } }).rejects.toThrow(/deepseek-chat: 429 quota exceeded/);
  });
});

describe("provider resolution", () => {
  it("defaults to Claude and picks preset keys for others", () => {
    expect(resolveProvider({ ANTHROPIC_API_KEY: "a" } as NodeJS.ProcessEnv)).toMatchObject({ provider: "anthropic", apiKey: "a", model: "claude-opus-5-5" });
    expect(resolveProvider({ LLM_PROVIDER: "google", GEMINI_API_KEY: "g" } as NodeJS.ProcessEnv)).toMatchObject({ provider: "google", apiKey: "g", model: "gemini-2.5-pro", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" });
    expect(resolveProvider({ LLM_PROVIDER: "qwen", LLM_API_KEY: "q", LLM_MODEL: "qwen-max" } as NodeJS.ProcessEnv)).toMatchObject({ provider: "qwen", apiKey: "q", model: "qwen-max" });
    const models = createModels({ provider: "groq", apiKey: "x" }, { effort: "low" });
    expect(models.label).toContain("Groq");
    expect(models.coach).toBe(models.chat);
    expect(() => createModels({ provider: "custom" }, { effort: "low" })).toThrow(/LLM_BASE_URL/);
  });
});
