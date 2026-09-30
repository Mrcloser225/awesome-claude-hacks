"use client";
import { useEffect, useRef, useState } from "react";
import { chatStream } from "@/lib/api";

type Turn = { role: "user" | "assistant"; content: string };
const QUICK_LIVE = ["What is the real objection here?", "Draft the close", "What should I ask next?", "Answer what they just asked", "Summarise where we are"];
const QUICK_DONE = ["Score this call and tell me what I missed", "Write the follow-up email", "List every objection and how I handled it", "What should I do differently next time?", "Draft the proposal outline"];

/** The "Claude, help me on this call" thread. The server adds the transcript, playbook and knowledge base to every turn. */
export function CallChat({ callId, live }: { callId: string; live: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [turns]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setErr(null); setBusy(true); setQ("");
    const history: Turn[] = [...turns, { role: "user", content: text.trim() }];
    setTurns([...history, { role: "assistant", content: "" }]);
    try {
      await chatStream(callId, history, (delta) => setTurns((t) => { const last = t[t.length - 1]!; return [...t.slice(0, -1), { ...last, content: last.content + delta }]; }));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return (
    <div className="chat">
      <div className="quick">{(live ? QUICK_LIVE : QUICK_DONE).map((x) => <button key={x} onClick={() => send(x)} disabled={busy}>{x}</button>)}</div>
      <div className="msgs" ref={box}>
        {turns.length === 0 && <p className="muted small">Ask anything about this call. Claude has read every word, your playbook and your knowledge base.</p>}
        {turns.map((t, i) => <div key={i} className={`msg ${t.role}`}>{t.content || (busy ? "…" : "")}</div>)}
        {err && <div className="err">{err}</div>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={live ? "Ask Claude mid-call…" : "Ask Claude about this call…"} disabled={busy} />
        <button className="primary" disabled={busy || !q.trim()} style={{ flex: "0 0 auto" }}>Send</button>
      </form>
    </div>
  );
}
