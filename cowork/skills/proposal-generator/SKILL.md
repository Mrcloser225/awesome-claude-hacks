---
name: proposal-generator
description: Generate a polished business proposal from a short brief. Use when the user asks to draft a proposal, write a proposal, build a SOW, create a statement of work, or pitch a service to a client. Triggers on phrases like "draft a proposal for", "write a SOW", "pitch to client X", "send a proposal to". Produces a structured proposal with executive summary, scope, approach, timeline, pricing, and acceptance criteria.
---

# Proposal Generator

You generate business proposals that get signed. The output is a structured, persuasive document tailored to the client and the work, not a generic template.

## When to invoke

Invoke this skill when the user gives any of:
- A client name and a description of work
- A discovery call summary asking for a proposal
- A request like "send Acme a SOW for the Q2 redesign"
- An RFP response request

If the user only gives a vague idea, ask the elicitation questions first.

## Elicitation (only if missing)

Before writing the proposal, you need to know:

1. **Client name and contact** -- who is signing
2. **The problem** -- what is broken or unclaimed in their business
3. **The proposed solution** -- what you will deliver
4. **Scope boundaries** -- what is in, what is out
5. **Timeline** -- start date and end date or milestones
6. **Pricing** -- fixed, hourly, retainer, or value-based
7. **Sender details** -- who from your side is signing

If any are missing, ask in a single batched question, not one at a time.

## Output structure

Always produce these sections in this order. Skip a section only if explicitly told to.

### 1. Cover page
- Client name
- Project title
- Proposal date
- Sender name and contact
- Proposal valid until (default 30 days from today)

### 2. Executive summary
Three paragraphs maximum:
- Paragraph 1: state the client's situation in one sentence, then the outcome they want
- Paragraph 2: state the proposed approach in plain English
- Paragraph 3: state why the sender is the right partner (one or two specific reasons, not generic puffery)

### 3. Scope of work
A bulleted list of deliverables. Each bullet starts with a noun (what gets delivered), not a verb (what gets done). Examples:
- "A redesigned checkout flow with up to 5 screens" (good)
- "We will redesign the checkout" (bad)

### 4. Approach
3 to 5 numbered phases. Each phase has:
- Phase name
- One-line description
- 2 to 4 specific activities
- Outputs (what the client receives at the end of the phase)

### 5. Timeline
A simple table. Columns: Phase, Start, End, Duration. Use weeks not days unless the project is under 2 weeks.

### 6. Investment
Use the term "Investment", not "Pricing" or "Cost". One of:

**Fixed price:**
- Total: GBP X,XXX (or USD, EUR as appropriate)
- Payment schedule: 50% on signing, 50% on delivery (or staged by milestone)

**Time and materials:**
- Day rate: GBP X,XXX per consultant per day
- Estimated effort: X to Y days
- Range: GBP A,AAA to GBP B,BBB

**Retainer:**
- Monthly retainer: GBP X,XXX
- Term: X months minimum
- Hours included: Y hours

### 7. Out of scope
A short bulleted list of common assumptions the client might make that this proposal does NOT cover. This protects both sides.

### 8. Acceptance criteria
For each major deliverable, one acceptance criterion. The criterion must be testable. Examples:
- "Checkout completion rate measured 7 days post-launch is at or above the pre-redesign baseline"
- "All 12 screens render correctly on Chrome, Safari, Edge, and mobile Safari"

### 9. Terms and assumptions
3 to 5 short bullets covering:
- IP ownership
- Confidentiality
- Change request handling
- Communication cadence
- What happens on early termination

### 10. Acceptance
A short signature block:
```
Accepted and authorised:

___________________________
[Client name]
[Date]

___________________________
[Sender name]
[Date]
```

## Voice rules

- Plain English. Never marketing-speak. Never "synergy", "leverage" as a verb, "stakeholder alignment".
- Specific over generic. "Reduce checkout abandonment from X to Y" beats "improve conversion".
- Use "you" for the client, "we" for the sender. Never "the company".
- Numbers are always specific. Avoid "approximately several thousand pounds".
- One paragraph never exceeds 4 sentences in any section.

## Format

Output the proposal as Markdown by default. If the user asks for docx, produce structured Markdown that maps cleanly to docx headings.

## After delivery

After producing the proposal, ask the user:
1. "Should I tighten the scope, the timeline, or the investment?"
2. "Want me to also draft the cover email?"

Do NOT ask both at once. Pick the one most likely to need adjustment based on the proposal you just wrote.
