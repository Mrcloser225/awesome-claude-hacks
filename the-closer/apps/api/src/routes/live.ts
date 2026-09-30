import type { FastifyInstance } from "fastify";
import { parseClientMessage, type CallContext, type ServerMessage } from "@closer/core";
import type { AuthResolver } from "../auth.js";
import { extractToken } from "../auth.js";
import type { SessionHub } from "../session/hub.js";
import type { LiveSession } from "../session/live-session.js";

export interface LiveDeps {
  auth: AuthResolver;
  hub: SessionHub;
  /** Builds a session for a desktop-driven call. The hub supplies the broadcaster. */
  createSession: (ctx: CallContext, send: (m: ServerMessage) => void) => Promise<LiveSession>;
  onCallEnded?: (session: LiveSession) => Promise<void> | void;
}

/**
 * WS /v1/live
 * Text frames: ClientMessage JSON. Binary frames: stereo PCM16 audio.
 *
 * Two modes on the same socket:
 *   session.start  -> this socket owns a new call and streams audio into it
 *   session.attach -> this socket watches a call that already exists (bot path);
 *                     it can still ask the coach questions
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

    let owned: LiveSession | undefined;
    let attached: { session: LiveSession; detach: () => void } | undefined;
    const log = req.log;
    const current = () => owned ?? attached?.session;

    const endOwned = async () => {
      if (!owned) return;
      const s = owned;
      owned = undefined;
      await s.stop();
      deps.hub.remove(s.ctx.callId);
      await deps.onCallEnded?.(s);
    };

    let chain: Promise<void> = Promise.resolve();
    socket.on("message", (data, isBinary) => {
      chain = chain.then(() => handle(data, isBinary)).catch((err) => log.error({ err }, "unhandled in live route"));
    });

    const handle = async (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean): Promise<void> => {
      try {
        if (isBinary) {
          owned?.audio(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
          return;
        }
        const msg = parseClientMessage(data.toString());
        switch (msg.type) {
          case "session.start": {
            await endOwned();
            attached?.detach();
            attached = undefined;
            const session = await deps.createSession(msg.context, deps.hub.broadcaster(msg.context.callId));
            deps.hub.register(session);
            deps.hub.attach(msg.context.callId, send);
            owned = session;
            await session.start();
            break;
          }
          case "session.attach": {
            await endOwned();
            attached?.detach();
            const session = deps.hub.get(msg.callId);
            if (!session) return send({ type: "error", code: "no_such_call", message: `No live call ${msg.callId}` });
            const detach = deps.hub.attach(msg.callId, send);
            attached = detach ? { session, detach } : undefined;
            break;
          }
          case "transcript.push": {
            const s = current();
            if (!s) return send({ type: "error", code: "no_session", message: "Send session.start or session.attach first" });
            s.ingest({ ...msg.segment, id: `ext_${msg.segment.startMs}_${msg.segment.speaker}` });
            break;
          }
          case "rep.ask": {
            const s = current();
            if (!s) return send({ type: "error", code: "no_session", message: "Send session.start or session.attach first" });
            s.ask(msg.question);
            break;
          }
          case "session.stop":
            await endOwned();
            attached?.detach();
            attached = undefined;
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
      attached?.detach();
      await endOwned();
    });
  });
}
