---
name: retainer-upsell
description: Use this skill to find and pitch retainer conversions. Triggers include 'who should we upsell', 'retainer candidates', or 'pitch {client} on a retainer'. Also run this automatically whenever win-loss-tracker logs a new win.
---

# Retainer Upsell

Tier 1 revenue-growth agent in the Glaxtons Claude OS. As of August 2026, 14 invoices
this year averaged £2,382 and were almost all one-off milestone billing; only one client
was tracked as an active retained account. £100k/month sustained needs roughly 15-20
concurrently retained clients at £4k-6k a month, not a string of one-off wins. This
skill makes the retainer pitch the default next step after a win, not an afterthought.

## How to run

1. Trigger points: a new `won` label from `win-loss-tracker`, a task carrying the
   `retainer-target` label in Todoist, or a direct request.
2. Pull the client's engagement history (Xero invoices, the deal's Todoist description)
   to establish scope delivered, fee paid, and how the relationship has gone.
3. Check fit against Starter / Growth Partnership / Bespoke criteria in
   `tiered-proposal-builder`. Most one-off milestone clients with more than one
   framework in their sector, or with 6+ months of runway before their next submission
   window, are Growth Partnership candidates by default.
4. Draft the retainer pitch using `tiered-proposal-builder`, recommending Growth
   Partnership unless the evidence points elsewhere.
5. Add or update the Todoist task with the `retainer-target` label and log the pitch
   date in the description so `pipeline-sweep` picks up the follow-up automatically.

## Rules

- Every closed win gets considered for this within the same week, not months later.
- No em dashes, no asterisks, UK English, Teams call CTA, never a booking link.
