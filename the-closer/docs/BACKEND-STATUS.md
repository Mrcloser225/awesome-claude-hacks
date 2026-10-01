# Backend status

What is built and tested, and what still needs your hands. Updated 1 October 2026.

## Built and tested

| Area | State |
|---|---|
| Live pipeline | Audio or bot transcript in, coach cards streamed out, priority pre-emption, talk metrics. Tested over a real socket. |
| Meeting bot | Recall.ai create bot (immediate or scheduled), transcript and lifecycle webhooks, named-participant attribution, call closed out on bot leaving. |
| Calendar auto-join | Microsoft 365 and Google OAuth with refresh, 5-minute scheduler, external-only filter, idempotent booking, per-connection bot name, 24-hour preview. |
| Coach brain | Playbook plus knowledge base in a cached system prompt, question answering, discovery tracker, call chat, post-call summary. Claude native; OpenAI-compatible adapter for OpenAI, Grok, Gemini, Qwen, DeepSeek, Mistral, Groq, OpenRouter, Ollama, custom. |
| Accounts | Email and password, scrypt, JWT cookie, email verification, password reset, invitations with roles (rep, manager, admin), API keys shown once and stored hashed. Reps see their own calls; managers and admins see the org. |
| Billing | Stripe Checkout per seat, customer portal, signed webhooks that set plan and seats. Trial: five free calls. Seat count enforced on invitations. |
| Quotas and rate limits | Per-plan limits on bots per day, coach lines per minute, chat messages per minute. Daily usage counters per org. Redis-shared limits when scaled out. |
| CRM | Salesforce (Connected App OAuth, Task of type Call on the matching Contact or Lead) and HubSpot (OAuth, Call engagement on the Contact). Auto-push after every summary, manual push per call, record id stored on the call. |
| Persistence | Postgres through Drizzle for everything: orgs, users, tokens, API keys, calls, knowledge, playbooks, calendar and CRM connections, scheduled bots, usage. Migrations run on boot. |
| Secrets at rest | Calendar and CRM tokens encrypted with AES-256-GCM under `ENCRYPTION_KEY`. Legacy plaintext rows still read. |
| Data controls | Export the whole organisation as JSON. Delete one call. Delete the organisation and everything in it. Per-org retention window with a nightly purge. |
| Consent | Per-org disclosure setting. Default posts a notice in the meeting chat the moment the bot is in the call. |
| Observability | Prometheus metrics at `/metrics` (live calls, coach calls, bots booked, disclosures, errors, job heartbeats). `/health` returns 503 with the job name when auto-join or retention stops running. Unhandled errors go to `ERROR_WEBHOOK_URL` (Slack or any JSON sink). |
| Scale-out | Redis event bus: watchers on any instance see any call; a webhook that lands on the wrong instance is forwarded to the owner. Tested with two live instances against Redis. |
| Email | Resend over REST. Console fallback prints the links in development. |
| Deploy | Dockerfile, Fly config, Vercel config. Web is live on Vercel. |

Tests: 23 in core, 39 in the API (Postgres and Redis suites included), all passing in CI with service containers.

## Needs your hands, in order

1. **Deploy the API.** `docs/DEPLOY.md`, section 2. Fly plus a Postgres plus a Redis if you run more than one instance. Then set `NEXT_PUBLIC_API_URL` on the Vercel project and redeploy.
2. **Keys.** Anthropic (or another provider), Recall.ai, `ENCRYPTION_KEY`, `JWT_SECRET`. Then, as you need them: Entra app for Microsoft calendar, Google OAuth client, Stripe keys and two prices, Resend key, Salesforce Connected App, HubSpot public app. Every variable is in `.env.example` with the callback URL it needs.
3. **Vercel protection.** Vercel, the-closer, Settings, Deployment Protection, Vercel Authentication off. The connector cannot change project settings.
4. **First real call.** Everything is written to the documented wire formats and tested against fakes. Budget an afternoon with the logs open for the first live Recall and Stripe events.

## Known limits, by design for now

- One Recall bot per meeting per org. Two reps on the same external call each get their own bot unless one of them turns auto-join off for it.
- Prospect email for CRM matching comes from the calendar attendee list. Calls started by pasting a link have no email, so the CRM record is created unlinked; the note still lands.
- The Teams side panel still uses an API key; the JWT works too. SSO (Microsoft or Google sign-in) is not built; email and password only.
- Usage is counted, not billed by usage. Plans are flat per seat.
