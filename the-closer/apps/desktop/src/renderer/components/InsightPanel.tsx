import type { Insight } from "@closer/core";

export function InsightPanel({ insight }: { insight: Insight | null }) {
  if (!insight) return null;
  return (
    <div className="insight">
      <div className="insight-h">Ask next <span className="stage">{insight.stage.replace("_", " ")}</span></div>
      <ul>{insight.nextQuestions.slice(0, 3).map((q) => <li key={q.question} title={q.why}>{q.question}</li>)}</ul>
      {insight.openProspectQuestions.length > 0 && (
        <>
          <div className="insight-h">You still owe them</div>
          <ul>{insight.openProspectQuestions.map((q) => <li key={q}>{q}</li>)}</ul>
        </>
      )}
      {insight.facts.length > 0 && (
        <>
          <div className="insight-h">Known</div>
          <ul className="facts">{insight.facts.slice(0, 5).map((f) => <li key={f.key + f.value}><b>{f.key}</b> {f.value}</li>)}</ul>
        </>
      )}
    </div>
  );
}
