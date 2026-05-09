# Workflow: client onboarding

The first 7 days of a client engagement decide the next 12 months. This workflow makes sure nothing important slips through the cracks.

## When to use this

- A new client just signed
- An old client is starting a new project (treat it like onboarding again)
- You are formalizing onboarding for the first time

## Inputs

Before kicking off the workflow you need:
- Signed proposal or SOW
- Primary client contact name and email
- Internal owner from your side
- Project start date

## Day 0: signing day

The day the contract is signed.

### Tasks

1. **Welcome email within 2 hours of signing**
   Use the `email-drafter` skill with these bullet points:
   - Welcome and thank them
   - Confirm the start date
   - Tell them what happens next (the kickoff call)
   - Provide one direct contact for any urgent question

2. **Internal channel created**
   Spin up a Slack channel or Teams channel named `client-<name>`. Add the internal team and any tools that should post to it (CI, monitoring, etc.).

3. **Invoice for first payment sent**
   Use the `invoice-processor` skill in reverse mode (generation, not parsing) to draft the first invoice. Send it the same day.

4. **Project board created**
   Create the project in your PM tool (ClickUp, Asana, Linear, Jira). Pre-populate it with the milestones from the SOW.

## Day 1: kickoff call

A 60 minute call. Three sections:

### Section 1: confirm scope and timeline (20 min)
Walk through the SOW out loud. Confirm:
- The deliverables match what they expect
- The timeline matches their internal calendar
- The acceptance criteria are clear

If anything has shifted since signing, capture it as a change request. Do not change the SOW silently.

### Section 2: meet the team (10 min)
Introduce every person on your side who will touch the work, including their role. Encourage the client to do the same.

### Section 3: working agreements (30 min)
Cover:
- Communication: which channel for which type of question
- Cadence: standing meeting time, weekly status format
- Escalation: who to call if something is on fire
- Tools: what they need access to, what you need access to
- Approvals: who on their side can sign off on what

After the call, run the `meeting-to-actions` skill on the recording or notes. Send the action list to both sides within 2 hours.

## Day 2 to 4: technical setup

### Tasks

1. **Access provisioning**
   Both directions. They need access to the tools you will share output through (Figma, Notion, GitHub, etc.). You need access to whatever they have promised in the SOW (their codebase, their analytics, their CMS).

   Track this in a checklist. Most onboardings stall here.

2. **Documentation read**
   Their existing documentation (if any). Read it. Note anything contradictory or out of date.

3. **First small win**
   Identify one tiny thing you can deliver this week that demonstrates competence. A polished mock, a fixed bug, an analysis report. Ship it before the first weekly status.

## Day 5: first weekly status

By Friday of week 1, send a written status update. Format:

```markdown
## Week 1 status: <client name>

### What we did
- (3 to 5 bullets, specific not generic)

### What is next
- (the top 3 priorities for next week)

### Decisions needed from you
- (things you need them to decide so we can move)

### Risks
- (anything that might delay or change scope)
```

This format becomes the weekly rhythm for the rest of the engagement.

## Day 7: 1:1 with primary contact

A 30 minute call. Just the primary client contact and the internal owner. No team. Three questions:

1. "What is going better than expected?"
2. "What is feeling slower or harder than you hoped?"
3. "What one thing would make this whole engagement a clear success in 90 days?"

Capture the answers. Adjust the plan if needed.

## Closing the onboarding

The onboarding is complete when:
- Both sides know how to work together
- The first written status has been sent
- The client has approved the first deliverable (even if it is small)
- All access is provisioned in both directions
- The change request log exists and has at least one entry (proves it works)

## Common failure modes

| Failure | Fix |
|---|---|
| Onboarding drags into week 3 | Cut scope of the first deliverable to something shippable in 5 days |
| Client never gives access to a critical tool | Make access part of the contract acceptance, not a side ask |
| Internal team doesn't know who is doing what | Run a 30-minute internal kickoff before the client kickoff |
| Weekly status format drifts and weakens | Templatize it. Reuse exactly. Resist the urge to redesign. |
| First invoice goes unpaid | Send the invoice on day 0, follow up day 7 if unpaid |

## Output artifacts

After this workflow, the following exist:
- A welcome email in the thread history
- A signed SOW filed and linked from the project board
- A project board with milestones
- An internal channel with relevant integrations
- A working agreements doc
- The first weekly status
- A 1:1 transcript or notes
- The first invoice (paid or in-flight)

---

Built by Mr Closer
