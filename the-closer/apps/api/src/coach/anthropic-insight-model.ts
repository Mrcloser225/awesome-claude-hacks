import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { InsightDraft, InsightModel } from "@closer/core";

const Priority = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const InsightSchema = z.object({
  stage: z.enum(["opening", "discovery", "pitch", "objection", "pricing", "close", "next_steps"]),
  facts: z.array(z.object({ key: z.string(), value: z.string(), evidence: z.string().optional(), confidence: z.enum(["low", "medium", "high"]) })),
  answeredQuestions: z.array(z.string()),
  nextQuestions: z.array(z.object({ question: z.string(), why: z.string(), priority: Priority })),
  openProspectQuestions: z.array(z.string()),
  risks: z.array(z.string()),
  buyingSignals: z.array(z.string()),
});

/** Structured read of the call using Claude structured outputs. Off the critical path. */
export class AnthropicInsightModel implements InsightModel {
  private readonly client: Anthropic;
  constructor(private readonly opts: { apiKey?: string; model: string; effort?: "low" | "medium" | "high" }) {
    this.client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
  }

  async extract(req: { system: string; user: string; signal: AbortSignal }): Promise<InsightDraft> {
    const response = await this.client.messages.parse(
      {
        model: this.opts.model,
        max_tokens: 4000,
        output_config: { effort: this.opts.effort ?? "low", format: zodOutputFormat(InsightSchema) },
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: req.user }],
      },
      { signal: req.signal },
    );
    if (!response.parsed_output) throw new Error("Insight parse failed");
    return response.parsed_output as InsightDraft;
  }
}
