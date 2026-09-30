import type { CallMetrics, Speaker, TranscriptSegment } from "./types.js";

/**
 * Rolling transcript with per-speaker talk-time accounting.
 * Partial segments are replaced in place (keyed by id) until they finalise.
 */
export class TranscriptStore {
  private segments: TranscriptSegment[] = [];
  private readonly maxSegments: number;

  constructor(opts: { maxSegments?: number } = {}) {
    this.maxSegments = opts.maxSegments ?? 400;
  }

  upsert(segment: TranscriptSegment): void {
    const idx = this.segments.findIndex((s) => s.id === segment.id);
    if (idx >= 0) {
      this.segments[idx] = segment;
    } else {
      this.segments.push(segment);
      if (this.segments.length > this.maxSegments) this.segments.shift();
    }
  }

  all(): readonly TranscriptSegment[] {
    return this.segments;
  }

  finals(): TranscriptSegment[] {
    return this.segments.filter((s) => s.isFinal);
  }

  last(n = 1): TranscriptSegment[] {
    return this.segments.slice(-n);
  }

  lastFinalBy(speaker: Speaker): TranscriptSegment | undefined {
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const s = this.segments[i];
      if (s && s.isFinal && s.speaker === speaker) return s;
    }
    return undefined;
  }

  /** Recent transcript rendered as dialogue, newest last, trimmed to a character budget. */
  render(opts: { maxChars?: number; finalsOnly?: boolean; repLabel?: string; prospectLabel?: string } = {}): string {
    const maxChars = opts.maxChars ?? 6000;
    const repLabel = opts.repLabel ?? "REP";
    const prospectLabel = opts.prospectLabel ?? "PROSPECT";
    const lines: string[] = [];
    let used = 0;
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const s = this.segments[i]!;
      if (opts.finalsOnly && !s.isFinal) continue;
      const label = s.speaker === "rep" ? repLabel : s.speaker === "prospect" ? prospectLabel : "UNKNOWN";
      const line = `${label}${s.participant ? ` (${s.participant})` : ""}: ${s.text.trim()}`;
      if (used + line.length > maxChars) break;
      lines.push(line);
      used += line.length + 1;
    }
    return lines.reverse().join("\n");
  }

  metrics(): CallMetrics {
    let repTalkMs = 0;
    let prospectTalkMs = 0;
    let longestRepMonologueMs = 0;
    let currentRepRun = 0;
    let questionsAskedByRep = 0;
    for (const s of this.segments) {
      if (!s.isFinal) continue;
      const dur = Math.max(0, s.endMs - s.startMs);
      if (s.speaker === "rep") {
        repTalkMs += dur;
        currentRepRun += dur;
        longestRepMonologueMs = Math.max(longestRepMonologueMs, currentRepRun);
        if (/\?\s*$/.test(s.text.trim())) questionsAskedByRep++;
      } else {
        if (s.speaker === "prospect") prospectTalkMs += dur;
        currentRepRun = 0;
      }
    }
    const total = repTalkMs + prospectTalkMs;
    return {
      repTalkMs,
      prospectTalkMs,
      repTalkRatio: total === 0 ? 0 : repTalkMs / total,
      longestRepMonologueMs,
      questionsAskedByRep,
      objectionsRaised: 0, // filled in by the coach engine from classified events
    };
  }

  clear(): void {
    this.segments = [];
  }
}
