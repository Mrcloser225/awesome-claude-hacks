import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { LiveSession } from "../session/live-session.js";

/**
 * Meeting-bot path. Recall.ai (or an equivalent bot provider) joins the Teams,
 * Zoom or Meet call as a participant and posts real-time transcript events to
 * this webhook. We map participant -> speaker and feed the same LiveSession
 * the desktop path uses. No audio ever touches this server on this path.
 *
 * Payload shape follows Recall's `transcript.data` real-time event.
 */
const RecallTranscriptEvent = z.object({
  event: z.string(),
  data: z.object({
    bot: z.object({ id: z.string(), metadata: z.record(z.string()).optional() }).optional(),
    data: z.object({
      participant: z.object({ id: z.number().optional(), name: z.string().nullable().optional(), is_host: z.boolean().optional() }).optional(),
      words: z.array(z.object({ text: z.string(), start_timestamp: z.object({ relative: z.number() }), end_timestamp: z.object({ relative: z.number() }).nullable() })),
    }),
  }),
});

export interface RecallDeps {
  webhookSecret?: string;
  /** Find the live session for a bot id (set when the bot was created with metadata.callId). */
  sessionForBot: (botId: string) => LiveSession | undefined;
  /** Decide whether a participant is the rep. Default: the bot's metadata.repName matches. */
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
  app.post("/v1/webhooks/recall", { config: { rawBody: true } }, async (req, reply) => {
    if (deps.webhookSecret) {
      const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const ok = verifyRecallSignature(deps.webhookSecret, raw, req.headers["x-recall-signature"] as string | undefined);
      if (!ok) return reply.code(401).send({ error: "bad signature" });
    }
    const parsed = RecallTranscriptEvent.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const evt = parsed.data;
    if (evt.event !== "transcript.data" && evt.event !== "transcript.partial_data") return reply.code(204).send();
    const botId = evt.data.bot?.id;
    const session = botId ? deps.sessionForBot(botId) : undefined;
    if (!session) return reply.code(404).send({ error: "no session for bot" });

    const words = evt.data.data.words;
    if (words.length === 0) return reply.code(204).send();
    const name = evt.data.data.participant?.name ?? null;
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
