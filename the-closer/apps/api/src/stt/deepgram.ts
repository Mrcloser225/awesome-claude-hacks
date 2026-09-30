import WebSocket from "ws";
import { AUDIO_CHANNELS, AUDIO_SAMPLE_RATE, type TranscriptSegment } from "@closer/core";
import type { SttProvider } from "./types.js";

interface DeepgramWord { word: string; start: number; end: number; confidence: number; punctuated_word?: string }
interface DeepgramResult {
  type: "Results" | "Metadata" | "UtteranceEnd" | "SpeechStarted";
  channel_index?: [number, number];
  is_final?: boolean;
  speech_final?: boolean;
  start?: number;
  duration?: number;
  channel?: { alternatives: Array<{ transcript: string; confidence: number; words: DeepgramWord[] }> };
}

/**
 * Deepgram Nova-3 live transcription over WebSocket, multichannel mode.
 * Because we send rep and prospect on separate channels, speaker attribution
 * is exact and needs no diarisation model.
 */
export class DeepgramLive implements SttProvider {
  private ws?: WebSocket;
  private segCounter = 0;
  private openSegments = new Map<number, string>(); // channel -> current partial segment id
  private keepAlive?: NodeJS.Timeout;

  constructor(private readonly apiKey: string, private readonly opts: { model?: string; language?: string; endpointingMs?: number } = {}) {}

  async start(h: Parameters<SttProvider["start"]>[0]): Promise<void> {
    const params = new URLSearchParams({
      model: this.opts.model ?? "nova-3",
      language: this.opts.language ?? "en-GB",
      encoding: "linear16",
      sample_rate: String(AUDIO_SAMPLE_RATE),
      channels: String(AUDIO_CHANNELS),
      multichannel: "true",
      interim_results: "true",
      smart_format: "true",
      punctuate: "true",
      endpointing: String(this.opts.endpointingMs ?? 300),
      vad_events: "true",
    });
    const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
    const ws = new WebSocket(url, { headers: { Authorization: `Token ${this.apiKey}` } });
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", (e) => reject(e));
    });

    this.keepAlive = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "KeepAlive" }));
    }, 5000);

    ws.on("message", (data) => {
      let msg: DeepgramResult;
      try {
        msg = JSON.parse(data.toString()) as DeepgramResult;
      } catch {
        return;
      }
      if (msg.type !== "Results" || !msg.channel) return;
      const alt = msg.channel.alternatives[0];
      if (!alt || !alt.transcript.trim()) return;
      const channel = msg.channel_index?.[0] ?? 0;
      const speaker: TranscriptSegment["speaker"] = channel === 0 ? "rep" : "prospect";
      const startMs = Math.round((msg.start ?? 0) * 1000);
      const endMs = Math.round(((msg.start ?? 0) + (msg.duration ?? 0)) * 1000);

      let id = this.openSegments.get(channel);
      if (!id) {
        id = `dg_${channel}_${++this.segCounter}`;
        this.openSegments.set(channel, id);
      }
      const isFinal = Boolean(msg.is_final);
      h.onSegment({ id, speaker, text: alt.transcript, startMs, endMs, isFinal, confidence: alt.confidence });
      if (isFinal) this.openSegments.delete(channel);
    });
    ws.on("error", (e) => h.onError(e instanceof Error ? e : new Error(String(e))));
    ws.on("close", () => {
      if (this.keepAlive) clearInterval(this.keepAlive);
      h.onClose();
    });
  }

  sendAudio(frame: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(frame);
  }

  async stop(): Promise<void> {
    if (this.keepAlive) clearInterval(this.keepAlive);
    const ws = this.ws;
    if (!ws) return;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "CloseStream" }));
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => { ws.terminate(); resolve(); }, 2000);
        ws.once("close", () => { clearTimeout(t); resolve(); });
      });
    } else {
      ws.terminate();
    }
  }
}
