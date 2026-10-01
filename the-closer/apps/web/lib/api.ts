import type { CallContext, CoachEvent, Insight, TranscriptSegment } from "@closer/core";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787").replace(/\/$/, "");
export const WS_URL = API_URL.replace(/^http/, "ws") + "/v1/live";

export interface User { id: string; orgId: string; email?: string; name: string; company: string; role: "rep" | "manager" | "admin" }
export interface Member { id: string; email: string; name: string; role: "rep" | "manager" | "admin"; emailVerifiedAt?: number; createdAt: number }
export interface Org { id: string; name: string; plan: string; seats: number; retentionDays: number; disclosure: "chat_message" | "name_only" | "off"; trialCallsUsed: number }
export interface Billing { plan: string; seats: number; limits: { coachCallsPerMinute: number; chatTurnsPerMinute: number; botsPerDay: number; trialCalls?: number }; trialCallsUsed: number; configured: boolean; hasSubscription: boolean }
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
  deleteCall: (id: string) => req<void>(`/v1/calls/${encodeURIComponent(id)}`, { method: "DELETE" }),
  pushCrm: (id: string) => req<{ pushed: Array<{ provider: string; id: string; url?: string }> }>(`/v1/calls/${encodeURIComponent(id)}/crm`, { method: "POST", body: "{}" }),
  forgot: (email: string) => req<{ ok: true }>("/v1/auth/forgot", { method: "POST", body: JSON.stringify({ email }) }),
  reset: (token: string, password: string) => req<{ ok: true }>("/v1/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) }),
  verify: (token: string) => req<{ ok: true }>("/v1/auth/verify", { method: "POST", body: JSON.stringify({ token }) }),
  resendVerification: () => req<{ ok: true }>("/v1/auth/resend-verification", { method: "POST" }),
  invitePreview: (token: string) => req<{ email: string; role: string; company?: string }>(`/v1/auth/invite?token=${encodeURIComponent(token)}`),
  acceptInvite: (d: { token: string; name: string; password: string }) => req<{ token: string; user: User }>("/v1/auth/accept-invite", { method: "POST", body: JSON.stringify(d) }),
  org: () => req<{ org: Org; me: { id: string; role: string; email?: string } }>("/v1/org"),
  updateOrg: (d: Partial<Pick<Org, "name" | "retentionDays" | "disclosure">>) => req<Org>("/v1/org", { method: "PATCH", body: JSON.stringify(d) }),
  members: () => req<Member[]>("/v1/org/members"),
  invite: (email: string, role: string) => req<{ ok: true }>("/v1/org/invites", { method: "POST", body: JSON.stringify({ email, role }) }),
  setRole: (id: string, role: string) => req<{ ok: true }>(`/v1/org/members/${id}`, { method: "PATCH", body: JSON.stringify({ role }) }),
  removeMember: (id: string) => req<void>(`/v1/org/members/${id}`, { method: "DELETE" }),
  apiKeys: () => req<Array<{ id: string; label?: string; createdAt: number; revokedAt?: number }>>("/v1/org/api-keys"),
  mintApiKey: (label: string) => req<{ id: string; key: string }>("/v1/org/api-keys", { method: "POST", body: JSON.stringify({ label }) }),
  revokeApiKey: (id: string) => req<void>(`/v1/org/api-keys/${id}`, { method: "DELETE" }),
  billing: () => req<Billing>("/v1/billing"),
  checkout: (plan: "solo" | "team", seats: number) => req<{ url: string }>("/v1/billing/checkout", { method: "POST", body: JSON.stringify({ plan, seats }) }),
  portal: () => req<{ url: string }>("/v1/billing/portal", { method: "POST" }),
  usage: () => req<Record<string, number>>("/v1/org/usage"),
  crmList: () => req<Array<{ id: string; provider: string; autoPush: boolean; instanceUrl?: string }>>("/v1/integrations/crm"),
  crmProviders: () => req<string[]>("/v1/integrations/crm/providers"),
  crmConnect: (provider: string) => req<{ url: string }>(`/v1/integrations/crm/${provider}/connect`),
  crmToggle: (id: string, autoPush: boolean) => req<{ ok: true }>(`/v1/integrations/crm/${id}`, { method: "PATCH", body: JSON.stringify({ autoPush }) }),
  crmDisconnect: (id: string) => req<void>(`/v1/integrations/crm/${id}`, { method: "DELETE" }),
  exportUrl: () => `${API_URL}/v1/org/export`,
  deleteOrg: () => req<void>("/v1/org", { method: "DELETE", body: JSON.stringify({ confirm: "DELETE" }) }),
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
