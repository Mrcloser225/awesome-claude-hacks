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

## 2b. Calendar auto-join credentials

Microsoft: Entra admin centre, App registrations, New registration. Supported account types: any organisational directory and personal accounts. Redirect URI (Web): `https://<api host>/v1/integrations/calendar/microsoft/callback`. API permissions (delegated): `Calendars.Read`, `User.Read`, `offline_access`. Create a client secret. Set `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT=common`.

Google: Google Cloud console, APIs and Services, enable Google Calendar API, OAuth consent screen (external, add the calendar.readonly and userinfo.email scopes), Credentials, OAuth client ID (Web application) with redirect URI `https://<api host>/v1/integrations/calendar/google/callback`. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

Set `WEB_URL=https://the-closer-five.vercel.app` (or your domain) so the browser lands back on the settings page.

## 3. Before real customers

- Set `DATABASE_URL`. Migrations run on boot. Without it the API uses in-memory stores and forgets everything on restart.
- Set a Recall webhook secret (`RECALL_WEBHOOK_SECRET`) so only Recall can post transcripts.
- Decide the recording disclosure policy and bake it into the bot name default.
