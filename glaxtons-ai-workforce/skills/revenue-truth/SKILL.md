---
name: revenue-truth
description: Use this skill every Monday morning, or whenever asked 'where are we against target', 'what's the real number', or 'give me the revenue truth'. Pulls live Xero and Todoist data into one honest readout against the £100k/month target.
---

# Revenue Truth

Tier 1 revenue-growth agent in the Glaxtons Claude OS. Replaces the old finance agent
that posted silent weekly health checks nobody read. This skill exists to put one
undeniable number in front of Jean Pascal every week: are we closer to £100k/month or
not, and exactly why.

## How to run

1. Pull from Xero: `get_profit_and_loss` for the current month to date and trailing 12
   months, `show_invoices_summary` for the current month, `get_top_customers_by_revenue`
   trailing 12 months, `get_aged_receivables`.
2. Pull from Todoist: count of open tasks by label (`hot`, `warm`, `at-risk`,
   `retainer-target`) across projects `6gXwrJGjGv4cPJHp` and `6gXwrJJPrX4QfMJH`, and
   count of tasks overdue right now (the pipeline-sweep backlog).
3. Read `/mnt/outputs/Glaxtons Clients/Deal Ledger/win-loss-ledger.md` if it exists, for
   month-to-date wins, losses, and win rate.
4. Compute: month-to-date revenue, run-rate needed for the rest of the month to hit
   £100k, gap in pounds and as a multiple, and trend versus the prior week's readout if
   one exists.
5. Output a short report, five sections maximum: the number, what closed this week,
   what's overdue in the pipeline right now, the single biggest risk to next week's
   number, and one specific recommended action.

## Rules

- State the real number first, before any context or caveats. Never bury a bad week.
- Keep it under one page. This replaces a wall of silent tickets, not creates a new one.
- No em dashes, no asterisks, UK English.
