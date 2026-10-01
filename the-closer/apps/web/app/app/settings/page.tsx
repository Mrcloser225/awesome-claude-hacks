"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { API_URL, getToken } from "@/lib/api";

interface Conn { id: string; provider: "microsoft" | "google"; accountEmail?: string; autoJoin: boolean; externalOnly: boolean; botName?: string }
interface Upcoming { id: string; title: string; startsAt: number; endsAt: number; joinUrl: string | null; attendeeEmails: string[]; eligible: boolean; reason?: string; scheduled: boolean }

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = getToken();
  const res = await fetch(`${API_URL}${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.headers ?? {}) } });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { error?: unknown } & T;
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `Request failed (${res.status})`);
  return body;
}

const LABEL = { microsoft: "Microsoft 365 / Outlook", google: "Google Calendar" };

function SettingsInner() {
  const params = useSearchParams();
  const [conns, setConns] = useState<Conn[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [upcoming, setUpcoming] = useState<Record<string, Upcoming[]>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([call<Conn[]>("/v1/integrations/calendar"), call<string[]>("/v1/integrations/calendar/providers")]);
      setConns(c); setProviders(p);
      const up: Record<string, Upcoming[]> = {};
      for (const x of c) { try { up[x.id] = await call<Upcoming[]>(`/v1/integrations/calendar/${x.id}/upcoming`); } catch (e) { up[x.id] = []; setErr(e instanceof Error ? e.message : String(e)); } }
      setUpcoming(up);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const s = params.get("calendar");
    if (s?.startsWith("connected")) setMsg("Calendar connected. Auto-join is on for external meetings with a join link.");
    else if (s?.startsWith("error")) setErr(`Calendar connection failed: ${decodeURIComponent(s.slice(6))}`);
  }, [params]);

  const connect = async (provider: string) => {
    try { const { url } = await call<{ url: string }>(`/v1/integrations/calendar/${provider}/connect`); window.location.href = url; } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const patch = async (id: string, body: Partial<Conn>) => { await call(`/v1/integrations/calendar/${id}`, { method: "PATCH", body: JSON.stringify(body) }); await load(); };
  const remove = async (id: string) => { await call(`/v1/integrations/calendar/${id}`, { method: "DELETE" }); await load(); };
  const runNow = async () => { const r = await call<{ scheduled: number; skipped: number }>("/v1/integrations/calendar/run", { method: "POST" }); setMsg(`Checked now: ${r.scheduled} bot${r.scheduled === 1 ? "" : "s"} booked.`); await load(); };

  return (
    <AppShell>
      {(user) => (
        <main className="container grid grid-2">
          <div className="stack">
            <div className="panel stack">
              <h2>Auto-join, like Fireflies</h2>
              <p className="small muted" style={{ margin: 0 }}>Connect the calendar you take calls from. Every meeting with a Teams, Zoom or Meet link gets a bot a minute before it starts, under the name you choose. No pasting links.</p>
              {msg && <div className="pill live" style={{ alignSelf: "flex-start" }}>{msg}</div>}
              {err && <div className="err">{err}</div>}
              {providers.length === 0 && <div className="err">No calendar provider is configured on the API yet. Set MS_CLIENT_ID and MS_CLIENT_SECRET (or the Google pair) on the server.</div>}
              <div className="row">
                {(["microsoft", "google"] as const).map((pv) => (
                  <button key={pv} className={conns.some((c) => c.provider === pv) ? "" : "primary"} disabled={!providers.includes(pv)} onClick={() => connect(pv)}>
                    {conns.some((c) => c.provider === pv) ? `Reconnect ${LABEL[pv]}` : `Connect ${LABEL[pv]}`}
                  </button>
                ))}
              </div>
            </div>
            {conns.map((c) => (
              <div key={c.id} className="panel stack">
                <h2>{LABEL[c.provider]} <span className="muted" style={{ textTransform: "none", letterSpacing: 0 }}>{c.accountEmail}</span></h2>
                <label className="row" style={{ alignItems: "center" }}><input type="checkbox" style={{ width: "auto" }} checked={c.autoJoin} onChange={(e) => patch(c.id, { autoJoin: e.target.checked })} /><span>Send a bot to my meetings automatically</span></label>
                <label className="row" style={{ alignItems: "center" }}><input type="checkbox" style={{ width: "auto" }} checked={c.externalOnly} onChange={(e) => patch(c.id, { externalOnly: e.target.checked })} /><span>Only meetings with someone outside {user.email?.split("@")[1] ?? "my company"}</span></label>
                <div>
                  <div className="small muted" style={{ marginBottom: 4 }}>Participant name the bot joins under</div>
                  <input defaultValue={c.botName ?? ""} placeholder={`${user.name} (notes)`} onBlur={(e) => { if ((e.target.value || "") !== (c.botName ?? "")) patch(c.id, { botName: e.target.value || null } as Partial<Conn>); }} />
                </div>
                <div className="row"><button onClick={runNow}>Check my calendar now</button><button className="ghost" onClick={() => remove(c.id)}>Disconnect</button></div>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2>Next 24 hours</h2>
            {conns.length === 0 && <p className="muted small">Connect a calendar to see which meetings will get a bot.</p>}
            <div className="list">
              {conns.flatMap((c) => (upcoming[c.id] ?? []).map((u) => (
                <a key={c.id + u.id} href={u.joinUrl ?? "#"} target="_blank" rel="noreferrer">
                  <span className={`pill ${u.scheduled ? "live" : ""}`}>{u.scheduled ? "bot booked" : u.eligible ? "will join" : u.reason}</span>
                  <span style={{ flex: 1 }}>{u.title}<div className="muted small">{u.attendeeEmails.slice(0, 3).join(", ")}</div></span>
                  <span className="muted small">{new Date(u.startsAt).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </a>
              )))}
            </div>
          </div>
        </main>
      )}
    </AppShell>
  );
}

export default function Settings() {
  return <Suspense fallback={<main className="container muted">Loading…</main>}><SettingsInner /></Suspense>;
}
