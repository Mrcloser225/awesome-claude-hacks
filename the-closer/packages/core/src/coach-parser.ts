import type { CoachEventType, DealStage } from "./types.js";

export interface ParsedCoach {
  type: CoachEventType;
  stage?: DealStage;
  headline: string;
  script: string;
  rationale: string;
}

export type CoachField = "headline" | "script" | "rationale";

const TYPES = new Set<CoachEventType>(["say_this", "objection", "question", "warning", "stage_change", "answer", "summary"]);
const STAGES = new Set<DealStage>(["opening", "discovery", "pitch", "objection", "pricing", "close", "next_steps"]);

/**
 * Incremental parser for the coach output format. Feed it text deltas as they
 * stream; it emits field deltas so the overlay can render SAY while the model
 * is still writing WHY.
 */
export class CoachStreamParser {
  private buffer = "";
  private emitted: Record<CoachField, number> = { headline: 0, script: 0, rationale: 0 };

  constructor(private readonly onDelta: (field: CoachField, text: string) => void) {}

  push(delta: string): void {
    this.buffer += delta;
    const p = this.parse(false);
    this.flush("headline", p.headline);
    this.flush("script", p.script);
    this.flush("rationale", p.rationale);
  }

  finish(): ParsedCoach {
    const p = this.parse(true);
    this.flush("headline", p.headline);
    this.flush("script", p.script);
    this.flush("rationale", p.rationale);
    return p;
  }

  private flush(field: CoachField, value: string): void {
    // Hold back a trailing partial line for SAY and WHY so we never emit a
    // half-written "WHY" label as script text.
    const already = this.emitted[field];
    if (value.length > already) {
      this.onDelta(field, value.slice(already));
      this.emitted[field] = value.length;
    }
  }

  private parse(final: boolean): ParsedCoach {
    const text = this.buffer;
    const type = /^TYPE:\s*(\S+)/m.exec(text)?.[1]?.trim() as CoachEventType | undefined;
    const stage = /^STAGE:\s*(\S+)/m.exec(text)?.[1]?.trim() as DealStage | undefined;
    const headlineMatch = /^HEADLINE:\s*(.*)$/m.exec(text);
    const headlineComplete = headlineMatch ? text.indexOf("\n", headlineMatch.index) !== -1 : false;
    const headline = headlineMatch && (headlineComplete || final) ? headlineMatch[1]!.trim() : "";

    let script = "";
    let rationale = "";
    // Only treat SAY as started once its line has fully arrived (newline seen);
    // otherwise a chunk ending in "SAY:" would make the whole buffer look like script.
    const sayMatch = /^SAY:[ \t]*\n/m.exec(text);
    if (sayMatch) {
      const afterSay = text.slice(sayMatch.index + sayMatch[0].length);
      const whyMatch = /^WHY:\s*(.*)$/m.exec(afterSay);
      if (whyMatch) {
        script = afterSay.slice(0, whyMatch.index).trim();
        rationale = whyMatch[1]!.trim();
        if (!final) {
          // WHY line may still be streaming; only emit once a newline arrives.
          const complete = afterSay.indexOf("\n", whyMatch.index) !== -1;
          if (!complete) rationale = "";
        }
      } else {
        // Script may still be streaming. Do not emit the last (possibly partial) line
        // unless it clearly is not the start of a "WHY:" label.
        const lastNl = afterSay.lastIndexOf("\n");
        const stable = lastNl === -1 ? "" : afterSay.slice(0, lastNl);
        const tail = afterSay.slice(lastNl + 1);
        const tailMightBeLabel = /^W(H(Y(:)?)?)?$/.test(tail.trim());
        script = final ? afterSay.trim() : tailMightBeLabel ? stable.trim() : afterSay.trimEnd();
      }
    }

    return {
      type: type && TYPES.has(type) ? type : "say_this",
      stage: stage && STAGES.has(stage) ? stage : undefined,
      headline,
      script,
      rationale,
    };
  }
}

export function parseCoachText(text: string): ParsedCoach {
  const p = new CoachStreamParser(() => {});
  p.push(text);
  return p.finish();
}
