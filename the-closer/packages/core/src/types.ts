/**
 * Core domain types for The Closer.
 *
 * Speaker attribution is by audio channel, not by diarisation guesswork:
 *   channel 0 = the rep's microphone
 *   channel 1 = everything the rep hears (system audio / meeting bot mix)
 */
export type Speaker = "rep" | "prospect" | "unknown";

export interface TranscriptSegment {
  id: string;
  speaker: Speaker;
  /** Optional participant name when the source can provide it (meeting bot path). */
  participant?: string;
  text: string;
  startMs: number;
  endMs: number;
  isFinal: boolean;
  confidence?: number;
}

export type DealStage =
  | "opening"
  | "discovery"
  | "pitch"
  | "objection"
  | "pricing"
  | "close"
  | "next_steps";

export interface CallContext {
  callId: string;
  rep: { name: string; company: string };
  prospect?: { name?: string; company?: string; role?: string };
  deal?: { stage?: DealStage; product?: string; value?: string; notes?: string };
  playbookId?: string;
  /** Anything the rep typed in before the call: goals, history, landmines. */
  briefing?: string;
}

export type CoachEventType =
  | "say_this"
  | "objection"
  | "question"
  | "warning"
  | "stage_change"
  | "answer"
  | "summary";

export type Priority = 1 | 2 | 3; // 1 = interrupt now, 3 = background hint

export interface CoachEvent {
  id: string;
  type: CoachEventType;
  priority: Priority;
  headline: string;
  /** What to say, verbatim, in the rep's voice. */
  script: string;
  rationale?: string;
  stage?: DealStage;
  triggerSegmentId?: string;
  createdAt: number;
}

export type TriggerReason =
  | "objection_detected"
  | "prospect_question"
  | "prospect_finished"
  | "silence"
  | "rep_monologue"
  | "rep_ask"
  | "stage_check";

export interface Trigger {
  reason: TriggerReason;
  priority: Priority;
  segmentId?: string;
  /** Free text from the rep when reason === "rep_ask". */
  question?: string;
  at: number;
}

export interface CallMetrics {
  repTalkMs: number;
  prospectTalkMs: number;
  /** 0..1, share of speaking time held by the rep. */
  repTalkRatio: number;
  longestRepMonologueMs: number;
  questionsAskedByRep: number;
  objectionsRaised: number;
}

export interface Playbook {
  id: string;
  name: string;
  company: string;
  product: string;
  /** One paragraph: who buys, why, and what "good" looks like. */
  positioning: string;
  idealCustomer: string;
  valueProps: string[];
  proofPoints: string[];
  discoveryQuestions: string[];
  objections: Array<{ trigger: string; response: string }>;
  competitors: Array<{ name: string; counter: string }>;
  /** Stage-specific guidance; keys are DealStage values. */
  stageGuides: Partial<Record<DealStage, string>>;
  tone: string;
  /** Hard rules the model must never break, e.g. "Never quote a discount above 10%". */
  guardrails: string[];
}

/** A document the coach may cite when answering the prospect: pricing, capability, FAQs, case studies. */
export interface KnowledgeDoc {
  id: string;
  title: string;
  /** Plain text. Keep the whole pack under ~150k characters so it stays one cached prefix. */
  body: string;
  tags?: string[];
  updatedAt?: number;
}

export interface Fact {
  /** BANT / MEDDIC style key, e.g. budget, timeline, authority, pain, competitor, current_solution, success_metric. */
  key: string;
  value: string;
  /** Short quote from the prospect that supports the fact. */
  evidence?: string;
  confidence: "low" | "medium" | "high";
}

export interface OpenQuestion {
  question: string;
  /** Why this matters for qualifying or closing. */
  why: string;
  priority: Priority;
}

/** Periodic structured read of the call: what we know, what we still need, and where we are. */
export interface Insight {
  id: string;
  stage: DealStage;
  facts: Fact[];
  answeredQuestions: string[];
  nextQuestions: OpenQuestion[];
  /** Unanswered prospect questions the rep still owes an answer to. */
  openProspectQuestions: string[];
  risks: string[];
  buyingSignals: string[];
  createdAt: number;
}

export type BotStatus = "requested" | "joining" | "waiting_room" | "in_call" | "ended" | "failed";
