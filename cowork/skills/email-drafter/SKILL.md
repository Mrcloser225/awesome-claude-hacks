---
name: email-drafter
description: Draft professional emails from bullet points or rough notes. Use when the user asks to write an email, draft an email, send an email, follow up via email, reply to a thread, or compose a cold outreach. Triggers on phrases like "draft an email to", "reply to this", "follow up with", "write a cold email", "send X an email about Y". Produces a complete email with subject, body, and a clear call to action, in the user's voice.
---

# Email Drafter

You turn bullet points or rough notes into emails that get replies.

## When to invoke

Invoke when the user gives:
- Bullet points and a recipient
- A thread to reply to and a brief
- A description of a desired outcome ("follow up with Acme on the proposal we sent last week")
- A request to write a cold email

## Inputs you ask for if missing

In a single batched question, ask only for what you actually need:
1. **Recipient** -- name, role, relationship to user (cold, warm, existing client, etc.)
2. **Goal** -- what do you want them to do after reading this
3. **Context** -- what has happened before this email (skip for first contact)
4. **Tone** -- ask only if the relationship is unclear

If the user has a brand voice file or signature in their workspace, use it.

## Output structure

Produce a complete email in this format:

```
Subject: <subject line>

Hi <name>,

<body paragraph 1>

<body paragraph 2 if needed>

<body paragraph 3 if needed>

<call to action paragraph>

<sign-off>
<sender name>
```

Then on a new line, after the email, output:

```
---
Notes:
- Word count: <number>
- Reading time: <seconds>
- One-line alternative subject: <alternative>
```

## Subject line rules

- Maximum 50 characters
- Specific, not generic. Bad: "Quick question". Good: "Question about the Q2 roadmap"
- Active voice. Bad: "An update is being sent". Good: "Sending the Q2 update"
- No clickbait. No fake "Re:" prefixes if it is not a reply.

## Body rules

- Maximum 150 words for outreach
- Maximum 100 words for follow-ups
- Maximum 250 words for proposals or detailed asks
- One idea per paragraph
- The first sentence states the reason for the email. No "I hope this finds you well" preamble.
- The last sentence is the call to action, phrased as a direct ask, not a hint.

## Calls to action

Pick the one that fits:

| Goal | CTA pattern |
|---|---|
| Get a meeting | "Are you free for 20 minutes on Tuesday or Wednesday this week?" |
| Get a decision | "Can you let me know by Friday if this works for you?" |
| Get a reply | "What is your view on this?" |
| Get a referral | "Is there someone on your team I should be talking to about this?" |
| Get a payment | "Would you be able to release the invoice payment by <date>?" |

Bad CTA: "Let me know if you have any questions". This is a non-ask. Replace it.

## Tone defaults

| Relationship | Tone |
|---|---|
| Cold | Warm but not familiar. Use first names. No emojis. |
| Warm | Friendly. Reference the prior connection in one specific phrase. |
| Existing client | Direct. Skip pleasantries after the first email of a thread. |
| Internal | Casual. Match the team's normal style. |
| Senior external | Formal but not stiff. Use full names and titles in the first email only. |

## Anti-patterns the drafter avoids

- "I just wanted to reach out". Wastes the first line.
- "I'm writing to follow up on...". Wastes the first line.
- "Hope you are well". Generic filler.
- "Apologies for the late reply". Replaces with a direct restart.
- "As you may know". Either say it or do not.
- Long lists in the body. If you have 5 bullet points, the email should be a meeting request.
- Multiple CTAs. One ask per email. Pick the most important and drop the rest.
- "Just". Almost always remove it.

## After drafting

Offer:
1. "Want a shorter version?"
2. "Want a more direct version?"
3. "Want a follow-up scheduled if they don't reply by <date>?"

Pick one based on the email type. For cold outreach, default to the follow-up offer.
