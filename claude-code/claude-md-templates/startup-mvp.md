# CLAUDE.md

This is a startup MVP. The constraints are different from a mature codebase. Read this file before any session.

## Project

A web product in the pre-product-market-fit phase. The goal of every line of code is to learn something or make money. Code that does neither is waste.

## Stack

Whatever ships fastest. Current setup:
- Next.js 15
- TypeScript (strict, but we will tolerate a few `any` in product code if speed demands it)
- Tailwind plus shadcn/ui
- Postgres on Neon (free tier)
- Auth via Clerk (free tier)
- Stripe for payments
- Vercel for hosting and previews
- PostHog for product analytics

## The 80/20 rule for an MVP

We optimize for these things, in order:
1. Time from idea to user-facing change
2. Confidence that we did not break a paying user
3. Code quality

We do NOT optimize for:
- Reusability across hypothetical future products
- "Clean architecture" abstractions
- Premature performance optimization
- Complete test coverage on code we might delete next week

The trade is explicit. When the product hits 100 paying users we revisit.

## Directory layout

Flat. Boring. Easy to find things.

```
app/                    Routes
  api/                  Webhooks and route handlers
components/             All components live here, by feature
lib/                    Helpers and integrations (stripe.ts, posthog.ts, db.ts)
schema/                 Drizzle schema in one file (schema.ts)
emails/                 React Email templates
tests/                  We test only what hurts when broken
```

When a folder gets above 20 files, split it. Not before.

## What we test

We test:
- Anything money-related (Stripe webhooks, billing logic, plan changes)
- Anything auth-related
- Any pure function with non-trivial logic (validators, calculators)

We do NOT test:
- React component rendering (use the app instead)
- Wiring code that calls libraries
- Types that the type system already enforces

This rule is not a doctrine. It is a deal we make with ourselves to ship fast without setting fire to the things that matter.

## Definition of done

Done means the change is in production and at least one user has touched the new path.

A change is done when:
- `pnpm build` passes locally
- The preview deploy works in a real browser
- If money or auth is involved, the relevant tests pass
- The change is shipped to production
- Analytics is in place to know if anyone uses it

## Commands

```bash
pnpm dev                # local dev
pnpm build              # production build
pnpm test               # run the small test suite
pnpm db:push            # push schema changes (we use drizzle-kit push, not migrations, until we have paying users)
pnpm stripe:listen      # forward Stripe webhooks to local
```

## Things to never do without asking

- Add a third-party SaaS that costs money before $1k MRR
- Lock us in to a database we cannot easily migrate from
- Build a custom auth system
- Build a custom payment system
- Spend more than half a day on infrastructure for any reason

## Things to default to

- Use the platform default (Next.js, Vercel, Clerk, Stripe). Do not invent.
- Hardcode constants until they need to be configurable
- Inline things that have one caller
- Ship a worse version today and revise when you have data

## Speed of merge

Goal: time from "code ready" to "in production" is under 30 minutes.

To hit that:
- PR descriptions are 3 lines max
- Self-merge if no risk to billing or auth
- Pair-merge for billing or auth changes
- Hot-fix policy: if it is broken in prod, revert first, fix later

## When to break the MVP rules

Break them deliberately when:
- We have a paying customer who needs reliability on a specific path
- We are about to onboard a customer 10x bigger than current avg
- A bug bit us twice in the same week (the 3rd time pays for the test)

Otherwise, keep moving.

## Voice

Commits: short, action-first. "fix billing race", "add email capture", "tighten plan logic".

PR descriptions: what, why, and what could break. Three bullets.
