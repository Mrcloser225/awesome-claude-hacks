import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { GLAXTONS_PLAYBOOK, type CallContext, type CoachModel, type InsightModel, type KnowledgeDoc, type Playbook, type ServerMessage } from "@closer/core";
import type { AuthResolver } from "./auth.js";
import { registerLiveRoute } from "./routes/live.js";
import { registerRecallRoute } from "./routes/recall.js";
import { registerRestRoutes } from "./routes/rest.js";
import { SessionHub } from "./session/hub.js";
import { LiveSession } from "./session/live-session.js";
import { NoopStt } from "./stt/none.js";
import type { SttFactory } from "./stt/types.js";

export interface AppDeps {
  auth: AuthResolver;
  makeStt: SttFactory;
  model: CoachModel;
  insightModel?: InsightModel;
  playbooks?: Map<string, Playbook>;
  knowledge?: Map<string, KnowledgeDoc>;
  recallWebhookSecret?: string;
  createBot?: (input: { meetingUrl: string; callId: string; repName: string }) => Promise<{ botId: string }>;
  onCallEnded?: (session: LiveSession) => Promise<void> | void;
  logger?: boolean;
}

/**
 * Builds the Fastify app with every dependency injected, so tests can run the
 * full pipeline with a fake STT and fake models. In-memory stores here; the
 * Drizzle-backed versions plug into the same functions.
 */
export async function buildApp(deps: AppDeps): Promise<{ app: FastifyInstance; hub: SessionHub }> {
  const app = Fastify({ logger: deps.logger ?? false });
  await app.register(cors, { origin: true });
  await app.register(websocket, { options: { maxPayload: 1 << 20 } });

  const playbooks = deps.playbooks ?? new Map<string, Playbook>([[GLAXTONS_PLAYBOOK.id, GLAXTONS_PLAYBOOK]]);
  const knowledge = deps.knowledge ?? new Map<string, KnowledgeDoc>();
  const hub = new SessionHub();

  const resolvePlaybook = (id?: string): Playbook => (id && playbooks.get(id)) || [...playbooks.values()][0] || GLAXTONS_PLAYBOOK;

  const createSession = async (ctx: CallContext, send: (m: ServerMessage) => void, opts: { audio: boolean }) =>
    new LiveSession(ctx, {
      stt: opts.audio ? deps.makeStt() : new NoopStt(),
      model: deps.model,
      insightModel: deps.insightModel,
      playbook: resolvePlaybook(ctx.playbookId),
      knowledge: [...knowledge.values()],
      send,
      log: app.log,
    });

  registerRestRoutes(app, {
    auth: deps.auth,
    hub,
    listPlaybooks: async () => [...playbooks.values()],
    savePlaybook: async (_org, pb) => { playbooks.set(pb.id, pb); return pb; },
    listKnowledge: async () => [...knowledge.values()],
    saveKnowledge: async (_org, doc) => { knowledge.set(doc.id, doc); return doc; },
    deleteKnowledge: async (_org, id) => { knowledge.delete(id); },
    createBot: deps.createBot,
    createSession: (ctx, send) => createSession(ctx, send, { audio: false }),
  });

  registerLiveRoute(app, {
    auth: deps.auth,
    hub,
    createSession: (ctx, send) => createSession(ctx, send, { audio: true }),
    onCallEnded: deps.onCallEnded,
  });

  registerRecallRoute(app, { webhookSecret: deps.recallWebhookSecret, hub, onCallEnded: deps.onCallEnded });

  return { app, hub };
}
