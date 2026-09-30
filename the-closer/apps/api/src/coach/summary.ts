import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { CallContext, CoachEvent, TranscriptStore } from "@closer/core";

export const CallSummarySchema = z.object({
  outcome: z.enum(["won", "advanced", "stalled", "lost", "unclear"]),
  oneLine: z.string(),
  prospectPains: z.array(z.string()),
  objectionsRaised: z.array(z.object({ objection: z.string(), handled: z.boolean(), note: z.string() })),
  commitments: z.array(z.object({ owner: z.enum(["rep", "prospect"]), action: z.string(), due: z.string().optional() })),
  nextStep: z.string(),
  dealStage: z.enum(["opening", "discovery", "pitch", "objection", "pricing", "close", "next_steps"]),
  coachingNotes: z.array(z.string()),
  crmNote: z.string(),
  followUpEmail: z.object({ subject: z.string(), body: z.string() }),
});
export type CallSummary = z.infer<typeof CallSummarySchema>;

export async function summariseCall(opts: {
  apiKey?: string;
  model: string;
  ctx: CallContext;
  store: TranscriptStore;
  events: CoachEvent[];
}): Promise<CallSummary> {
  const client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
  const transcript = opts.store.render({ maxChars: 120_000, finalsOnly: true });
  const coachLog = opts.events.map((e) => `[${e.type}] ${e.headline}: ${e.script}`).join("\n");

  const response = await client.messages.parse({
    model: opts.model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system:
      "You are a senior sales manager writing up a call for the CRM and coaching the rep. Be specific, quote the prospect where useful, never invent facts not in the transcript. UK English. The follow-up email must be in the rep's voice, short, with one clear next step.",
    messages: [
      {
        role: "user",
        content: `Rep: ${opts.ctx.rep.name} (${opts.ctx.rep.company})\nProspect: ${opts.ctx.prospect?.name ?? "unknown"} ${opts.ctx.prospect?.company ?? ""}\n\n## Transcript\n${transcript}\n\n## Live coaching given during the call\n${coachLog || "(none)"}\n\nWrite the summary.`,
      },
    ],
    output_config: { format: zodOutputFormat(CallSummarySchema) },
  });
  if (!response.parsed_output) throw new Error("Summary parse failed");
  return response.parsed_output;
}
