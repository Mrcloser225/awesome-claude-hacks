import Anthropic from "@anthropic-ai/sdk";
import type { CoachModel } from "@closer/core";

/**
 * Streams coach output from Claude.
 *
 * - The system prompt is marked cacheable: it is identical for every trigger in
 *   a call, so after the first request only the transcript delta is billed at
 *   full price.
 * - Effort is low by default: the coach needs a fast, short answer, not a deep
 *   reasoning pass. Raise to medium for complex enterprise playbooks.
 * - Server-side fallbacks are enabled so a safety-classifier refusal on the
 *   primary model is re-run on a fallback inside the same request rather than
 *   leaving the rep with a blank card.
 */
export class AnthropicCoachModel implements CoachModel {
  private readonly client: Anthropic;

  constructor(
    private readonly opts: {
      apiKey?: string;
      model: string;
      effort: "low" | "medium" | "high";
      maxTokens?: number;
      /**
       * Let the coach search the web when the prospect asks something outside the
       * playbook and knowledge base (a regulation, a competitor's pricing, a news item).
       * Adds seconds of latency when used, so the prompt tells the model to search only
       * when the answer is not in the material. Off by default.
       */
      webSearch?: boolean;
    },
  ) {
    this.client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
  }

  async *stream(req: { system: string; user: string; signal: AbortSignal }): AsyncIterable<string> {
    const params: Anthropic.Beta.Messages.MessageCreateParamsStreaming = {
      model: this.opts.model,
      max_tokens: this.opts.maxTokens ?? 400,
      betas: ["server-side-fallback-2026-07-01"],
      output_config: { effort: this.opts.effort },
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: req.user }],
      stream: true,
      ...(this.opts.webSearch
        ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 2 } as Anthropic.Beta.Messages.BetaToolUnion] }
        : {}),
    };
    // `fallbacks: "default"` is the server-side refusal fallback (beta header above).
    // The installed SDK types do not yet declare the field, so it is spread in untyped.
    const stream = this.client.beta.messages.stream(
      { ...params, fallbacks: "default" } as typeof params,
      { signal: req.signal },
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      throw new Error("Coach model declined this request");
    }
  }
}
