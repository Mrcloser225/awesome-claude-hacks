"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, type Billing, type Org } from "@/lib/api";

export default function BillingPage() {
  const [b, setB] = useState<Billing | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [seats, setSeats] = useState(3);
  const [err, setErr] = useState<string | null>(null);
  const [crm, setCrm] = useState<Array<{ id: string; provider: string; autoPush: boolean }>>([]);
  const [crmProviders, setCrmProviders] = useState<string[]>([]);
  const load = () => Promise.all([api.billing().then(setB), api.org().then((r) => setOrg(r.org)), api.usage().then(setUsage), api.crmList().then(setCrm), api.crmProviders().then(setCrmProviders)]).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);
  const go = async (fn: () => Promise<{ url: string }>) => { try { const { url } = await fn(); window.location.href = url; } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); await load(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };
  return (
    <AppShell>
      {(user) => (
        <main className="container grid grid-2">
          <div className="stack">
            <div className="panel stack">
              <h2>Plan</h2>
              {b && <p style={{ margin: 0 }}><b style={{ textTransform: "capitalize" }}>{b.plan}</b>, {b.seats} seat{b.seats === 1 ? "" : "s"}.{b.plan === "trial" && b.limits.trialCalls !== undefined ? ` ${b.limits.trialCalls - b.trialCallsUsed} free calls left.` : ""}</p>}
              {b && <p className="small muted" style={{ margin: 0 }}>Limits: {b.limits.botsPerDay} bots a day, {b.limits.coachCallsPerMinute} coach lines a minute, {b.limits.chatTurnsPerMinute} chat messages a minute. Today: {usage.bots ?? 0} bots, {usage.coach_calls ?? 0} coach lines, {usage.chat_turns ?? 0} chat messages.</p>}
              {err && <div className="err">{err}</div>}
              {b && !b.configured && <div className="err">Billing is not configured on the API yet (STRIPE_SECRET_KEY and price ids).</div>}
              {user.role === "admin" && b?.configured && !b.hasSubscription && (
                <div className="stack">
                  <div className="row"><span>Seats</span><input type="number" min={1} max={500} value={seats} onChange={(e) => setSeats(Number(e.target.value))} style={{ flex: "0 0 100px" }} /></div>
                  <div className="row"><button className="primary" onClick={() => go(() => api.checkout("solo", seats))}>Solo, £49 per seat</button><button className="primary" onClick={() => go(() => api.checkout("team", seats))}>Team, £89 per seat</button></div>
                </div>
              )}
              {user.role === "admin" && b?.hasSubscription && <button onClick={() => go(() => api.portal())}>Manage subscription, seats and invoices</button>}
              {user.role !== "admin" && <p className="small muted" style={{ margin: 0 }}>Ask an admin to change the plan.</p>}
            </div>
            {user.role === "admin" && org && (
              <div className="panel stack">
                <h2>Recording disclosure and retention</h2>
                <label className="stack" style={{ gap: 4 }}><span className="small muted">How the bot discloses itself</span>
                  <select value={org.disclosure} onChange={(e) => run(() => api.updateOrg({ disclosure: e.target.value as Org["disclosure"] }))}>
                    <option value="chat_message">Post a notice in the meeting chat when it joins (recommended)</option>
                    <option value="name_only">Name in the participant list only</option>
                    <option value="off">No disclosure (you take responsibility for consent)</option>
                  </select></label>
                <label className="stack" style={{ gap: 4 }}><span className="small muted">Delete calls after (days, 0 keeps forever)</span><input type="number" min={0} max={3650} defaultValue={org.retentionDays} onBlur={(e) => { const v = Number(e.target.value); if (v !== org.retentionDays) run(() => api.updateOrg({ retentionDays: v })); }} /></label>
              </div>
            )}
          </div>
          <div className="stack">
            {user.role === "admin" && (
              <div className="panel stack">
                <h2>CRM</h2>
                <p className="small muted" style={{ margin: 0 }}>Every summarised call is logged against the matching contact, with the note, outcome, commitments and next step.</p>
                <div className="row">{["salesforce", "hubspot"].map((pv) => <button key={pv} disabled={!crmProviders.includes(pv)} onClick={() => go(() => api.crmConnect(pv))} style={{ textTransform: "capitalize" }}>{crm.some((c) => c.provider === pv) ? `Reconnect ${pv}` : `Connect ${pv}`}</button>)}</div>
                {crmProviders.length === 0 && <p className="small muted" style={{ margin: 0 }}>No CRM provider configured on the API (SALESFORCE_CLIENT_ID or HUBSPOT_CLIENT_ID).</p>}
                {crm.map((c) => <div key={c.id} className="row" style={{ alignItems: "center" }}><span style={{ textTransform: "capitalize" }}>{c.provider}</span><label className="row" style={{ alignItems: "center", flex: "0 0 auto" }}><input type="checkbox" style={{ width: "auto" }} checked={c.autoPush} onChange={(e) => run(() => api.crmToggle(c.id, e.target.checked))} /> auto-push</label><button className="ghost" style={{ flex: "0 0 auto" }} onClick={() => run(() => api.crmDisconnect(c.id))}>Disconnect</button></div>)}
              </div>
            )}
            {user.role === "admin" && (
              <div className="panel stack">
                <h2>Your data</h2>
                <p className="small muted" style={{ margin: 0 }}>Export everything as JSON, or delete the organisation and every call, transcript and member. Deletion cannot be undone.</p>
                <div className="row"><a className="cta secondary" href={api.exportUrl()} style={{ justifyContent: "center" }}>Export all data</a><button className="danger" onClick={() => { if (confirm("Delete the organisation and all its data? This cannot be undone.")) run(async () => { await api.deleteOrg(); window.location.href = "/"; }); }}>Delete organisation</button></div>
              </div>
            )}
          </div>
        </main>
      )}
    </AppShell>
  );
}
