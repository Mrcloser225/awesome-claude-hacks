import { useCallback, useEffect, useRef, useState } from "react";
import type { BotStatus, CallContext, CallMetrics, CoachEvent, Insight, ServerMessage, TranscriptSegment } from "@closer/core";

export interface LiveCard extends Partial<CoachEvent> {
  id: string;
  streaming: boolean;
  headline: string;
  script: string;
  rationale: string;
}

export interface LiveState {
  status: "idle" | "connecting" | "live" | "error";
  error: string | null;
  transcript: TranscriptSegment[];
  card: LiveCard | null;
  history: CoachEvent[];
  metrics: CallMetrics | null;
  insight: Insight | null;
  bot: { botId: string; status: BotStatus; detail?: string } | null;
}

function toCard(e: CoachEvent): LiveCard {
  return { ...e, streaming: false, rationale: e.rationale ?? "" };
}

/** WebSocket client for /v1/live. Handles the streamed coach card protocol. */
export function useLiveSession(cfg: { apiUrl: string; apiKey: string } | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<LiveState>({ status: "idle", error: null, transcript: [], card: null, history: [], metrics: null, insight: null, bot: null });

  const handle = useCallback((msg: ServerMessage) => {
    setState((s) => {
      switch (msg.type) {
        case "session.ready":
          return { ...s, status: "live", error: null };
        case "session.snapshot": {
          const last = msg.events[msg.events.length - 1];
          return { ...s, status: "live", error: null, transcript: msg.transcript.slice(-60), history: msg.events.slice(-30), card: last ? toCard(last) : s.card, insight: msg.insight, metrics: msg.metrics, bot: msg.bot };
        }
        case "insight":
          return { ...s, insight: msg.insight };
        case "bot.status":
          return { ...s, bot: { botId: msg.botId, status: msg.status, detail: msg.detail }, status: msg.status === "ended" || msg.status === "failed" ? "idle" : s.status };
        case "transcript.partial":
        case "transcript.final": {
          const idx = s.transcript.findIndex((t) => t.id === msg.segment.id);
          const transcript = idx >= 0 ? s.transcript.map((t, i) => (i === idx ? msg.segment : t)) : [...s.transcript.slice(-60), msg.segment];
          return { ...s, transcript };
        }
        case "coach.start":
          return { ...s, card: { ...msg.event, id: msg.event.id, streaming: true, headline: "", script: "", rationale: "" } };
        case "coach.delta": {
          if (!s.card || s.card.id !== msg.id) return s;
          return { ...s, card: { ...s.card, [msg.field]: s.card[msg.field] + msg.text } };
        }
        case "coach.done":
          return { ...s, card: toCard(msg.event), history: [...s.history.slice(-30), msg.event] };
        case "coach.cancelled": {
          if (s.card?.id !== msg.id) return s;
          const prev = s.history[s.history.length - 1];
          return { ...s, card: prev ? toCard(prev) : null };
        }
        case "metrics":
          return { ...s, metrics: msg.metrics };
        case "error":
          return { ...s, error: `${msg.code}: ${msg.message}` };
        default:
          return s;
      }
    });
  }, []);

  const open = useCallback((first: object) => {
    if (!cfg) return;
    wsRef.current?.close();
    setState((s) => ({ ...s, status: "connecting", error: null, transcript: [], card: null, history: [], metrics: null, insight: null, bot: null }));
    const ws = new WebSocket(`${cfg.apiUrl}?token=${encodeURIComponent(cfg.apiKey)}`);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => ws.send(JSON.stringify(first));
    ws.onmessage = (e) => handle(JSON.parse(e.data as string) as ServerMessage);
    ws.onerror = () => setState((s) => ({ ...s, status: "error", error: "Connection failed. Is the API running?" }));
    ws.onclose = () => setState((s) => (s.status === "error" ? s : { ...s, status: "idle" }));
    wsRef.current = ws;
  }, [cfg, handle]);

  /** Desktop mode: this client owns the call and streams audio. */
  const connect = useCallback((context: CallContext) => open({ type: "session.start", context }), [open]);

  /** Bot mode: ask the API to send a bot into the meeting, then watch the call it creates. */
  const sendBot = useCallback(async (meetingUrl: string, context: CallContext) => {
    if (!cfg) return;
    const http = cfg.apiUrl.replace(/^ws/, "http").replace(/\/v1\/live$/, "");
    const res = await fetch(`${http}/v1/bots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ meetingUrl, context }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: unknown };
      throw new Error(typeof body.error === "string" ? body.error : `Bot request failed (${res.status})`);
    }
    const { callId } = (await res.json()) as { callId: string };
    open({ type: "session.attach", callId });
  }, [cfg, open]);

  const sendAudio = useCallback((frame: ArrayBuffer) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(frame);
  }, []);

  const ask = useCallback((question: string) => {
    wsRef.current?.send(JSON.stringify({ type: "rep.ask", question }));
  }, []);

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "session.stop" }));
    setTimeout(() => ws?.close(), 300);
    wsRef.current = null;
  }, []);

  useEffect(() => () => wsRef.current?.close(), []);

  return { state, connect, sendBot, disconnect, sendAudio, ask };
}
