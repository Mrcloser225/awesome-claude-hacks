/**
 * Fast-path objection and question detection.
 * This is deliberately cheap and recall-oriented: it decides *whether* to wake
 * the model with high priority. The model does the real classification.
 */
export type ObjectionCategory =
  | "price"
  | "budget"
  | "timing"
  | "authority"
  | "competitor"
  | "status_quo"
  | "trust"
  | "need"
  | "brush_off";

const PATTERNS: Array<{ category: ObjectionCategory; re: RegExp }> = [
  { category: "price", re: /\b(too expensive|expensive|pricey|cost(s)? too much|cheaper|price is|what does it cost|how much)\b/i },
  { category: "budget", re: /\b(no budget|budget('s| is| has been)? (gone|spent|frozen|tight|cut)|can'?t afford|out of budget|don'?t have (the )?budget)\b/i },
  { category: "timing", re: /\b(not (the )?right time|bad time|not now|next quarter|next year|later in the year|revisit|circle back|too busy|in (a few|six) months)\b/i },
  { category: "authority", re: /\b(not my (decision|call)|need to (check|speak|talk|run it)|my (boss|director|board|manager|partner)|sign[- ]?off|decision maker|procurement)\b/i },
  { category: "competitor", re: /\b(already (use|using|have|work with)|we'?re with|another (vendor|supplier|provider|agency)|competitor|quote from|comparing|other options|shopping around)\b/i },
  { category: "status_quo", re: /\b(happy with|works fine|in[- ]house|do it ourselves|current (process|setup|supplier|team)|no need to change)\b/i },
  { category: "trust", re: /\b(never heard of|how long have you|too small|too new|references|case stud(y|ies)|guarantee|what if it doesn'?t)\b/i },
  { category: "need", re: /\b(don'?t (really )?need|not a priority|not relevant|doesn'?t apply|we'?re fine)\b/i },
  { category: "brush_off", re: /\b(send me (some|an|the) (info|information|email|deck|details)|send (it|something) over|email me|think about it|get back to you|leave it with me)\b/i },
];

export function detectObjection(text: string): ObjectionCategory | null {
  for (const p of PATTERNS) if (p.re.test(text)) return p.category;
  return null;
}

const QUESTION_START = /^(what|why|how|when|where|who|which|can|could|would|do|does|did|is|are|will|should|have|has|any chance|what'?s)\b/i;

export function isQuestion(text: string): boolean {
  const t = text.trim();
  if (t.endsWith("?")) return true;
  return QUESTION_START.test(t) && t.split(/\s+/).length >= 3;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
