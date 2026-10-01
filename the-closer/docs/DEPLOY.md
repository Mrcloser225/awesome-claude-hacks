# Deploying TheCloser.ai

Two services. The website is static-plus-client and belongs on Vercel. The API holds WebSockets open for the length of a call and streams server-sent events, so it belongs on a long-running host.

## 1. Website on Vercel (two minutes)

1. vercel.com, Add New, Project, Import `Mrcloser225/awesome-claude-hacks`.
2. Root Directory: `the-closer/apps/web`. Framework: Next.js (detected). The install and build commands are read from `apps/web/vercel.json`, so leave them.
3. Environment variable: `NEXT_PUBLIC_API_URL` = the API's public URL (step 2). Use `https://api.thecloser.ai` once DNS exists.
4. Production branch: `main` after the pull request merges. Until then, deploy from `claude/busy-bell-j0pl18` by selecting that branch when importing.
5. Deploy. The project URL is `https://the-closer-<team>.vercel.app`; add `thecloser.ai` under Domains.

If you would rather I deploy it: create an empty project in the Vercel dashboard named `the-closer` and tell me. The Claude Vercel connector on this account can deploy into existing projects but is not allowed to create them.

## 2. API on Fly.io (or Railway, Render)

```bash
cd the-closer
fly launch --no-deploy --name thecloser-api --dockerfile apps/api/Dockerfile
fly secrets set ANTHROPIC_API_KEY=... RECALL_API_KEY=... JWT_SECRET=$(openssl rand -hex 32) \
  PUBLIC_URL=https://thecloser-api.fly.dev SECURE_COOKIES=true CLOSER_DEV_API_KEY=$(openssl rand -hex 24)
fly deploy
```

Then point `NEXT_PUBLIC_API_URL` at `https://thecloser-api.fly.dev` and redeploy the web app. Put `api.thecloser.ai` on it with `fly certs add api.thecloser.ai`.

Switching models: set `LLM_PROVIDER` (openai, xai, google, qwen, deepseek, mistral, groq, openrouter, ollama, custom) and `LLM_API_KEY`, optionally `LLM_MODEL`. Leave `LLM_PROVIDER` unset for Claude.

## 3. Before real customers

- Implement `UserStore` and `CallStore` on Postgres (schema in `apps/api/src/db/schema.ts`); the in-memory versions forget everything on restart. `fly postgres create` or Neon.
- Set a Recall webhook secret (`RECALL_WEBHOOK_SECRET`) so only Recall can post transcripts.
- Decide the recording disclosure policy and bake it into the bot name default.
