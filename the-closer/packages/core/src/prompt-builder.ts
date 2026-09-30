import type { CallContext, Insight, KnowledgeDoc, Playbook, Trigger } from "./types.js";

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

export function buildKnowledgePack(docs: KnowledgeDoc[], maxChars = 150_000): string {
  if (docs.length === 0) return "";
  const sorted = [...docs].sort((a, b) => a.id.localeCompare(b.id)); // deterministic order keeps the cache prefix stable
  const parts: string[] = ["# Knowledge base (cite only what is here; quote figures exactly)"];
  let used = parts[0]!.length;
  for (const d of sorted) {
    const block = `\n## ${d.title}${d.tags?.length ? ` [${d.tags.join(", ")}]` : ""}\n${d.body.trim()}`;
    if (used + block.length > maxChars) break;
    parts.push(block);
    used += block.length;
  }
  return parts.join("\n");
}

export function buildSystemPrompt(playbook: Playbook, ctx: CallContext, knowledge: KnowledgeDoc[] = []): string {
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
    `- When the prospect asks a question, answer it. Pull the answer from the playbook or the knowledge base and put it in the rep's mouth in one or two sentences, then add a question that moves the call forward. If the answer is genuinely not in the material, give the rep an honest holding line ("I'll confirm that in writing today") and a bridge. Never guess a number, a date, a client name or a capability.`,
    `- Ask the right questions. When nothing urgent is happening, the best next line is usually the highest-value unanswered discovery question: budget, timeline, decision process, what happens if they do nothing, what success looks like. Prefer the questions the transcript shows are still open.`,
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
    buildKnowledgePack(knowledge),
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

export function renderInsight(insight: Insight | null | undefined): string {
  if (!insight) return "";
  const facts = insight.facts.map((f) => `- ${f.key}: ${f.value} (${f.confidence})`).join("\n");
  const next = insight.nextQuestions.map((q) => `- ${q.question}`).join("\n");
  const owed = insight.openProspectQuestions.map((q) => `- ${q}`).join("\n");
  return [
    `## What we know so far (stage: ${insight.stage})`,
    facts || "- nothing confirmed yet",
    `## Discovery questions still open (highest value first)`,
    next || "- none",
    owed ? `## Prospect questions we still owe an answer to\n${owed}` : "",
    insight.risks.length ? `## Risks\n${insight.risks.map((r) => `- ${r}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

export function buildUserPrompt(
  transcript: string,
  trigger: Trigger,
  metrics?: { repTalkRatio: number },
  insight?: Insight | null,
): string {
  const parts = [
    renderInsight(insight),
    `## Transcript so far (most recent last)`,
    transcript || "(nothing yet)",
    ``,
    `## Situation`,
    REASON_TEXT[trigger.reason],
  ].filter((p) => p !== "");
  if (trigger.question) parts.push(`Rep's question: ${trigger.question}`);
  if (metrics) parts.push(`Rep talk share so far: ${Math.round(metrics.repTalkRatio * 100)}%`);
  parts.push(``, `Give the next line now.`);
  return parts.join("\n");
}

/** System prompt for the periodic structured read of the call. Stable per call, so cacheable. */
export function buildInsightSystemPrompt(playbook: Playbook, ctx: CallContext): string {
  return [
    `You are the analyst behind a live sales coach. Every minute or so you read the transcript of ${ctx.rep.name}'s call and return a structured picture of the deal so the coach can ask the right next question.`,
    `Extract only what the prospect actually said or clearly implied. Quote evidence. Mark confidence honestly.`,
    `Facts use these keys where they fit: pain, current_solution, budget, timeline, authority, decision_process, competitor, success_metric, volume, objection, next_step.`,
    `Next questions: the three to five highest-value questions still unanswered, drawn from the playbook list below or from gaps you see. Order by value to qualifying and closing.`,
    `Open prospect questions: anything the prospect asked that the rep has not yet answered properly.`,
    ``,
    `Playbook discovery questions:`,
    playbook.discoveryQuestions.map((q) => `- ${q}`).join("\n"),
    ``,
    `Stage definitions:`,
    Object.entries(playbook.stageGuides).map(([k, v]) => `- ${k}: ${v}`).join("\n"),
  ].join("\n");
}

export function buildInsightUserPrompt(transcript: string, previous: Insight | null): string {
  return [
    previous ? `## Previous read\n${JSON.stringify({ stage: previous.stage, facts: previous.facts, answeredQuestions: previous.answeredQuestions })}` : "",
    `## Transcript so far (most recent last)`,
    transcript || "(nothing yet)",
    ``,
    `Return the updated picture. Carry forward earlier facts unless the transcript contradicts them.`,
  ].filter(Boolean).join("\n");
}
