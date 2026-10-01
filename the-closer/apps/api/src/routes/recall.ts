import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { BotStatus } from "@closer/core";
import type { SessionHub } from "../session/hub.js";
import type { LiveSession } from "../session/live-session.js";

/**
 * Meeting-bot path. Recall.ai joins the Teams, Zoom or Meet call as a
 * participant and posts real-time transcript and status events here. We map
 * participant -> speaker and feed the same LiveSession the desktop path uses.
 * No audio touches this server on this path.
 */
const Word = z.object({
  text: z.string(),
  start_timestamp: z.object({ relative: z.number() }),
  end_timestamp: z.object({ relative: z.number() }).nullable(),
});

const RecallEvent = z.object({
  event: z.string(),
  data: z.object({
    bot: z.object({ id: z.string(), metadata: z.record(z.string()).optional() }).optional(),
    data: z
      .object({
        participant: z.object({ id: z.number().optional(), name: z.string().nullable().optional(), is_host: z.boolean().optional() }).optional(),
        words: z.array(Word).optional(),
        code: z.string().optional(),
        sub_code: z.string().nullable().optional(),
      })
      .optional(),
  }),
});

/** Recall bot status codes -> our status vocabulary. */
const STATUS_MAP: Record<string, BotStatus> = {
  joining_call: "joining",
  in_waiting_room: "waiting_room",
  in_call_not_recording: "in_call",
  in_call_recording: "in_call",
  recording_permission_allowed: "in_call",
  recording_permission_denied: "failed",
  call_ended: "ended",
  done: "ended",
  fatal: "failed",
};

export interface RecallDeps {
  webhookSecret?: string;
  hub: SessionHub;
  onCallEnded?: (session: LiveSession) => Promise<void> | void;
  /** Called once when the bot is in the call, with the org that owns it. Used for the recording disclosure. */
  onInCall?: (botId: string, callId: string) => Promise<void> | void;
  /** When the call lives on another instance, hand the segment over the bus. */
  forwardIngest?: (callId: string, seg: Parameters<LiveSession["ingest"]>[0]) => Promise<void>;
  /** Decide whether a participant is the rep. Default: name matches bot metadata.repName. */
  isRep?: (participantName: string | null | undefined, botMetadata: Record<string, string> | undefined) => boolean;
}

export function verifyRecallSignature(secret: string, rawBody: string, header: string | undefined): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerRecallRoute(app: FastifyInstance, deps: RecallDeps): void {
  app.post("/v1/webhooks/recall", async (req, reply) => {
    if (deps.webhookSecret) {
      const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const ok = verifyRecallSignature(deps.webhookSecret, raw, req.headers["x-recall-signature"] as string | undefined);
      if (!ok) return reply.code(401).send({ error: "bad signature" });
    }
    const parsed = RecallEvent.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const evt = parsed.data;
    const botId = evt.data.bot?.id;
    if (!botId) return reply.code(204).send();

    // Lifecycle: bot.status_change / bot.done / bot.fatal
    if (evt.event.startsWith("bot.")) {
      const code = evt.data.data?.code ?? evt.event.replace("bot.", "");
      const status = STATUS_MAP[code] ?? (evt.event === "bot.done" ? "ended" : evt.event === "bot.fatal" ? "failed" : undefined);
      if (!status) return reply.code(204).send();
      const session = deps.hub.setBotStatus(botId, status, evt.data.data?.sub_code ?? undefined);
      if (session && status === "in_call" && code === "in_call_recording" && deps.onInCall) {
        try { await deps.onInCall(botId, session.ctx.callId); } catch (err) { req.log.warn({ err, botId }, "disclosure failed"); }
      }
      if (session && (status === "ended" || status === "failed")) {
        await session.stop();
        await deps.onCallEnded?.(session); // persist while the hub still knows the tenant
        deps.hub.remove(session.ctx.callId);
      }
      return reply.code(204).send();
    }

    if (evt.event !== "transcript.data" && evt.event !== "transcript.partial_data") return reply.code(204).send();
    const session = deps.hub.forBot(botId);
    const words = evt.data.data?.words ?? [];
    if (!session) {
      // Another instance may own this bot's call.
      const callId = await deps.hub.callForBot(botId);
      if (callId && deps.forwardIngest && words.length > 0) {
        const name = evt.data.data?.participant?.name ?? null;
        const meta = evt.data.bot?.metadata;
        const isRep = Boolean(meta?.repName && name && name.toLowerCase() === meta.repName.toLowerCase());
        const startMs = Math.round(words[0]!.start_timestamp.relative * 1000);
        const last = words[words.length - 1]!;
        await deps.forwardIngest(callId, { id: `recall_${botId}_${startMs}_${isRep ? "r" : "p"}`, speaker: isRep ? "rep" : "prospect", participant: name ?? undefined, text: words.map((w) => w.text).join(" "), startMs, endMs: Math.round((last.end_timestamp?.relative ?? last.start_timestamp.relative) * 1000), isFinal: evt.event === "transcript.data" });
        return reply.code(204).send();
      }
      return reply.code(404).send({ error: "no session for bot" });
    }

    if (words.length === 0) return reply.code(204).send();
    const name = evt.data.data?.participant?.name ?? null;
    const meta = evt.data.bot?.metadata;
    const isRep = deps.isRep ? deps.isRep(name, meta) : Boolean(meta?.repName && name && name.toLowerCase() === meta.repName.toLowerCase());
    const startMs = Math.round(words[0]!.start_timestamp.relative * 1000);
    const last = words[words.length - 1]!;
    const endMs = Math.round((last.end_timestamp?.relative ?? last.start_timestamp.relative) * 1000);
    session.ingest({
      id: `recall_${botId}_${startMs}_${isRep ? "r" : "p"}`,
      speaker: isRep ? "rep" : "prospect",
      participant: name ?? undefined,
      text: words.map((w) => w.text).join(" "),
      startMs,
      endMs,
      isFinal: evt.event === "transcript.data",
    });
    return reply.code(204).send();
  });
}
