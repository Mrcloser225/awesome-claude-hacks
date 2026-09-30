"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { api, type CallListItem, type User } from "@/lib/api";

function StartCall({ user }: { user: User }) {
  const router = useRouter();
  const [f, setF] = useState({ meetingUrl: "", prospectName: "", prospectCompany: "", briefing: "", botName: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { const s = localStorage.getItem("closer.start"); if (s) setF((f) => ({ ...f, ...(JSON.parse(s) as Partial<typeof f>), meetingUrl: "" })); } catch { /* ignore */ } }, []);
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      localStorage.setItem("closer.start", JSON.stringify(f));
      const callId = `call_${Date.now().toString(36)}`;
      const res = await api.sendBot({
        meetingUrl: f.meetingUrl,
        botName: f.botName || undefined,
        title: f.prospectCompany ? `Call with ${f.prospectCompany}` : undefined,
        context: { callId, rep: { name: user.name, company: user.company }, prospect: { name: f.prospectName || undefined, company: f.prospectCompany || undefined }, briefing: f.briefing || undefined },
      });
      router.push(`/app/calls/${res.callId}`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={go} className="panel stack">
      <h2>Start a call</h2>
      <input placeholder="Paste the Teams, Zoom or Meet join link" value={f.meetingUrl} onChange={(e) => setF({ ...f, meetingUrl: e.target.value })} required />
      <div className="row">
        <input placeholder="Prospect name" value={f.prospectName} onChange={(e) => setF({ ...f, prospectName: e.target.value })} />
        <input placeholder="Prospect company" value={f.prospectCompany} onChange={(e) => setF({ ...f, prospectCompany: e.target.value })} />
      </div>
      <textarea rows={3} placeholder="Briefing: what you want from this call, history, landmines, what they said last time" value={f.briefing} onChange={(e) => setF({ ...f, briefing: e.target.value })} />
      <input placeholder={`Participant name shown in the call (default: ${user.name} (notes))`} value={f.botName} onChange={(e) => setF({ ...f, botName: e.target.value })} />
      <p className="small muted" style={{ margin: 0 }}>The bot joins under that name. Your own words are attributed to you by your Teams display name, so keep your account name matching it.</p>
      {err && <div className="err">{err}</div>}
      <button className="primary" disabled={busy}>{busy ? "Sending the bot in…" : "Send the bot in and open the live view"}</button>
    </form>
  );
}

function FirefliesImport({ user, onDone }: { user: User; onDone: () => void }) {
  const [key, setKey] = useState("");
  const [rows, setRows] = useState<Array<{ id: string; title: string; date: number; duration: number }> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { try { setKey(localStorage.getItem("closer.ff") ?? ""); } catch { /* ignore */ } }, []);
  const list = async () => { setErr(null); setBusy("list"); try { localStorage.setItem("closer.ff", key); setRows(await api.firefliesList(key)); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); } };
  const imp = async (id: string) => { setBusy(id); try { await api.firefliesImport({ apiKey: key, transcriptId: id, repName: user.name }); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); } };
  return (
    <div className="panel stack">
      <h2>Bring in your Fireflies calls</h2>
      <p className="small muted" style={{ margin: 0 }}>Paste your Fireflies API key (Fireflies, Integrations, Fireflies API). Imported calls get the same chat, summary and follow-up as live ones.</p>
      <div className="row"><input placeholder="Fireflies API key" value={key} onChange={(e) => setKey(e.target.value)} /><button onClick={list} disabled={!key || busy === "list"} style={{ flex: "0 0 auto" }}>List recent</button></div>
      {err && <div className="err">{err}</div>}
      {rows && rows.length === 0 && <p className="small muted">No transcripts found on that account.</p>}
      {rows && rows.map((r) => (
        <div key={r.id} className="row" style={{ alignItems: "center" }}>
          <span>{r.title || r.id} <span className="muted small">{new Date(r.date).toLocaleDateString("en-GB")}, {Math.round(r.duration / 60)} min</span></span>
          <button onClick={() => imp(r.id)} disabled={busy === r.id} style={{ flex: "0 0 auto" }}>{busy === r.id ? "Importing…" : "Import"}</button>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [calls, setCalls] = useState<CallListItem[]>([]);
  const load = () => api.calls().then(setCalls).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, []);
  return (
    <AppShell>
      {(user) => (
        <main className="container grid grid-2">
          <div className="stack">
            <StartCall user={user} />
            <FirefliesImport user={user} onDone={load} />
          </div>
          <div className="panel">
            <h2>Your calls</h2>
            {calls.length === 0 && <p className="muted small">Nothing yet. Start a call or import one from Fireflies.</p>}
            <div className="list">
              {calls.map((c) => (
                <Link key={c.id} href={`/app/calls/${c.id}`}>
                  <span className={`pill ${c.live ? "live" : "ended"}`}>{c.live ? "live" : c.source}</span>
                  <span style={{ flex: 1 }}>{c.title}{c.prospect?.name ? <span className="muted small"> with {c.prospect.name}</span> : null}</span>
                  <span className="muted small">{new Date(c.startedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
                  {c.outcome && <span className="pill">{c.outcome}</span>}
                </Link>
              ))}
            </div>
          </div>
        </main>
      )}
    </AppShell>
  );
}
