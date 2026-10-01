"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, setToken, type User } from "@/lib/api";
import { Brand } from "./Brand";

export function AppShell({ children }: { children: (user: User) => React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => router.replace("/login"));
  }, [router]);
  const logout = async () => { await api.logout().catch(() => {}); setToken(null); router.replace("/login"); };
  if (!user) return <main className="container muted">Loading…</main>;
  return (
    <>
      <nav className="nav">
        <Brand href="/app" />
        <Link href="/app" className={path === "/app" ? "on" : ""}>Calls</Link>
        <Link href="/app/knowledge" className={path.startsWith("/app/knowledge") ? "on" : ""}>Knowledge</Link>
        <Link href="/app/settings" className={path.startsWith("/app/settings") ? "on" : ""}>Auto-join</Link>
        <span className="spacer" />
        <span className="muted small">{user.name}, {user.company}</span>
        <button className="ghost" onClick={logout}>Sign out</button>
      </nav>
      {children(user)}
    </>
  );
}
