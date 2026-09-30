import { useCallback, useEffect, useRef, useState } from "react";
import type { CallContext, CallMetrics, CoachEvent, ServerMessage, TranscriptSegment } from "@closer/core";

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
}

function toCard(e: CoachEvent): LiveCard {
  return { ...e, streaming: false, rationale: e.rationale ?? "" };
}

/** WebSocket client for /v1/live. Handles the streamed coach card protocol. */
export function useLiveSession(cfg: { apiUrl: string; apiKey: string } | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<LiveState>({ status: "idle", error: null, transcript: [], card: null, history: [], metrics: null });

  const handle = useCallback((msg: ServerMessage) => {
    setState((s) => {
      switch (msg.type) {
        case "session.ready":
          return { ...s, status: "live", error: null };
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

  const connect = useCallback((context: CallContext) => {
    if (!cfg) return;
    wsRef.current?.close();
    setState((s) => ({ ...s, status: "connecting", error: null, transcript: [], card: null, history: [], metrics: null }));
    const ws = new WebSocket(`${cfg.apiUrl}?token=${encodeURIComponent(cfg.apiKey)}`);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => ws.send(JSON.stringify({ type: "session.start", context }));
    ws.onmessage = (e) => handle(JSON.parse(e.data as string) as ServerMessage);
    ws.onerror = () => setState((s) => ({ ...s, status: "error", error: "Connection failed. Is the API running?" }));
    ws.onclose = () => setState((s) => (s.status === "error" ? s : { ...s, status: "idle" }));
    wsRef.current = ws;
  }, [cfg, handle]);

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

  return { state, connect, disconnect, sendAudio, ask };
}
