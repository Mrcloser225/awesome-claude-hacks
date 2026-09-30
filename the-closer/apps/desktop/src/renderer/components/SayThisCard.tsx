import type { LiveCard } from "../hooks/useLiveSession";

const LABEL: Record<string, string> = {
  say_this: "Say this",
  objection: "Objection",
  question: "They asked",
  warning: "Heads up",
  stage_change: "Stage",
  answer: "Answer",
  summary: "Summary",
};

export function SayThisCard({ card }: { card: LiveCard | null }) {
  if (!card) {
    return (
      <div className="card card-empty">
        <div className="card-kicker">Listening</div>
        <div className="card-script muted">Your next line appears here as soon as the prospect finishes a thought.</div>
      </div>
    );
  }
  const type = card.type ?? "say_this";
  return (
    <div className={`card card-${type} ${card.priority === 1 ? "card-urgent" : ""}`}>
      <div className="card-kicker">
        <span className={`dot dot-${type}`} /> {LABEL[type] ?? "Say this"}
        {card.stage ? <span className="stage">{card.stage.replace("_", " ")}</span> : null}
        {card.streaming ? <span className="pulse">thinking</span> : null}
      </div>
      {card.headline ? <div className="card-headline">{card.headline}</div> : null}
      <div className="card-script">{card.script || (card.streaming ? "…" : "")}</div>
      {card.rationale ? <div className="card-why">{card.rationale}</div> : null}
    </div>
  );
}
