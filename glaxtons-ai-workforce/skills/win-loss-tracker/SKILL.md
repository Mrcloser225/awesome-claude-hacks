---
name: win-loss-tracker
description: Use this skill the moment any deal closes, either way. Triggers include 'we won X', 'we lost X', 'close out this deal', or 'log the outcome for {client}'. Also use when asked for the real conversion rate or win rate.
---

# Win/Loss Tracker

Tier 1 revenue-growth agent in the Glaxtons Claude OS. As of August 2026 the Won Bids
and Lost Bids archives were completely empty despite dozens of live and clearly-dead
opportunities, so there was no way to know a real conversion rate or learn from a loss.
This skill makes closing a deal out a five-second act instead of something that never
happens.

## Input contract

- deal: { company, outcome (won | lost), value, reason }

`reason` is mandatory for a loss. One sentence is enough: price, timing, went with a
Big Four firm, went in-house, went cold with no explanation given.

## How to run

1. Find the matching Todoist task in project `6gXwrJJPrX4QfMJH` (Bid Delivery) or
   `6gXwrJGjGv4cPJHp` (Business Development).
2. Add the `won` or `lost` label. Add the value and reason to the task description.
3. Mark the task complete in Todoist.
4. Append one line to the running ledger at
   `/mnt/outputs/Glaxtons Clients/Deal Ledger/win-loss-ledger.md`
   (create the file with a header row if it does not exist yet):
   `date | company | outcome | value | reason`
5. On request, or as part of `revenue-truth`, read the full ledger back and compute:
   win rate (won / (won + lost)), average deal value by outcome, and the most common
   loss reason. Report these plainly, without softening a bad number.

## Rules

- A deal that has gone quiet for 60+ days with no explicit decision should be raised to
  JP as a forced choice (call it lost with "went cold" as the reason, or confirm it is
  genuinely still live) rather than left unresolved indefinitely.
- No em dashes, no asterisks, UK English.
