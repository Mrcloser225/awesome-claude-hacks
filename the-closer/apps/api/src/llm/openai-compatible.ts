import type { CoachModel, InsightDraft, InsightModel } from "@closer/core";
import type { ChatModel, ChatTurn } from "../coach/call-chat.js";
import { InsightSchema } from "../coach/anthropic-insight-model.js";

interface Opts {
  baseUrl: string;
  apiKey?: string;
  model: string;
  /** Extra headers, e.g. OpenRouter's HTTP-Referer / X-Title. */
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  /** Some servers (older Ollama, vLLM configs) reject response_format. */
  jsonMode?: boolean;
  temperature?: number;
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

/**
 * One adapter for every OpenAI-compatible chat-completions endpoint. Implements
 * all three model roles The Closer needs: the streaming coach, the streaming
 * call chat, and the structured deal-picture extractor.
 */
export class OpenAICompatible implements CoachModel, ChatModel, InsightModel {
  constructor(private readonly o: Opts) {}

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json", ...(this.o.apiKey ? { Authorization: `Bearer ${this.o.apiKey}` } : {}), ...(this.o.headers ?? {}) };
  }

  private async *complete(messages: Msg[], signal: AbortSignal, extra: Record<string, unknown> = {}): AsyncIterable<string> {
    const f = this.o.fetchImpl ?? fetch;
    const res = await f(`${this.o.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      signal,
      body: JSON.stringify({ model: this.o.model, messages, stream: true, temperature: this.o.temperature ?? 0.4, ...extra }),
    });
    if (!res.ok || !res.body) throw new Error(`${this.o.model}: ${res.status} ${await res.text().catch(() => "")}`.trim());
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }> };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch { /* keep-alive or partial frame */ }
      }
    }
  }

  // CoachModel
  stream(req: { system: string; user: string; signal: AbortSignal } | { system: string; messages: ChatTurn[]; signal: AbortSignal }): AsyncIterable<string> {
    const msgs: Msg[] = [{ role: "system", content: req.system }];
    if ("user" in req) msgs.push({ role: "user", content: req.user });
    else msgs.push(...req.messages.map((m) => ({ role: m.role, content: m.content })));
    return this.complete(msgs, req.signal);
  }

  // InsightModel
  async extract(req: { system: string; user: string; signal: AbortSignal }): Promise<InsightDraft> {
    const f = this.o.fetchImpl ?? fetch;
    const schemaHint = `Return only JSON with keys: stage (opening|discovery|pitch|objection|pricing|close|next_steps), facts [{key,value,evidence?,confidence(low|medium|high)}], answeredQuestions [string], nextQuestions [{question,why,priority(1|2|3)}], openProspectQuestions [string], risks [string], buyingSignals [string].`;
    const res = await f(`${this.o.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      signal: req.signal,
      body: JSON.stringify({
        model: this.o.model,
        messages: [{ role: "system", content: `${req.system}\n\n${schemaHint}` }, { role: "user", content: req.user }],
        temperature: 0,
        ...(this.o.jsonMode === false ? {} : { response_format: { type: "json_object" } }),
      }),
    });
    if (!res.ok) throw new Error(`${this.o.model}: ${res.status} ${await res.text().catch(() => "")}`.trim());
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = body.choices?.[0]?.message?.content ?? "";
    const jsonText = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = InsightSchema.safeParse(JSON.parse(jsonText));
    if (!parsed.success) throw new Error(`Insight JSON did not match schema: ${parsed.error.message}`);
    return parsed.data as InsightDraft;
  }
}
