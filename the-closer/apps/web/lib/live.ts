"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BotStatus, CallMetrics, CoachEvent, Insight, ServerMessage, TranscriptSegment } from "@closer/core";
import { WS_URL, getToken } from "./api";

export interface LiveCard { id: string; type?: CoachEvent["type"]; priority?: number; stage?: string; streaming: boolean; headline: string; script: string; rationale: string }
export interface LiveState {
  status: "idle" | "connecting" | "live" | "ended" | "error";
  error: string | null;
  transcript: TranscriptSegment[];
  card: LiveCard | null;
  history: CoachEvent[];
  insight: Insight | null;
  metrics: CallMetrics | null;
  bot: { botId: string; status: BotStatus; detail?: string } | null;
}
const initial: LiveState = { status: "idle", error: null, transcript: [], card: null, history: [], insight: null, metrics: null, bot: null };
const toCard = (e: CoachEvent): LiveCard => ({ ...e, streaming: false, rationale: e.rationale ?? "" });

/** Attaches to a live call over the WebSocket and keeps the live state. */
export function useLiveCall(callId: string | null, enabled: boolean) {
  const [state, setState] = useState<LiveState>(initial);
  const wsRef = useRef<WebSocket | null>(null);

  const handle = useCallback((m: ServerMessage) => {
    setState((s) => {
      switch (m.type) {
        case "session.snapshot": {
          const last = m.events[m.events.length - 1];
          return { ...s, status: "live", transcript: m.transcript.slice(-200), history: m.events, card: last ? toCard(last) : s.card, insight: m.insight, metrics: m.metrics, bot: m.bot };
        }
        case "session.ready": return { ...s, status: "live" };
        case "transcript.partial": case "transcript.final": {
          const i = s.transcript.findIndex((t) => t.id === m.segment.id);
          return { ...s, transcript: i >= 0 ? s.transcript.map((t, j) => (j === i ? m.segment : t)) : [...s.transcript.slice(-200), m.segment] };
        }
        case "coach.start": return { ...s, card: { ...m.event, streaming: true, headline: "", script: "", rationale: "" } };
        case "coach.delta": return s.card && s.card.id === m.id ? { ...s, card: { ...s.card, [m.field]: s.card[m.field] + m.text } } : s;
        case "coach.done": return { ...s, card: toCard(m.event), history: [...s.history, m.event] };
        case "coach.cancelled": { if (s.card?.id !== m.id) return s; const prev = s.history[s.history.length - 1]; return { ...s, card: prev ? toCard(prev) : null }; }
        case "insight": return { ...s, insight: m.insight };
        case "metrics": return { ...s, metrics: m.metrics };
        case "bot.status": return { ...s, bot: { botId: m.botId, status: m.status, detail: m.detail }, status: m.status === "ended" || m.status === "failed" ? "ended" : s.status };
        case "error": return { ...s, error: `${m.code}: ${m.message}`, status: m.code === "no_such_call" ? "ended" : s.status };
        default: return s;
      }
    });
  }, []);

  useEffect(() => {
    if (!callId || !enabled) return;
    setState({ ...initial, status: "connecting" });
    const t = getToken();
    const ws = new WebSocket(`${WS_URL}${t ? `?token=${encodeURIComponent(t)}` : ""}`);
    ws.onopen = () => ws.send(JSON.stringify({ type: "session.attach", callId }));
    ws.onmessage = (e) => handle(JSON.parse(e.data as string) as ServerMessage);
    ws.onerror = () => setState((s) => ({ ...s, status: "error", error: "Lost the connection to the API" }));
    ws.onclose = () => setState((s) => (s.status === "live" || s.status === "connecting" ? { ...s, status: "ended" } : s));
    wsRef.current = ws;
    return () => { ws.close(); wsRef.current = null; };
  }, [callId, enabled, handle]);

  const ask = useCallback((q: string) => { const ws = wsRef.current; if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "rep.ask", question: q })); }, []);
  return { state, ask };
}
