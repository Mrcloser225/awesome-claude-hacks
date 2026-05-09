# Blueprint: SaaS in a weekend

Ship a real, paid SaaS product in 48 hours. Not a polished v1. A working v0 that can take a credit card, deliver value, and tell you whether anyone wants what you built.

## What "shipped" means

By Sunday evening you have:
- A live URL anyone can visit
- A working product that delivers a specific outcome
- A way to take payment (Stripe Checkout)
- At least one paying customer or a clear list of non-buyers and why
- A waitlist for what you build next

## What this blueprint is NOT

It is not "build a startup in a weekend". A startup takes years. This is "validate a SaaS idea fast enough to keep your day job and learn whether the idea has legs".

## The 48 hour clock

| Block | Hours | Output |
|---|---|---|
| Friday evening | 0 to 4 | The idea, locked in writing |
| Saturday morning | 5 to 9 | Repo scaffolded, deploy live |
| Saturday afternoon | 10 to 14 | Core flow working |
| Saturday evening | 15 to 17 | Polish and Stripe |
| Sunday morning | 18 to 22 | Outreach to first 10 prospects |
| Sunday afternoon | 23 to 27 | Iterate on feedback or ship more |
| Sunday evening | 28 to 32 | Public launch |

This is intense. Plan ahead. Cancel everything else.

## Friday evening: lock the idea

The most important block. Without a locked idea, the next 48 hours are wasted.

Your idea must answer all four:

1. **Who** is the user? Be specific. Not "small businesses" but "Shopify store owners doing 100k+ per year"
2. **What** is the painful problem? In their words, not yours.
3. **Why** would they pay? What is the alternative they are using today and why does it suck?
4. **How** does your thing solve it differently?

Write these four in a single page. If you cannot, the idea is too vague.

### Idea quality test

A good idea passes these:
- The user is reachable in 48 hours (you can actually email them on Sunday)
- The problem is acute, not chronic (they would pay TODAY, not someday)
- The solution can be a thin slice of value, not a platform
- You can charge at least $20 per month from day one

If your idea fails any of these, pick a different idea.

## Saturday morning: scaffold and deploy

Use the [rapid-prototype workflow](../../claude-code/workflows/rapid-prototype.md) but stretch it across 4 hours instead of 60 minutes. The extra time is for things a 60-minute prototype skips.

Stack:
- Next.js App Router
- TypeScript
- Tailwind plus shadcn/ui
- Postgres on Neon (free tier)
- Auth via Clerk (free tier)
- Stripe
- Vercel

Drop the [`claude-md-templates/startup-mvp.md`](../../claude-code/claude-md-templates/startup-mvp.md) into your repo as `CLAUDE.md`.

Tasks:
1. `pnpm dlx create-next-app@latest` and pick the defaults
2. `npx shadcn-ui@latest init` and add `button`, `input`, `card`, `dialog`
3. Set up Clerk: copy from their Next.js quickstart
4. Set up Neon: create a project, paste the connection string into `.env`
5. Add Drizzle: `pnpm add drizzle-orm @neondatabase/serverless drizzle-kit`
6. Set up Stripe: install the SDK, create a test mode key
7. Deploy an empty version to Vercel
8. Add a custom domain you bought in advance (do not buy a domain on Saturday, the DNS propagation will eat 2 hours)

By the end of Saturday morning, you can sign up, log in, and see a placeholder dashboard. Nothing on the dashboard yet. That is fine.

## Saturday afternoon: the core flow

This is the only block where you write product code. Spend it ruthlessly.

The core flow is the single user journey that delivers value. Strip everything else.

For example, if you are building "an AI tool that converts a Loom recording into a written tutorial":
- Upload screen
- Transcript extraction
- AI rewrite into tutorial format
- Export as Markdown

That is it. No dashboards of past tutorials. No team accounts. No integrations. No collaboration. Those come after Sunday.

Use the [test-fortress workflow](../../claude-code/workflows/test-fortress.md) for the parts that touch money or auth. Skip tests everywhere else.

## Saturday evening: polish and Stripe

Two hours for polish:
- Headline copy on the landing page
- One screenshot of the product in use
- A clear three-step "how it works"
- Three FAQ entries
- Footer with your email and a link to the privacy policy (use a generator)

Two hours for Stripe:
- Create a Product and Price in Stripe (one tier, monthly, e.g. $29/month)
- Stripe Checkout in test mode
- Webhook handler for `checkout.session.completed` to mark the user as paid
- Gate the core feature on `user.is_paid === true`

Switch Stripe to live mode at the very end. Do a real $29 charge from your own card to verify the full path.

## Sunday morning: outreach

This is when most "weekend SaaS" attempts fall apart. The maker keeps building. Stop. Talk to humans.

Your goal is 10 people in conversation by lunch.

Sources:
- LinkedIn: 5 people who match your ICP, send a personal note that mentions a specific pain
- Reddit: 3 people in a relevant subreddit who have posted about the problem
- Direct: 2 people you already know who fit the ICP

Use the [`email-drafter`](../../cowork/skills/email-drafter/SKILL.md) skill to draft the outreach.

Do NOT mass-send. Personal beats automated 10 to 1 at this stage.

## Sunday afternoon: iterate

By Sunday afternoon, some of your prospects will have replied. The replies fall into three buckets:

1. **"Yes, I want this. How do I pay?"** Send the link. Help them sign up. This is your first paying customer. Capture everything they say in writing.

2. **"This is interesting but I would pay for X instead of Y."** This is gold. They told you what to ship next. Either ship it now (if it is small) or add it to a waitlist email.

3. **"Not for me because [reason]."** Capture the reason. Five reasons in a row that all say the same thing means your ICP was wrong.

If you have at least one paying customer by Sunday afternoon, the rest of the day is about getting more.

If you have zero paying customers, the rest of the day is about understanding why. Talk to more humans.

## Sunday evening: public launch

If by 6pm Sunday you have at least 1 paying customer:

- Post on Twitter/X with a screenshot, the URL, and the founding price
- Post on LinkedIn with a longer story about what you built and why
- Post on Hacker News (Show HN) only if the product is genuinely interesting to a technical audience
- Email anyone on the waitlist
- Add a banner to your existing personal site if you have one

If by 6pm Sunday you have zero paying customers:

- Do NOT do a public launch
- Take notes on what you learned
- Go to bed. Decide next week whether to keep building, pivot, or kill.

Public launching with no validation is throwing your reputation at a wall to see what sticks. Validate first.

## What you have at Sunday midnight

| Outcome | Meaning |
|---|---|
| 1+ paying customer | Real signal. Spend Monday talking to them. |
| 10+ replies, no buyers | Strong negative signal. Pivot or kill. |
| 0 replies, 0 buyers | The audience was wrong or the message was wrong. Try again next weekend. |
| Hundreds of free signups, no buyers | Your free tier is too generous. Restrict it. |

## Next week

The hardest week of any SaaS is the week after launch. The euphoria fades. The bugs appear. The first refund request hits.

Block 1 hour every day next week for:
- Talking to a current customer
- Fixing one specific thing they complained about
- Sending one outreach to a new prospect

Stop building features that nobody asked for. Every feature should be traceable to a real user request.

## Common failure modes

| Failure | Why it happens | Fix |
|---|---|---|
| Nobody buys | The idea was untested before the weekend | Validate the idea with conversations before coding next time |
| Built too much | "I will polish this part for one more hour" | Set a phone alarm at the end of every block |
| Stripe broken at launch | Did not test live mode | Buy from yourself before public launch |
| Lost the weekend to scaffolding | Picked unfamiliar tools | Stick to the stack you know |
| Burnt out on Monday | Treated the weekend as work | Take Monday off if you can |

## What this blueprint produces

By Sunday midnight you have a binary answer: this idea has signal or it does not. That answer is more valuable than 10 weeks of stealth building.

If the answer is yes, you are off and running with something paying customers want. If the answer is no, you saved 10 weeks.

Either way you win.

---

Built by Mr Closer
