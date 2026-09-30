import type { CallContext, Playbook, Trigger } from "./types.js";

/**
 * Builds the two halves of every coach request.
 *
 * `system()` is deterministic for a given playbook and call context so that it
 * is a stable, cacheable prefix. Everything volatile (transcript, trigger)
 * goes into the user turn.
 */
export const COACH_OUTPUT_FORMAT = `Respond in exactly this format and nothing else:
TYPE: <say_this|objection|question|warning|stage_change|answer>
STAGE: <opening|discovery|pitch|objection|pricing|close|next_steps>
HEADLINE: <max 8 words, what is happening>
SAY:
<the exact words the rep should say next, first person, spoken English, 1 to 4 sentences, no bullet points>
WHY: <one sentence on why this works now>`;

export function buildSystemPrompt(playbook: Playbook, ctx: CallContext): string {
  const objections = playbook.objections.map((o) => `- When they say "${o.trigger}": ${o.response}`).join("\n");
  const competitors = playbook.competitors.map((c) => `- ${c.name}: ${c.counter}`).join("\n");
  const stages = Object.entries(playbook.stageGuides)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  const guardrails = playbook.guardrails.map((g) => `- ${g}`).join("\n");

  return [
    `You are The Closer, a live sales coach whispering to ${ctx.rep.name} at ${ctx.rep.company} during a real call. The rep reads your output off a private overlay while the prospect is talking or has just finished. You have one job: give the rep the single best next thing to say, ready to speak out loud.`,
    ``,
    `Rules:`,
    `- Write words the rep can say verbatim. Spoken English. Contractions are fine. No hedging, no "you could try".`,
    `- Keep it short. A rep can read about 25 words in the time a prospect pauses. Prefer one strong sentence and one question.`,
    `- Acknowledge, then reframe, then ask. Never argue with the prospect.`,
    `- Use the playbook evidence below. Never invent numbers, clients, case studies or capabilities that are not in the playbook or the briefing.`,
    `- If the prospect asked a factual question the playbook cannot answer, tell the rep to say they will confirm and move on. Do not guess.`,
    `- UK English. No emoji. No bullet points inside SAY.`,
    `- If the rep is talking too much, say so bluntly in a warning and give them a question to hand the floor back.`,
    ``,
    `# Playbook: ${playbook.name}`,
    `Company: ${playbook.company}`,
    `Product: ${playbook.product}`,
    `Positioning: ${playbook.positioning}`,
    `Ideal customer: ${playbook.idealCustomer}`,
    `Tone: ${playbook.tone}`,
    ``,
    `## Value propositions`,
    playbook.valueProps.map((v) => `- ${v}`).join("\n"),
    ``,
    `## Proof points (only cite these)`,
    playbook.proofPoints.map((p) => `- ${p}`).join("\n"),
    ``,
    `## Discovery questions worth asking`,
    playbook.discoveryQuestions.map((q) => `- ${q}`).join("\n"),
    ``,
    `## Objection handling`,
    objections || "- (none supplied)",
    ``,
    `## Competitors`,
    competitors || "- (none supplied)",
    ``,
    `## Stage guidance`,
    stages || "- (none supplied)",
    ``,
    `## Guardrails (never break these)`,
    guardrails || "- (none supplied)",
    ``,
    `# This call`,
    `Rep: ${ctx.rep.name}, ${ctx.rep.company}`,
    ctx.prospect
      ? `Prospect: ${ctx.prospect.name ?? "unknown"}${ctx.prospect.role ? `, ${ctx.prospect.role}` : ""}${ctx.prospect.company ? ` at ${ctx.prospect.company}` : ""}`
      : `Prospect: unknown`,
    ctx.deal?.product ? `Product in play: ${ctx.deal.product}` : "",
    ctx.deal?.value ? `Deal value: ${ctx.deal.value}` : "",
    ctx.deal?.notes ? `Deal notes: ${ctx.deal.notes}` : "",
    ctx.briefing ? `\nRep briefing:\n${ctx.briefing}` : "",
    ``,
    COACH_OUTPUT_FORMAT,
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

const REASON_TEXT: Record<Trigger["reason"], string> = {
  objection_detected: "The prospect just raised what sounds like an objection. Handle it.",
  prospect_question: "The prospect just asked a question. Give the rep the answer to say, or the way to handle it if the answer is not in the playbook.",
  prospect_finished: "The prospect just finished a turn. Give the rep the best next line.",
  silence: "There has been a pause after the prospect spoke. Give the rep something to say to move the call forward.",
  rep_monologue: "The rep has been talking for a long time. Warn them and give them a question to hand the floor back.",
  rep_ask: "The rep has asked you directly for help (see their question). Answer that.",
  stage_check: "Assess which stage the call is at and give the rep the best next line for that stage.",
};

export function buildUserPrompt(transcript: string, trigger: Trigger, metrics?: { repTalkRatio: number }): string {
  const parts = [
    `## Transcript so far (most recent last)`,
    transcript || "(nothing yet)",
    ``,
    `## Situation`,
    REASON_TEXT[trigger.reason],
  ];
  if (trigger.question) parts.push(`Rep's question: ${trigger.question}`);
  if (metrics) parts.push(`Rep talk share so far: ${Math.round(metrics.repTalkRatio * 100)}%`);
  parts.push(``, `Give the next line now.`);
  return parts.join("\n");
}
