import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { GLAXTONS_PLAYBOOK, type CoachModel, type Playbook } from "@closer/core";
import type { AuthResolver } from "./auth.js";
import { registerLiveRoute } from "./routes/live.js";
import { registerRecallRoute } from "./routes/recall.js";
import { registerRestRoutes } from "./routes/rest.js";
import type { LiveSession } from "./session/live-session.js";
import type { SttFactory } from "./stt/types.js";

export interface AppDeps {
  auth: AuthResolver;
  makeStt: SttFactory;
  model: CoachModel;
  playbooks?: Map<string, Playbook>;
  recallWebhookSecret?: string;
  createBot?: (input: { meetingUrl: string; callId: string; repName: string }) => Promise<{ botId: string }>;
  onCallEnded?: (session: LiveSession) => Promise<void> | void;
  logger?: boolean;
}

/**
 * Builds the Fastify app with all dependencies injected, so tests can run the
 * full pipeline with a fake STT and a fake model.
 */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false });
  await app.register(cors, { origin: true });
  await app.register(websocket, { options: { maxPayload: 1 << 20 } });

  const playbooks = deps.playbooks ?? new Map<string, Playbook>([[GLAXTONS_PLAYBOOK.id, GLAXTONS_PLAYBOOK]]);
  const botSessions = new Map<string, LiveSession>();

  registerRestRoutes(app, {
    auth: deps.auth,
    listPlaybooks: async () => [...playbooks.values()],
    savePlaybook: async (_org, pb) => {
      playbooks.set(pb.id, pb);
      return pb;
    },
    createBot: deps.createBot,
  });

  registerLiveRoute(app, {
    auth: deps.auth,
    makeStt: deps.makeStt,
    model: deps.model,
    resolvePlaybook: async (_org, id) => (id && playbooks.get(id)) || [...playbooks.values()][0] || GLAXTONS_PLAYBOOK,
    onCallEnded: deps.onCallEnded,
  });

  registerRecallRoute(app, {
    webhookSecret: deps.recallWebhookSecret,
    sessionForBot: (botId) => botSessions.get(botId),
  });

  app.decorate("botSessions", botSessions);
  return app;
}
