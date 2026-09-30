import type { FastifyInstance } from "fastify";
import { parseClientMessage, type Playbook, type ServerMessage, type CoachModel } from "@closer/core";
import type { AuthResolver } from "../auth.js";
import { extractToken } from "../auth.js";
import { LiveSession } from "../session/live-session.js";
import type { SttFactory } from "../stt/types.js";

export interface LiveDeps {
  auth: AuthResolver;
  makeStt: SttFactory;
  model: CoachModel;
  resolvePlaybook: (orgId: string, playbookId?: string) => Promise<Playbook>;
  onCallEnded?: (session: LiveSession) => Promise<void> | void;
}

/**
 * WS /v1/live
 * Text frames: ClientMessage JSON. Binary frames: stereo PCM16 audio.
 */
export function registerLiveRoute(app: FastifyInstance, deps: LiveDeps): void {
  app.get("/v1/live", { websocket: true }, async (socket, req) => {
    const token = extractToken(req);
    const principal = token ? await deps.auth.resolve(token) : null;
    const send = (msg: ServerMessage) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
    };
    if (!principal) {
      send({ type: "error", code: "unauthorised", message: "Missing or invalid API key" });
      socket.close(4401, "unauthorised");
      return;
    }

    let session: LiveSession | undefined;
    const log = req.log;

    // Messages are processed strictly in order. session.start awaits the STT
    // connection, and audio frames that arrive meanwhile must queue behind it,
    // not race past it and get dropped.
    let chain: Promise<void> = Promise.resolve();
    socket.on("message", (data, isBinary) => {
      chain = chain.then(() => handle(data, isBinary)).catch((err) => log.error({ err }, "unhandled in live route"));
    });

    const handle = async (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean): Promise<void> => {
      try {
        if (isBinary) {
          session?.audio(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
          return;
        }
        const msg = parseClientMessage(data.toString());
        switch (msg.type) {
          case "session.start": {
            if (session) await session.stop();
            const playbook = await deps.resolvePlaybook(principal.orgId, msg.context.playbookId);
            session = new LiveSession(msg.context, { stt: deps.makeStt(), model: deps.model, playbook, send, log });
            await session.start();
            break;
          }
          case "transcript.push": {
            if (!session) return send({ type: "error", code: "no_session", message: "Send session.start first" });
            session.ingest({ ...msg.segment, id: `ext_${msg.segment.startMs}_${msg.segment.speaker}` });
            break;
          }
          case "rep.ask":
            if (!session) return send({ type: "error", code: "no_session", message: "Send session.start first" });
            session.ask(msg.question);
            break;
          case "session.stop":
            if (session) {
              const s = session;
              session = undefined;
              await s.stop();
              await deps.onCallEnded?.(s);
            }
            break;
          case "ping":
            send({ type: "pong" });
            break;
        }
      } catch (err) {
        log.warn({ err }, "bad client message");
        send({ type: "error", code: "bad_message", message: err instanceof Error ? err.message : String(err) });
      }
    };

    socket.on("close", async () => {
      await chain;
      if (session) {
        const s = session;
        session = undefined;
        await s.stop();
        await deps.onCallEnded?.(s);
      }
    });
  });
}
