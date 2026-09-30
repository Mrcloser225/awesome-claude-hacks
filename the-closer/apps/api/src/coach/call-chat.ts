import Anthropic from "@anthropic-ai/sdk";
import { buildKnowledgePack, renderInsight, type CallContext, type Insight, type KnowledgeDoc, type Playbook, type TranscriptSegment } from "@closer/core";

export interface ChatTurn { role: "user" | "assistant"; content: string }

export interface ChatModel {
  stream(req: { system: string; messages: ChatTurn[]; signal: AbortSignal }): AsyncIterable<string>;
}

/**
 * The "Claude, help me on this call" thread. Works the same way you would work
 * with a Fireflies transcript pasted into Claude, except the transcript is live
 * and already in front of the model, along with the playbook, the knowledge
 * base and the running deal picture.
 */
export function buildChatSystemPrompt(playbook: Playbook, ctx: CallContext, knowledge: KnowledgeDoc[]): string {
  return [
    `You are The Closer, working a sales call with ${ctx.rep.name} at ${ctx.rep.company}. You can see the transcript. ${ctx.rep.name} is talking to you in a private side chat during or after the call.`,
    `Do what they ask: draft what to say, answer the prospect's question with the material below, explain what the prospect meant, spot the objection under the objection, write the follow-up, score the call, plan the close. Be direct and specific. Quote the transcript when it helps. Never invent numbers, clients or capabilities that are not in the playbook, knowledge base or transcript.`,
    `When they ask for words to say, write them in first person, spoken English, ready to read out. UK English. No bullet points in spoken lines.`,
    ``,
    `# Playbook: ${playbook.name}`,
    `Company: ${playbook.company}. Product: ${playbook.product}.`,
    `Positioning: ${playbook.positioning}`,
    `Value propositions:\n${playbook.valueProps.map((v) => `- ${v}`).join("\n")}`,
    `Proof points (only cite these):\n${playbook.proofPoints.map((p) => `- ${p}`).join("\n")}`,
    `Objection handling:\n${playbook.objections.map((o) => `- "${o.trigger}": ${o.response}`).join("\n")}`,
    `Guardrails:\n${playbook.guardrails.map((g) => `- ${g}`).join("\n")}`,
    ctx.briefing ? `\nRep briefing:\n${ctx.briefing}` : "",
    ``,
    buildKnowledgePack(knowledge),
  ].join("\n");
}

export function buildChatUserTurn(transcript: TranscriptSegment[], insight: Insight | null, question: string, live: boolean): string {
  const lines = transcript.filter((s) => s.isFinal).map((s) => `${s.speaker === "rep" ? "REP" : s.participant?.toUpperCase() ?? "PROSPECT"}: ${s.text}`).join("\n");
  return [
    `## Transcript${live ? " so far (call is live)" : " (call has ended)"}`,
    lines || "(nothing yet)",
    renderInsight(insight),
    ``,
    `## ${live ? "Rep asks, mid-call" : "Rep asks"}`,
    question,
  ].filter((p) => p !== "").join("\n");
}

export class AnthropicChatModel implements ChatModel {
  private readonly client: Anthropic;
  constructor(private readonly opts: { apiKey?: string; model: string; effort?: "low" | "medium" | "high" }) {
    this.client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
  }
  async *stream(req: { system: string; messages: ChatTurn[]; signal: AbortSignal }): AsyncIterable<string> {
    const stream = this.client.messages.stream(
      {
        model: this.opts.model,
        max_tokens: 4000,
        output_config: { effort: this.opts.effort ?? "medium" },
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: req.messages,
      },
      { signal: req.signal },
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") throw new Error("The model declined this request");
  }
}
