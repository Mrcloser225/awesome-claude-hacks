"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setToken } from "@/lib/api";
import { Brand } from "./Brand";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "", name: "", company: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = mode === "signup" ? await api.signup(f) : await api.login({ email: f.email, password: f.password });
      setToken(res.token);
      router.push("/app");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return (
    <main className="container" style={{ maxWidth: 440, paddingTop: 80 }}>
      <div className="nav" style={{ border: 0, background: "transparent", padding: 0 }}><Brand /></div>
      <h1 style={{ marginTop: 20 }}>{mode === "signup" ? "Create your account" : "Sign in"}</h1>
      <form onSubmit={submit} className="stack panel">
        {mode === "signup" && <>
          <input placeholder="Your name, as it appears in Teams" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          <input placeholder="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} required />
        </>}
        <input type="email" placeholder="Work email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <input type="password" placeholder="Password (8+ characters)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} />
        {err && <div className="err">{err}</div>}
        <button className="primary" disabled={busy}>{busy ? "One moment" : mode === "signup" ? "Start free" : "Sign in"}</button>
        <p className="small muted" style={{ margin: 0 }}>
          {mode === "signup" ? <>Already have an account? <Link href="/login" style={{ color: "var(--violet-2)" }}>Sign in</Link></> : <>New here? <Link href="/signup" style={{ color: "var(--violet-2)" }}>Create an account</Link></>}
        </p>
      </form>
    </main>
  );
}
