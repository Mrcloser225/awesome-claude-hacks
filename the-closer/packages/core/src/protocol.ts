import { z } from "zod";
import type { BotStatus, CoachEvent, Insight, TranscriptSegment, CallMetrics } from "./types.js";

/**
 * Wire protocol between the desktop overlay (or meeting bot bridge) and the API.
 *
 * Text frames are JSON messages validated below.
 * Binary frames are raw audio: interleaved stereo PCM16 little-endian at 16 kHz,
 * channel 0 = rep mic, channel 1 = prospect/system audio. 20 ms per frame = 1280 bytes.
 */
export const AUDIO_SAMPLE_RATE = 16_000;
export const AUDIO_CHANNELS = 2;
export const AUDIO_FRAME_MS = 20;
export const AUDIO_FRAME_BYTES = (AUDIO_SAMPLE_RATE / 1000) * AUDIO_FRAME_MS * AUDIO_CHANNELS * 2;

export const CallContextSchema = z.object({
  callId: z.string().min(1),
  rep: z.object({ name: z.string(), company: z.string() }),
  prospect: z
    .object({ name: z.string().optional(), company: z.string().optional(), role: z.string().optional() })
    .optional(),
  deal: z
    .object({
      stage: z.enum(["opening", "discovery", "pitch", "objection", "pricing", "close", "next_steps"]).optional(),
      product: z.string().optional(),
      value: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  playbookId: z.string().optional(),
  briefing: z.string().max(8000).optional(),
});

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session.start"), context: CallContextSchema }),
  z.object({ type: z.literal("session.stop") }),
  /** Attach to a call that is already running (meeting bot path). Receives a snapshot then live events. */
  z.object({ type: z.literal("session.attach"), callId: z.string().min(1) }),
  /** The rep asks the coach something directly, e.g. "give me a close". */
  z.object({ type: z.literal("rep.ask"), question: z.string().min(1).max(500) }),
  /** Transcript supplied by an external source (meeting bot), bypassing audio. */
  z.object({
    type: z.literal("transcript.push"),
    segment: z.object({
      speaker: z.enum(["rep", "prospect", "unknown"]),
      participant: z.string().optional(),
      text: z.string(),
      startMs: z.number(),
      endMs: z.number(),
      isFinal: z.boolean(),
    }),
  }),
  z.object({ type: z.literal("ping") }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type ServerMessage =
  | { type: "session.ready"; callId: string }
  | {
      type: "session.snapshot";
      callId: string;
      transcript: TranscriptSegment[];
      events: CoachEvent[];
      insight: Insight | null;
      metrics: CallMetrics;
      bot: { botId: string; status: BotStatus } | null;
    }
  | { type: "insight"; insight: Insight }
  | { type: "bot.status"; botId: string; status: BotStatus; detail?: string }
  | { type: "transcript.partial"; segment: TranscriptSegment }
  | { type: "transcript.final"; segment: TranscriptSegment }
  | { type: "coach.start"; event: Pick<CoachEvent, "id" | "type" | "priority" | "triggerSegmentId" | "createdAt"> }
  | { type: "coach.delta"; id: string; field: "headline" | "script" | "rationale"; text: string }
  | { type: "coach.done"; event: CoachEvent }
  | { type: "coach.cancelled"; id: string }
  | { type: "metrics"; metrics: CallMetrics }
  | { type: "error"; code: string; message: string }
  | { type: "pong" };

export function parseClientMessage(raw: string): ClientMessage {
  return ClientMessageSchema.parse(JSON.parse(raw));
}
