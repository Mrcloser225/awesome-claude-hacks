import { useEffect, useRef } from "react";
import type { TranscriptSegment } from "@closer/core";

export function TranscriptTicker({ segments }: { segments: TranscriptSegment[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [segments]);
  return (
    <div className="ticker" ref={ref}>
      {segments.slice(-12).map((s) => (
        <div key={s.id} className={`line line-${s.speaker} ${s.isFinal ? "" : "line-partial"}`}>
          <span className="who">{s.speaker === "rep" ? "You" : s.participant ?? "Them"}</span> {s.text}
        </div>
      ))}
    </div>
  );
}
