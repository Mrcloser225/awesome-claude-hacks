# Blueprint: AI agency starter

How to start an AI automation agency from zero. By month 3 you have paying clients, a defined offer, and a delivery system that does not require you to be at the keyboard 14 hours a day.

## What this blueprint is for

You want to:
- Use AI tooling (Claude, Cowork, Codex, MCP) as the basis of a service business
- Bill clients enough to fund yourself or a small team
- Reach a position where the business runs without you in the loop on every task

You do NOT want to:
- Build a product (see [saas-in-a-weekend](../saas-in-a-weekend/guide.md) instead)
- Be a one-person freelancer forever
- Compete on price with offshore commodity providers

## The 90 day plan

| Phase | Days | Goal |
|---|---|---|
| Position | 1 to 14 | Pick a niche and an offer |
| Validate | 15 to 30 | Land 3 paying pilots |
| Deliver | 31 to 60 | Run the pilots, refine the system |
| Scale | 61 to 90 | Replace yourself in delivery, raise prices |

## Phase 1: position (days 1 to 14)

Almost every failed agency picked the wrong starting point. They tried to be useful to "anyone with AI needs". The two-week positioning phase fixes that.

### Step 1: pick a niche

A niche has three properties:
- A specific industry or function (not "businesses")
- A specific size (not "all sizes")
- A specific pain that AI can address

Examples of good niches:
- Mid-market B2B SaaS companies (50 to 500 employees) that need internal documentation generated and maintained
- UK-based property managers (100 to 1000 units) that need tenant communication automated
- US accounting firms (5 to 30 staff) that need client onboarding workflows built

Examples of bad niches:
- "AI for businesses"
- "Custom AI solutions"
- "Anyone who wants to automate"

A good niche fits in 25 words and names the buyer.

### Step 2: pick an offer

The offer has three properties:
- A specific outcome (not "we build AI things")
- A specific price (not "let's discuss")
- A specific timeline (not "varies by project")

Example:

> "We turn your sprawling internal docs into an internal Claude that answers your team's questions in your voice. £15,000 fixed price, delivered in 4 weeks."

That is an offer. It is sellable. It is replicable. It is priceable.

The first version of your offer will be wrong. You will refine it after the validation phase. Pick a starting offer that you can actually deliver in your first 2 weeks of working with a client.

### Step 3: build the bare minimum

You need:
- A one-page website that explains the niche and the offer
- A booking link (Cal.com or SavvyCal works fine)
- An email address at your domain
- A LinkedIn profile that says what you do
- A simple invoice template (use the [`generate_invoice`](../../mcp-servers/business-tools-server/) MCP tool or any accounting tool)

You do NOT need:
- A logo, brand guide, color palette
- A polished pitch deck
- An LLC for your country in week 1 (sole trader / sole proprietor is fine for the first few invoices)
- A pricing page with multiple tiers

Spend 2 to 3 days on the bare minimum. Do not let it take longer.

## Phase 2: validate (days 15 to 30)

Goal: 3 paying pilots by day 30. Real money. Even if the price is low for the first pilot, charge.

### Outreach math

To get 3 pilots, you need:
- About 50 conversations
- Out of which about 15 are qualified
- Out of which about 5 are interested
- Out of which 3 close

Adjust if your conversion rate is different. Most beginners under-estimate by 3x. Plan for 50 conversations to land 3 deals.

### Outreach playbook

For each prospect:

1. **Identify**: 5 candidates per day. Use LinkedIn, niche communities, industry directories.
2. **Research**: 5 minutes per candidate. Find one specific thing about them you can reference.
3. **Reach out**: short personal message via LinkedIn or email. Use the [`email-drafter`](../../cowork/skills/email-drafter/SKILL.md) skill.
4. **Track**: in your CRM (HubSpot free tier, Notion, or a simple spreadsheet)
5. **Follow up**: twice, two days apart, then drop

The first message should be specific to the prospect, mention the pain, and ask for a 15-minute call. No pitch decks. No long emails.

### The discovery call

15 minutes max. Three sections:

1. **Their world (5 min)**: ask them about their current process, where it hurts, what they have tried
2. **Your offer (5 min)**: explain what you do, the outcome, the price, the timeline
3. **Next step (5 min)**: if interested, send a proposal within 24 hours; if not, ask for a referral and end the call quickly

Do NOT pitch on the first call. Do NOT discount on the first call. Do NOT scope-creep on the first call.

### The proposal

Use the [`proposal-generator`](../../cowork/skills/proposal-generator/SKILL.md) skill. Send within 24 hours of the call. Limit revisions to 2 rounds.

## Phase 3: deliver (days 31 to 60)

You have 3 pilots. Now deliver them so well that they refer you and renew.

### Project setup

For each pilot, run the [client-onboarding workflow](../../cowork/workflows/client-onboarding.md). Yes, even though they only signed for a small project. Set the standard high from day 1.

### Delivery rhythm

Daily: a 30-minute check-in with yourself on what each project needs today
Weekly: a status email per client (use the [weekly-report workflow](../../cowork/workflows/weekly-report.md) shape)
Bi-weekly: an in-person or video call with each client

### What to build

For each pilot, follow this sequence:

1. **Discover**: 1 to 3 days. Understand their current process deeply.
2. **Design**: 1 to 2 days. Sketch the automation, get approval.
3. **Build**: 5 to 15 days. Deliver in increments, not a big bang.
4. **Train**: 1 to 2 days. Teach them to operate it.
5. **Hand over**: 1 day. Documentation, recordings, a clear "what to do if it breaks" page.

Use Claude Code for the building. Use Cowork or your own MCP tooling for the operating side. Use the patterns in [task-patterns/](../../codex/task-patterns/) for any repeatable bulk work.

### Pricing for pilots

Pilots are not your full-price work. Pilots are how you de-risk the offer and produce case studies. Reasonable pilot pricing:
- 50% of your eventual full price
- Capped at the price of one of your delivery weeks
- Always paid (never free, never deferred)

Free pilots are not pilots. They are unpaid work.

## Phase 4: scale (days 61 to 90)

The first 3 pilots taught you what works. Now make it run without you.

### Step 1: write the playbook

For your offer, write the delivery playbook end-to-end. The playbook covers:
- What to do in each phase
- What artifacts to produce
- What questions to ask the client
- What scripts and skills to run
- What to do when things go wrong

This is your most valuable internal document. It is the basis for hiring later.

### Step 2: replace yourself in one phase

Pick the phase you hate most. Probably "build" or "training". Hire (contractor or part-time) someone to do that phase using your playbook.

Do not hire across all phases at once. One phase at a time. Pay them well enough that they care about the quality.

### Step 3: raise prices

Now that you have 3 case studies, raise your prices. Targets:
- 1.5x your pilot price for new clients of the same shape
- 2x or more for a related but more demanding offer

Existing clients: keep them at the original price for the term they signed. Raise on renewal.

### Step 4: build the leverage layer

Across your client base, you will see patterns. The same problem solved 3 times is a small product. Examples:
- A reusable MCP server you build once and deploy per client
- A skills bundle that ships with every engagement
- A templated dashboard

Each pattern you turn into a product:
- Lowers your delivery cost
- Raises your margin
- Eventually becomes a SaaS layer underneath the agency

This is how an agency becomes a product business over 18 to 36 months. You are not there yet. You are building the seeds.

## Tools and stack for the agency

| Tool | Purpose |
|---|---|
| Claude Code | Internal engineering and client engineering |
| Cowork | Internal ops (proposals, invoices, meeting notes) |
| Codex | Bulk client work (test generation, documentation, refactors) |
| MCP servers | Connectors to client systems |
| HubSpot free | CRM |
| Stripe | Payments |
| Notion or Obsidian | Knowledge base, playbook |
| Slack or Teams | Per-client channel |

## Common failure modes

| Failure | Why it happens | Fix |
|---|---|---|
| Niche is too broad | Wanted to keep options open | Narrow it. You can broaden later. |
| Pricing is too low | Imposter syndrome | Charge what the outcome is worth, not what your time costs |
| Scope creep eats the margin | "Just one more thing" | Use the change request log from day 1 |
| You are still doing every task at month 6 | Did not write the playbook | Stop selling and write the playbook for a week |
| Clients churn after the project | No retainer offer | Always offer a maintenance retainer at handover |

## Year 1 trajectory

A realistic year 1 for an AI agency starting today:

| Month | Revenue | Team size | Lesson |
|---|---|---|---|
| 1 | 0 | 1 (you) | Validate the offer |
| 2 | One pilot | 1 | Deliver it well |
| 3 | Three pilots | 1 | Refine the offer |
| 6 | 5 retainers + 1 project | 1 plus 1 contractor | First hire |
| 12 | 8 retainers + 2 projects | 3 to 5 | First playbook works |

Numbers depend on your niche, your network, and your local market. The shape is roughly the same regardless.

---

Built by Mr Closer
