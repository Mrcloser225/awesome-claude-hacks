---
name: meeting-to-actions
description: Convert raw meeting notes or transcripts into a structured action plan with owners, deadlines, and next steps. Use when the user pastes meeting notes, shares a meeting transcript, attaches a recording transcript, or asks to extract action items, follow-ups, or decisions from a meeting. Triggers on phrases like "process my meeting notes", "extract action items", "what came out of this meeting", "turn this into tasks", "summarize and action this".
---

# Meeting to Actions

You turn raw meeting content into a structured output that drives the next 7 days of work for everyone who was in the room.

## Inputs you accept

- Pasted handwritten or typed notes
- A full transcript (Otter, Fireflies, Granola, Gong, etc.)
- A short prose summary the user wrote after the meeting
- A combination of the above for the same meeting

## Output structure

Always produce these four sections in this order:

### 1. Meeting at a glance

A short header block:

```yaml
title: <meeting title or topic>
date: <YYYY-MM-DD if known>
duration: <minutes if known>
attendees:
  - <name and role if known>
purpose: <one sentence on what the meeting was for>
outcome: <one sentence on what was actually achieved>
```

If the meeting drifted from its original purpose, say so in the outcome line.

### 2. Decisions

A bulleted list of decisions made in the meeting. Each decision in this format:

```
- <Decision in one sentence>. Decided by <person or group>. Reason: <one sentence>.
```

Only include actual decisions. A discussion that didn't land on a choice is NOT a decision. Flag those as "Open question" instead.

### 3. Action items

A table:

| # | Action | Owner | Due | Status |
|---|---|---|---|---|
| 1 | One-sentence action starting with a verb | Name | YYYY-MM-DD | Not started |

Rules for actions:
- Every action has exactly one owner. If two people own it jointly, split it into two actions.
- Every action has a date. If no date was discussed, propose one based on the urgency cues in the meeting and flag it for the user to confirm.
- Actions start with a verb (Send, Draft, Decide, Follow up, Schedule, Investigate, Implement).
- Actions are testable. "Improve the website" is not an action. "Send updated copy for the homepage hero to Sara" is.

### 4. Open questions

A bulleted list of things that came up and were NOT resolved. Each item in this format:

```
- <Question>. Surfaced by <person>. Needs <person or role> to resolve.
```

These are the items that will bite the team if nobody chases them.

## Optional sections

Add these only if the source material warrants them.

### Risks and concerns

If the meeting raised concerns about a project, add a Risks section. Each risk in this format:

```
- Risk: <one sentence>. Likelihood: <low / medium / high>. Impact: <low / medium / high>. Mitigation: <one sentence or "none discussed">.
```

### Quotes worth remembering

If the meeting included a quote that captures the essence of a decision or a problem, capture it under "Notable quotes" with attribution. Use sparingly. Two quotes max.

## Voice rules

- Mirror the language the meeting used. If the team called it "the launch", do not rename it "the product release".
- Strip filler. "Um, so I think we should probably maybe..." becomes the underlying action.
- Stay neutral. Do not add opinions or judgments. The output should read like a court reporter, not a participant.

## Privacy

If the meeting transcript contains:
- Salary numbers
- Personal medical info
- Customer-identifiable data not relevant to the action

Strip them or mask them in the output and add a note: "Sensitive content removed. Original transcript retained separately."

## After delivery

After producing the output, offer the user:
1. "Want me to send each action to its owner via email or Slack?"
2. "Want me to create these as tasks in <tool> if you tell me which one?"
3. "Want a 100-word summary I can paste in a follow-up email?"

Pick the one most likely useful based on the meeting type:
- Internal team meeting: tasks in tool
- Client meeting: follow-up email summary
- 1-on-1: action notification to the other person
