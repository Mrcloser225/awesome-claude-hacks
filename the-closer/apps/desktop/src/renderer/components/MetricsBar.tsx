import type { CallMetrics } from "@closer/core";

export function MetricsBar({ metrics, level }: { metrics: CallMetrics | null; level: { rep: number; prospect: number } }) {
  const ratio = metrics?.repTalkRatio ?? 0;
  const pct = Math.round(ratio * 100);
  const tone = pct > 65 ? "bad" : pct > 55 ? "warn" : "good";
  return (
    <div className="metrics">
      <div className="talk">
        <div className="talk-label">You {pct}% <span className="muted">/ them {100 - pct}%</span></div>
        <div className="talk-bar"><div className={`talk-fill talk-${tone}`} style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="vu">
        <span className="vu-label">mic</span><span className="vu-bar"><span style={{ width: `${Math.min(100, level.rep * 400)}%` }} /></span>
        <span className="vu-label">call</span><span className="vu-bar"><span style={{ width: `${Math.min(100, level.prospect * 400)}%` }} /></span>
      </div>
      <div className="counts">
        <span title="Questions you asked">Q {metrics?.questionsAskedByRep ?? 0}</span>
        <span title="Objections raised">Obj {metrics?.objectionsRaised ?? 0}</span>
      </div>
    </div>
  );
}
