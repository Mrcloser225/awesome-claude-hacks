"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, setToken } from "@/lib/api";
import { Brand } from "./Brand";

type Mode = "forgot" | "reset" | "verify" | "invite";

function Inner({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [f, setF] = useState({ email: "", password: "", name: "" });
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ email: string; role: string; company?: string } | null>(null);

  useEffect(() => {
    if (mode === "verify" && token) { setState("busy"); api.verify(token).then(() => setState("done")).catch((e) => { setErr(e.message); setState("error"); }); }
    if (mode === "invite" && token) api.invitePreview(token).then(setInvite).catch((e) => { setErr(e.message); setState("error"); });
  }, [mode, token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setState("busy"); setErr(null);
    try {
      if (mode === "forgot") { await api.forgot(f.email); setState("done"); }
      if (mode === "reset") { await api.reset(token, f.password); setState("done"); }
      if (mode === "invite") { const r = await api.acceptInvite({ token, name: f.name, password: f.password }); setToken(r.token); router.push("/app"); }
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setState("error"); }
  };

  const copy = {
    forgot: { title: "Reset your password", done: "If that email has an account, a reset link is on its way." },
    reset: { title: "Choose a new password", done: "Password changed. You can sign in now." },
    verify: { title: "Confirming your email", done: "Email confirmed. You are all set." },
    invite: { title: invite ? `Join ${invite.company ?? "your team"} on The Closer` : "Accept your invitation", done: "" },
  }[mode];

  return (
    <main className="container" style={{ maxWidth: 440, paddingTop: 80 }}>
      <div className="nav" style={{ border: 0, background: "transparent", padding: 0 }}><Brand /></div>
      <h1 style={{ marginTop: 20 }}>{copy.title}</h1>
      {state === "done" ? (
        <div className="panel stack"><p style={{ margin: 0 }}>{copy.done}</p><Link href={mode === "forgot" ? "/" : "/login"} className="cta" style={{ alignSelf: "flex-start" }}>{mode === "forgot" ? "Back" : "Sign in"}</Link></div>
      ) : mode === "verify" ? (
        <div className="panel stack">{err ? <div className="err">{err}</div> : <p className="muted" style={{ margin: 0 }}>One moment…</p>}<Link href="/app" className="cta secondary" style={{ alignSelf: "flex-start" }}>Go to the app</Link></div>
      ) : (
        <form onSubmit={submit} className="panel stack">
          {mode === "invite" && invite && <p className="muted small" style={{ margin: 0 }}>Invited as {invite.role}. Account email: {invite.email}</p>}
          {mode === "forgot" && <input type="email" placeholder="Work email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />}
          {mode === "invite" && <input placeholder="Your name, as it appears in Teams" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />}
          {(mode === "reset" || mode === "invite") && <input type="password" placeholder="Password (8+ characters)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} />}
          {err && <div className="err">{err}</div>}
          <button className="primary" disabled={state === "busy" || (mode === "invite" && !invite)}>{state === "busy" ? "One moment" : mode === "forgot" ? "Send reset link" : mode === "reset" ? "Change password" : "Join"}</button>
        </form>
      )}
    </main>
  );
}

export function TokenPage({ mode }: { mode: Mode }) {
  return <Suspense fallback={<main className="container muted">Loading…</main>}><Inner mode={mode} /></Suspense>;
}
