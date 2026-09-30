import type { CallContext, CoachEvent, Insight, TranscriptSegment } from "@closer/core";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787").replace(/\/$/, "");
export const WS_URL = API_URL.replace(/^http/, "ws") + "/v1/live";

export interface User { id: string; orgId: string; email?: string; name: string; company: string }
export interface CallListItem { id: string; title: string; source: string; startedAt: number; endedAt: number | null; live: boolean; prospect: { name?: string; company?: string } | null; outcome: string | null }
export interface CallRecordView {
  id: string; title: string; source: string; context: CallContext; startedAt: number; endedAt: number | null; live: boolean;
  transcript: TranscriptSegment[]; events: CoachEvent[]; insight: Insight | null; summary: CallSummary | null;
}
export interface CallSummary {
  outcome: string; oneLine: string; prospectPains: string[]; objectionsRaised: Array<{ objection: string; handled: boolean; note: string }>;
  commitments: Array<{ owner: string; action: string; due?: string }>; nextStep: string; dealStage: string; coachingNotes: string[]; crmNote: string;
  followUpEmail: { subject: string; body: string };
}
export interface KnowledgeDoc { id: string; title: string; body: string; tags?: string[] }

/** The session cookie is HttpOnly and cross-origin, so every call sends credentials. A stored token covers browsers that block third-party cookies. */
let token: string | null = null;
export function setToken(t: string | null) { token = t; try { if (t) localStorage.setItem("closer.token", t); else localStorage.removeItem("closer.token"); } catch { /* ignore */ } }
export function getToken(): string | null { if (token) return token; try { token = localStorage.getItem("closer.token"); } catch { /* ignore */ } return token; }

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as Record<string, string> ?? {}) };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { error?: unknown } & T;
  if (!res.ok) throw new ApiError(res.status, typeof body.error === "string" ? body.error : res.status === 401 ? "Please sign in" : `Request failed (${res.status})`);
  return body;
}
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export const api = {
  signup: (d: { email: string; password: string; name: string; company: string }) => req<{ token: string; user: User }>("/v1/auth/signup", { method: "POST", body: JSON.stringify(d) }),
  login: (d: { email: string; password: string }) => req<{ token: string; user: User }>("/v1/auth/login", { method: "POST", body: JSON.stringify(d) }),
  logout: () => req<{ ok: true }>("/v1/auth/logout", { method: "POST" }),
  me: () => req<{ user: User }>("/v1/auth/me"),
  calls: () => req<CallListItem[]>("/v1/calls"),
  call: (id: string) => req<CallRecordView>(`/v1/calls/${encodeURIComponent(id)}`),
  sendBot: (d: { meetingUrl: string; context: CallContext; botName?: string; title?: string }) => req<{ botId: string; callId: string }>("/v1/bots", { method: "POST", body: JSON.stringify(d) }),
  ask: (id: string, question: string) => req<{ ok: true }>(`/v1/calls/${encodeURIComponent(id)}/ask`, { method: "POST", body: JSON.stringify({ question }) }),
  summarise: (id: string) => req<CallSummary>(`/v1/calls/${encodeURIComponent(id)}/summary`, { method: "POST" }),
  knowledge: () => req<KnowledgeDoc[]>("/v1/knowledge"),
  saveKnowledge: (d: KnowledgeDoc) => req<KnowledgeDoc>(`/v1/knowledge/${encodeURIComponent(d.id)}`, { method: "PUT", body: JSON.stringify(d) }),
  deleteKnowledge: (id: string) => req<void>(`/v1/knowledge/${encodeURIComponent(id)}`, { method: "DELETE" }),
  firefliesList: (apiKey: string) => req<Array<{ id: string; title: string; date: number; duration: number }>>("/v1/integrations/fireflies/transcripts", { method: "POST", body: JSON.stringify({ apiKey }) }),
  firefliesImport: (d: { apiKey: string; transcriptId: string; repName?: string }) => req<{ callId: string }>("/v1/integrations/fireflies/import", { method: "POST", body: JSON.stringify(d) }),
};

/** Streams the chat reply; calls onDelta for each chunk. */
export async function chatStream(callId: string, messages: Array<{ role: "user" | "assistant"; content: string }>, onDelta: (t: string) => void, signal?: AbortSignal): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${API_URL}/v1/calls/${encodeURIComponent(callId)}/chat`, { method: "POST", headers, credentials: "include", body: JSON.stringify({ messages }), signal });
  if (!res.ok || !res.body) throw new ApiError(res.status, "Chat failed");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const ev = /^event: (\w+)/m.exec(frame)?.[1];
      const data = /^data: (.*)$/m.exec(frame)?.[1];
      if (ev === "error") throw new Error((data && (JSON.parse(data) as { message: string }).message) || "Chat failed");
      if (!ev && data) onDelta((JSON.parse(data) as { delta: string }).delta);
    }
  }
}
