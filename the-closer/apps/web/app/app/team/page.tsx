"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, type Member } from "@/lib/api";

export default function Team() {
  const [members, setMembers] = useState<Member[]>([]);
  const [keys, setKeys] = useState<Array<{ id: string; label?: string; createdAt: number; revokedAt?: number }>>([]);
  const [inv, setInv] = useState({ email: "", role: "rep" });
  const [minted, setMinted] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => Promise.all([api.members().then(setMembers), api.apiKeys().then(setKeys).catch(() => {})]).catch((e) => setErr(e.message));
  useEffect(() => { void load(); }, []);
  const run = async (fn: () => Promise<unknown>, ok?: string) => { setErr(null); setMsg(null); try { await fn(); if (ok) setMsg(ok); await load(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };
  return (
    <AppShell>
      {(user) => (
        <main className="container grid grid-2">
          <div className="stack">
            <form className="panel stack" onSubmit={(e) => { e.preventDefault(); void run(() => api.invite(inv.email, inv.role), `Invitation sent to ${inv.email}`); }}>
              <h2>Invite a colleague</h2>
              <div className="row"><input type="email" placeholder="Work email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} required /><select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })} style={{ flex: "0 0 140px" }}><option value="rep">Rep</option><option value="manager">Manager</option>{user.role === "admin" && <option value="admin">Admin</option>}</select></div>
              <p className="small muted" style={{ margin: 0 }}>Reps see their own calls. Managers see every call in the company. Admins also manage billing, integrations and data.</p>
              {msg && <div className="pill live" style={{ alignSelf: "flex-start" }}>{msg}</div>}
              {err && <div className="err">{err}</div>}
              <button className="primary" disabled={user.role === "rep"}>Send invitation</button>
            </form>
            {user.role === "admin" && (
              <div className="panel stack">
                <h2>API keys</h2>
                <p className="small muted" style={{ margin: 0 }}>For the desktop overlay, the Teams side panel, and your own integrations. Keys are shown once.</p>
                <div className="row"><input placeholder="Label, e.g. JP laptop" value={label} onChange={(e) => setLabel(e.target.value)} /><button style={{ flex: "0 0 auto" }} onClick={() => run(async () => { const r = await api.mintApiKey(label || "key"); setMinted(r.key); setLabel(""); })}>Create key</button></div>
                {minted && <div className="pill live" style={{ alignSelf: "stretch", wordBreak: "break-all", padding: 8 }}>{minted}</div>}
                <div className="list">{keys.map((k) => <a key={k.id} href="#" onClick={(e) => e.preventDefault()}><span style={{ flex: 1 }}>{k.label ?? "key"} <span className="muted small">{new Date(k.createdAt).toLocaleDateString("en-GB")}</span></span>{k.revokedAt ? <span className="pill">revoked</span> : <button className="ghost" onClick={() => run(() => api.revokeApiKey(k.id))}>Revoke</button>}</a>)}</div>
              </div>
            )}
          </div>
          <div className="panel">
            <h2>Team ({members.length})</h2>
            <div className="list">
              {members.map((m) => (
                <a key={m.id} href="#" onClick={(e) => e.preventDefault()}>
                  <span style={{ flex: 1 }}>{m.name} <span className="muted small">{m.email}{m.emailVerifiedAt ? "" : " (unverified)"}</span></span>
                  {user.role === "admin" && m.id !== user.id ? (
                    <><select value={m.role} onChange={(e) => run(() => api.setRole(m.id, e.target.value))} style={{ width: 120 }}><option value="rep">Rep</option><option value="manager">Manager</option><option value="admin">Admin</option></select><button className="ghost" onClick={() => run(() => api.removeMember(m.id))}>Remove</button></>
                  ) : <span className="pill">{m.role}</span>}
                </a>
              ))}
            </div>
          </div>
        </main>
      )}
    </AppShell>
  );
}
