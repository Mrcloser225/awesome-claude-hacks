---
name: lead-router
description: Use this skill whenever a tender, framework opportunity, or council/NHS/government signal needs to be turned into a named company Glaxtons can actually pitch. Triggers include 'route this lead', 'who would be bidding on this', 'turn this tender into a target', or any pasted procurement notice, ITT, or framework alert.
---

# Lead Router

Tier 1 revenue-growth agent in the Glaxtons Claude OS. This is the missing first step
that let 60-90 tender signals a month produce almost no pipeline: a signal names the
buyer (a council, an NHS trust, a government department), never the contractor who
needs help winning it. This skill closes that gap.

## What this skill produces

For each tender/framework signal: zero or more named candidate companies likely to bid
on it, each added to Todoist as a real, workable lead — not a headline that dead-ends.

## Input contract

- signal: { buyer, opportunity_title, framework, sector, deadline, source_url }
- Can also be run in batch against a list of signals.

## How to run

1. Check `references/target-accounts.md` first for a sector match against the buyer's
   need. This is a recovered list of 35 pre-qualified HOT/WARM target companies.
2. If no match, identify 2-4 candidate companies plausibly bidding on this opportunity
   (web search: who operates in this sector and geography, who has bid on adjacent
   frameworks, who is named in Find a Tender / Contracts Finder award notices for
   similar work).
3. For each candidate, search Todoist project `6gXwrJGjGv4cPJHp` (Glaxtons - Business
   Development) by company name to avoid duplicating an existing lead.
4. For every net-new candidate, add a Todoist task to that project: company name as
   title, sector + the triggering opportunity + suggested contact (if found) in the
   description, `hot` or `warm` label by confidence, due date today if the deadline is
   under 30 days out, otherwise this week.
5. If a contact name and role are already known, hand off immediately to
   `lead-qualification-scorer` to produce a real score and next action.
6. Report back: candidates considered, net-new leads created, duplicates skipped.

## Rules

- Never create a lead with no identifiable company. A tender headline alone is not a
  lead and should not be logged as one.
- Always check for duplicates before creating. This list will be worked daily by
  `pipeline-sweep`; noise in it costs real follow-up time.
- UK English throughout, no em dashes, no asterisks in any written output.
