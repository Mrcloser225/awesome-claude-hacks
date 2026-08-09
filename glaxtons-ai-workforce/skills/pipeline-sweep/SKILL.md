---
name: pipeline-sweep
description: Use this skill daily, or whenever asked 'what needs following up', 'sweep the pipeline', or 'what's gone stale'. Reads every open lead and deal in Todoist and drafts the next follow-up touch for anything due or overdue, instead of letting it rot.
---

# Pipeline Sweep

Tier 1 revenue-growth agent in the Glaxtons Claude OS. The single highest-impact fix
identified in the August 2026 gap analysis: real, warm leads at Tier 1 main contractors
were going three to four months without a follow-up because nothing forced the next
touch to happen. This skill is that forcing function, run daily.

## What this skill produces

One batch of ready-to-send follow-up drafts, covering every lead and deal that is due
or overdue, presented together for a single approve-and-send pass. Nothing sends itself.

## How to run

1. Call Todoist `find-tasks` with `filter: "(overdue | today) & !@won & !@lost"` across
   project `6gXwrJGjGv4cPJHp` (Business Development) and `6gXwrJJPrX4QfMJH` (Bid
   Delivery).
2. For each task, read its description for last-touch context (what was already sent,
   how long ago).
3. Pick the right stage from `follow-up-email-cadence`: value-add insight if this is the
   first touch since being logged, a named framework opportunity if a week has passed,
   a case study if two weeks have passed, a graceful close-out door-open message if
   three weeks or more have passed with no reply. For a first-ever touch on a freshly
   routed lead, draft a straightforward introduction instead of a cadence step.
4. Draft every message in Jean Pascal's voice per house style below. Do not send.
5. Present all drafts together, grouped hot first then warm, with the task name each
   belongs to.
6. On explicit approval of a draft, use Todoist `reschedule-tasks` to push that task to
   its next natural touch point (2, 7, 14, or 21 days out per the cadence stage just
   sent), and update the task description with what was sent and when.
7. Anything at day 21+ with no reply gets flagged for a decision: send the close-out and
   relabel, or explicitly keep alive with a reason.
8. Close with a one-line summary: swept N tasks, M drafts ready, K flagged for a
   decision.

## Rules

- Never send anything automatically. This skill's entire job is to make sure nothing
  goes silent for weeks, not to remove the human decision to send.
- If a task has no reply after 21 days and JP does not decide, default to keeping it
  open with the close-out drafted rather than silently dropping it.
- No em dashes, no asterisks, UK English. Every message ends with the Teams call CTA,
  never a booking link.
