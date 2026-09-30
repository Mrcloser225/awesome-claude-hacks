"use client";
import { use, useEffect, useRef, useState } from "react";
import type { CoachEvent, Insight, TranscriptSegment } from "@closer/core";
import { AppShell } from "@/components/AppShell";
import { CallChat } from "@/components/CallChat";
import { api, type CallRecordView, type CallSummary } from "@/lib/api";
import { useLiveCall, type LiveCard } from "@/lib/live";

const LABEL: Record<string, string> = { say_this: "Say this", objection: "Objection", question: "They asked", answer: "Answer", warning: "Heads up", stage_change: "Stage" };

function Card({ card }: { card: LiveCard | null }) {
  if (!card) return <div className="card"><div className="kicker">Listening</div><div className="script muted" style={{ fontSize: 15 }}>Your next line appears here as soon as the prospect finishes a thought.</div></div>;
  return (
    <div className={`card ${card.type ?? "say_this"}`}>
      <div className="kicker"><span>{LABEL[card.type ?? "say_this"]}</span>{card.stage && <span style={{ marginLeft: "auto" }}>{card.stage.replace("_", " ")}</span>}{card.streaming && <span style={{ color: "var(--accent)" }}>thinking…</span>}</div>
      {card.headline && <div className="headline">{card.headline}</div>}
      <div className="script">{card.script || (card.streaming ? "…" : "")}</div>
      {card.rationale && <div className="why">{card.rationale}</div>}
    </div>
  );
}

function InsightBox({ insight }: { insight: Insight | null }) {
  if (!insight) return null;
  return (
    <div className="insight">
      <h3>Ask next <span className="pill" style={{ marginLeft: 6 }}>{insight.stage.replace("_", " ")}</span></h3>
      <ul>{insight.nextQuestions.slice(0, 4).map((q) => <li key={q.question} title={q.why}>{q.question}</li>)}</ul>
      {insight.openProspectQuestions.length > 0 && <><h3>You still owe them</h3><ul>{insight.openProspectQuestions.map((q) => <li key={q}>{q}</li>)}</ul></>}
      {insight.facts.length > 0 && <><h3>What we know</h3><ul>{insight.facts.slice(0, 6).map((f) => <li key={f.key + f.value}><b style={{ textTransform: "capitalize" }}>{f.key}</b>: {f.value}</li>)}</ul></>}
      {insight.risks.length > 0 && <><h3>Risks</h3><ul>{insight.risks.map((r) => <li key={r}>{r}</li>)}</ul></>}
    </div>
  );
}

function Transcript({ segments }: { segments: TranscriptSegment[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [segments]);
  return (
    <div className="transcript" ref={ref}>
      {segments.length === 0 && <span className="muted">Waiting for the first words…</span>}
      {segments.map((s) => <div key={s.id} className={`line ${s.speaker} ${s.isFinal ? "" : "partial"}`}><span className="who">{s.speaker === "rep" ? "You" : s.participant ?? "Them"}</span>{s.text}</div>)}
    </div>
  );
}

function SummaryView({ summary }: { summary: CallSummary }) {
  return (
    <div className="panel stack">
      <h2>Summary <span className="pill">{summary.outcome}</span></h2>
      <p><b>{summary.oneLine}</b></p>
      <p><b>Next step:</b> {summary.nextStep}</p>
      {summary.objectionsRaised.length > 0 && <div><b>Objections</b><ul>{summary.objectionsRaised.map((o, i) => <li key={i}>{o.objection}: {o.handled ? "handled" : "not handled"}. {o.note}</li>)}</ul></div>}
      {summary.commitments.length > 0 && <div><b>Commitments</b><ul>{summary.commitments.map((c, i) => <li key={i}>{c.owner}: {c.action}{c.due ? ` (${c.due})` : ""}</li>)}</ul></div>}
      {summary.coachingNotes.length > 0 && <div><b>Coaching notes</b><ul>{summary.coachingNotes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
      <details><summary>Follow-up email</summary><p><b>{summary.followUpEmail.subject}</b></p><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{summary.followUpEmail.body}</pre></details>
      <details><summary>CRM note</summary><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{summary.crmNote}</pre></details>
    </div>
  );
}

export default function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rec, setRec] = useState<CallRecordView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [summarising, setSummarising] = useState(false);
  const load = () => api.call(id).then(setRec).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = useLiveCall(id, Boolean(rec?.live));
  useEffect(() => { if (live.state.status === "ended") load(); }, [live.state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLive = Boolean(rec?.live) && live.state.status !== "ended";
  const transcript = isLive ? live.state.transcript : rec?.transcript ?? [];
  const insight = isLive ? live.state.insight : rec?.insight ?? null;
  const lastEvent: CoachEvent | undefined = rec?.events[rec.events.length - 1];
  const card: LiveCard | null = isLive ? live.state.card : lastEvent ? { ...lastEvent, streaming: false, rationale: lastEvent.rationale ?? "" } : null;
  const ratio = live.state.metrics?.repTalkRatio;

  const summarise = async () => { setSummarising(true); try { await api.summarise(id); await load(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setSummarising(false); } };

  return (
    <AppShell>
      {() => (
        <main className="live">
          <div className="col">
            <div className="row" style={{ alignItems: "center" }}>
              <h1 style={{ fontSize: 18, margin: 0 }}>{rec?.title ?? "Call"} {rec?.context.prospect?.name && <span className="muted">with {rec.context.prospect.name}</span>}</h1>
              <span style={{ flex: "0 0 auto" }} className={`pill ${isLive ? "live" : "ended"}`}>{isLive ? (live.state.bot ? `bot: ${live.state.bot.status.replace("_", " ")}` : "live") : rec?.source ?? ""}</span>
            </div>
            {err && <div className="err">{err}</div>}
            {live.state.error && <div className="err">{live.state.error}</div>}
            <Transcript segments={transcript} />
            {typeof ratio === "number" && <div><div className="small muted">You {Math.round(ratio * 100)}% of the talking</div><div className="talk"><div style={{ width: `${Math.round(ratio * 100)}%`, background: ratio > 0.65 ? "var(--bad)" : ratio > 0.55 ? "var(--warn)" : "var(--good)" }} /></div></div>}
            {!isLive && rec && (rec.summary ? <SummaryView summary={rec.summary} /> : <button className="primary" onClick={summarise} disabled={summarising || rec.transcript.length === 0}>{summarising ? "Summarising…" : "Summarise this call"}</button>)}
          </div>
          <div className="col">
            <Card card={card} />
            {isLive && <div className="quick" style={{ padding: 0 }}>{["Give me a close", "Handle this objection", "Ask a discovery question", "Answer what they asked"].map((x) => <button key={x} onClick={() => live.ask(x)}>{x}</button>)}</div>}
            <InsightBox insight={insight} />
            {rec && <CallChat callId={id} live={isLive} />}
          </div>
        </main>
      )}
    </AppShell>
  );
}
