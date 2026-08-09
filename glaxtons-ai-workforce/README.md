# Glaxtons AI Workforce

Six Claude agent skills built 9 August 2026 to replace the retired ClickUp/n8n agent
stack, targeting a minimum of GBP 100k/month in fees from September 2026.

System of record: Todoist (projects "Glaxtons - Business Development" and
"Glaxtons - Bid Delivery"). Financial truth: Xero. No ClickUp, no n8n.

## The six agents

| Agent | Cadence | Closes |
|---|---|---|
| lead-router | On demand + daily via Lead Scout routine | Tender signals dead-ending without a named company to pitch |
| pipeline-sweep | Weekday mornings via routine | Warm leads going silent for months instead of days |
| win-loss-tracker | On every deal close | Empty win/loss record, unknown conversion rate |
| revenue-truth | Monday mornings via routine | No single honest weekly number against target |
| content-shipper | On demand, one article per run | 50+ scoped SEO articles sitting unpublished |
| retainer-upsell | On every win + on demand | One-off milestone billing instead of retained revenue |

## Scheduled routines (claude.ai)

- Glaxtons Lead Scout — weekdays 06:00 UTC
- Glaxtons Pipeline Sweep — weekdays 07:00 UTC
- Glaxtons Revenue Truth — Mondays 06:30 UTC

Note: routines created via API run without Todoist/Xero connectors attached. Re-save
them from the claude.ai Routines UI with those connectors enabled for full capability.

## Recovered assets

- `skills/lead-router/references/target-accounts.md` — 35 hand-tagged HOT/WARM target
  companies recovered from the old pipeline before retirement
- `skills/content-shipper/references/seo-queue.md` — the full scoped SEO backlog

## To install in a new environment

Copy each directory under `skills/` into `~/.claude/skills/`.
