# Blueprint: content machine

A repeatable pipeline that turns one hour of your week into 3 to 5 published pieces of content. Built on Cowork, MCP, and the prompt techniques in this repo.

## What this blueprint produces

By month 2 you have:
- A weekly publishing rhythm you do not miss
- 3+ pieces shipped per week (LinkedIn post, newsletter, repurposed clips)
- An audience that grows weekly without you grinding
- A content asset library that compounds over time

## What this blueprint does NOT do

- Make you a great writer. The machine amplifies what you have to say. It cannot fake having a point of view.
- Replace original thinking. The system needs raw material from your head every week.
- Work for everyone. If your work is highly visual, the LinkedIn-and-newsletter-first approach is the wrong shape.

## The five-stage pipeline

```
[capture] -> [refine] -> [draft] -> [publish] -> [repurpose]
```

Each stage is automated where possible, manual where it must be.

## Stage 1: capture

Where ideas come from. The machine needs a constant feed of raw material.

Sources:
- Conversations you had this week (client calls, internal debates, podcast guesting)
- Things you wrote in private (slack messages, journal entries, voice notes)
- Things you read and disagreed with
- Patterns you noticed across multiple projects

Capture rule: write the raw material somewhere your machine can reach. A folder of plain text notes is fine. A Notion database is fine. Whatever it is, it needs to be one location, one format, dated.

```
captures/
  2026-W19-acme-billing-debate.md
  2026-W19-three-clients-same-bug.md
  2026-W19-podcast-guesting-takeaway.md
```

Aim for 5 to 10 captures per week. Most will not become content. The machine will pick.

## Stage 2: refine

Once a week, run the refine pass. This is the only stage that requires your full attention. Block 30 minutes.

Read all this week's captures. For each, decide:

- KILL: not worth keeping
- KEEP: worth keeping but not yet content
- DEVELOP: ready to be turned into content this week
- HOLD: needs more raw material first

Tag each capture in your notes. The DEVELOP set is what the next stage uses.

## Stage 3: draft

For each DEVELOP capture, the machine produces 3 candidate pieces:

1. A LinkedIn post (around 200 words)
2. A short newsletter section (around 400 words)
3. A long-form blog post outline (5 to 8 headings)

The prompt:

```
You will turn the raw idea below into three drafts:
1. A LinkedIn post (180 to 250 words)
2. A newsletter section (350 to 450 words)
3. A long-form blog post outline (5 to 8 H2 headings)

CONSTRAINTS:
- Use my voice. Plain English, direct, specific.
- No marketing language.
- Lead with a concrete observation, not a generalization.
- Every section must contain at least one specific number, name, or event.
- The hook in the first sentence must be specific enough that someone in
  the wrong audience would scroll past.

VOICE:
- No em dashes
- No "leverage" as a verb
- No "synergy"
- Short sentences. One idea per paragraph.

RAW IDEA:
<paste capture>

OUTPUT:
=== LINKEDIN ===
<post>
=== NEWSLETTER ===
<section>
=== BLOG OUTLINE ===
<outline>
```

Run this for each DEVELOP capture. You now have 3 candidates per idea.

## Stage 4: publish

You curate. The machine drafts. Never let the machine publish unsupervised at this stage.

For each idea's candidates:

1. Read the LinkedIn post. If you would not say it, edit until you would. If it does not have a point, kill it.
2. Pick the strongest 1 to 2 ideas for the week.
3. Schedule:
   - LinkedIn post for Tuesday morning
   - Newsletter goes out Thursday
   - Blog post drafted to a content calendar (write 1 long-form per month)

Use a scheduling tool (Buffer, Hypefury, or a simple cron-ed script with the relevant API) to actually post. The point is removing the friction of "remembering to post".

## Stage 5: repurpose

After a piece publishes, get more leverage from it.

The repurpose prompt:

```
The piece below was published. Generate 3 derivative formats:

1. A 3-tweet thread (each tweet under 280 characters, lead with a hook)
2. A 30-second video script (with a B-roll suggestion list)
3. A "carousel" (6 slides for LinkedIn or Instagram, each slide one sentence)

CONSTRAINTS:
- Lead with the strongest single insight from the piece, not a summary
- Each derivative should stand alone (someone seeing only the tweet thread
  should still get value)
- Match the voice of the source piece

PUBLISHED PIECE:
<paste>
```

Schedule the derivatives 2 to 4 weeks after the source piece. By then the algorithm will treat them as independent.

## Voice rules (apply at every stage)

The machine will drift to safe, generic prose if you do not anchor it. Every prompt should include your voice rules. Examples:

- No em dashes (use double hyphens or rewrite)
- No marketing puffery
- Specific numbers and names where possible
- Lead with the observation, never the platitude
- One idea per paragraph
- Short sentences

If you have already written content you are happy with, include 1 to 2 examples in the prompt as anchors. See the [few-shot-mastery](../../prompts/techniques/few-shot-mastery.md) guide.

## The Cowork wiring

If you are using Cowork:

1. Build a small plugin that includes:
   - A capture skill (logs an idea to your notes folder)
   - A refine skill (reads the week's captures and proposes the DEVELOP set)
   - A draft skill (the prompt above, fed by a single capture)
   - A repurpose skill (the prompt for derivatives)

2. Connect it to:
   - Your notes folder (filesystem MCP)
   - Your scheduler (Buffer, Hypefury, X API, etc.)
   - Your newsletter (Beehiiv, Substack, Mailchimp APIs)

3. Run a weekly check:
   - Captures count last week (target 5+)
   - Pieces published last week (target 3+)
   - Engagement on last week's pieces (informational, not steering)

## The 90 day rhythm

Month 1: get the pipeline running at all costs. Quality is acceptable but not the goal. Goal is the rhythm.

Month 2: tune the prompts for voice. Look at what landed and what did not. Update the voice rules.

Month 3: start measuring. Which captures led to the best engagement? Which formats? Which days? Adjust.

Do not start measuring before month 3. Early data from a small audience is noise.

## What growth looks like

A realistic content machine:

| Month | Pieces per week | Audience growth |
|---|---|---|
| 1 | 2 to 3 | Flat or slow growth |
| 3 | 3 to 5 | Linear growth |
| 6 | 4 to 6 | Compounding starts |
| 12 | 4 to 6 | The audience earns inbound for the business |

If by month 6 you are not seeing inbound (replies, calls, sign-ups), the audience-fit is wrong. Either the niche is wrong or the message is wrong. Fix that, do not push more output.

## Common failure modes

| Failure | Why | Fix |
|---|---|---|
| Burned out at month 2 | Tried to publish daily | 3 per week is enough |
| Sounds like a bot | Did not include voice rules | Add 1 to 2 anchors of your real writing |
| No audience growth | Topic is too generic | Niche down hard, even if you fear shrinking |
| Lots of likes, no inbound | Content is entertainment, not commerce | Add a clear CTA in your bio and at end of pieces |
| Skipped a week, never came back | No accountability | Tell someone the schedule, ideally publicly |

## What this blueprint produces

After 90 days you have:
- A library of 30+ published pieces
- A pipeline that runs even when you are travelling
- A prompt set you can iterate on for years
- Inbound for whatever business you have on the side

The audience is not the goal. The audience is a byproduct of building the rhythm.

---

Built by Mr Closer
