# Backend status

What is built and tested, and what is still missing before you rely on it for live calls and before you sell seats. Honest list, updated 1 October 2026.

## Built and tested (23 API tests, 23 core tests)

| Area | State |
|---|---|
| Live pipeline | Audio or bot transcript in, coach cards streamed out, priority pre-emption, talk metrics. Tested over a real socket. |
| Meeting bot | Recall.ai create bot (immediate or scheduled with `join_at`), transcript and lifecycle webhooks, named-participant attribution, call closed out on bot leaving. |
| Calendar auto-join | Microsoft 365 and Google Calendar OAuth, token refresh, 5-minute scheduler, external-only filter, idempotent booking, per-connection bot name, preview of the next 24 hours. Tested with fake providers. |
| Coach brain | Playbook plus knowledge base in a cached system prompt, question answering, discovery tracker, call chat, post-call summary. Claude native; OpenAI-compatible adapter for every other provider. |
| Accounts | Email and password, scrypt, JWT in HttpOnly cookie, Bearer for the desktop app. Tenant isolation tested. |
| Persistence | Postgres through Drizzle for users, orgs, calls, knowledge, playbooks, calendar connections and scheduled bots. Migrations run on boot. Round-trip tested against Postgres 16. In-memory fallback when `DATABASE_URL` is unset. |
| Fireflies | Import existing transcripts with rep attribution. |
| Deploy | Dockerfile, Fly config, Vercel config. Web is live on Vercel. |

## Missing, in the order it matters for your own calls

1. **The API is not deployed.** The website on Vercel points at `https://api.thecloser.ai`, which does not exist yet. Until the API runs somewhere public, sign-in and calls fail. One command on Fly (`docs/DEPLOY.md`), plus a Postgres (`fly postgres create` or Neon) and `DATABASE_URL`.
2. **Vendor keys.** Anthropic (or another provider), Recall.ai, and an Entra app registration for Microsoft calendar access. Without Recall there is no bot. Without the Entra app there is no auto-join and you paste links instead.
3. **Recall webhook signature.** `RECALL_WEBHOOK_SECRET` is supported but optional. Set it in production or anyone who finds the URL can inject transcript.
4. **No end-to-end run against the real vendors has happened.** Every integration is written to the documented wire formats and tested against fakes. The first real call will surface small mismatches (a field name, a status code). Budget an afternoon with the logs open.

## Missing before paying customers

- **Billing.** No Stripe. Plans in the pricing table are copy, not enforcement.
- **Rate limits and quotas.** Nothing stops one tenant from burning the model budget.
- **Password reset, email verification, invitations, roles.** Single-user orgs only. A manager cannot see a rep's calls.
- **API keys table.** Schema exists; the route to mint and revoke keys does not. The desktop app uses the JWT or the dev key.
- **CRM sync.** Salesforce adapter exists; nothing calls it. No HubSpot. No OAuth for either.
- **Observability.** Pino logs only. No error tracker, no metrics, no alert when the scheduler stops booking bots.
- **Token encryption at rest.** Calendar access and refresh tokens are stored in plain columns. Encrypt with a KMS key before any customer connects a calendar.
- **Data retention and deletion.** No way for a tenant to delete a call or export their data. GDPR needs both.
- **Consent.** Recording disclosure is a bot-name convention, not a product control. Decide and enforce.
- **Load.** One process, one hub in memory. Multiple API instances need the hub in Redis or sticky sessions. Fine for you and a team of ten; not fine for a thousand seats.

## How auto-join works, step by step

1. In the web app, Auto-join, Connect Microsoft 365. You consent to `Calendars.Read`. We store the refresh token against your user.
2. Every five minutes the scheduler reads your next 20 minutes of calendar. For each meeting that is not cancelled, has a Teams, Zoom, Meet or Webex link, and (by default) has at least one attendee outside your email domain, it asks Recall for a bot with `join_at` one minute before the start.
3. The bot joins under your configured name. Recall posts transcript and status to the API. The call page at `/app/calls/<id>` is live from the moment the bot is booked, so you can open it before the meeting and have it on a second screen.
4. When the bot leaves, the call is frozen to Postgres, the summary runs, and the record is in your call list.

The settings page shows the next 24 hours with "will join", "bot booked", or the reason it will not join.
