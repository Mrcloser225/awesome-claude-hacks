# Blueprint: client-facing dashboards

Build a dashboard each client logs into to see the work you are doing for them. The dashboard justifies the retainer, surfaces value, and reduces the "what is happening" status calls that eat your week.

## Why this matters

Clients pay for outcomes. Without a dashboard they ask "what are we paying for". With a dashboard they see what they are paying for and renew.

The same dashboard, built once, becomes a deliverable across your client base. Your unit economics improve every time you sign a new client.

## What the dashboard shows

The four sections every client dashboard needs. Skip a section only if it really does not apply.

### 1. The work happening this week

A list of active workstreams with status:

- What we are working on
- Status: in progress, blocked, in review, complete
- Owner from your side
- Owner from their side, if applicable
- Expected outcome by end of week

Update this once a day. The client should not see stale data.

### 2. Outcomes delivered

A list of outcomes (not tasks) the client got this week, this month, this quarter. Outcomes are user-facing, not internal.

Bad outcome: "Refactored the authentication module"
Good outcome: "Reduced login failures from 3.2% to 0.4%"

If you cannot describe the outcome in the client's language, it is not a deliverable yet, it is internal work.

### 3. Forward-looking commitments

Two parts:
- The next 2 weeks: what is on the roadmap
- The next 90 days: the broader plan

Forward-looking commitments are dated. Slipping a date is fine. Hiding the date is not.

### 4. The numbers

Whatever the client is buying, measured.

- For a marketing engagement: traffic, conversions, cost per lead
- For a development engagement: shipped features, uptime, error rates
- For an automation engagement: time saved, manual tasks eliminated, error reduction

Numbers should be on a chart with a baseline. A single number with no comparison is meaningless.

## Stack

The simplest stack that works:

- Next.js App Router for the dashboard
- Postgres on Neon for storage
- Drizzle ORM
- Clerk for auth (with multi-tenancy)
- Tailwind plus shadcn/ui for layout
- Recharts for charts
- Vercel for hosting

Use the [`nextjs-project`](../../claude-code/claude-md-templates/nextjs-project.md) CLAUDE.md template as your starting point.

## Multi-tenant from day 1

Your dashboard will serve many clients. Each client must see only their data. Build for multi-tenancy from the first commit.

The minimum:

```
organizations          (one per client)
  id
  name
  slug                  (used in URLs: dashboard.com/o/<slug>)
  created_at

users                  (per-user records)
  id
  clerk_id
  email
  display_name

memberships            (links users to orgs with roles)
  user_id
  org_id
  role                  (viewer, editor, admin)

projects               (work for the client)
  id
  org_id                (every domain row has org_id)
  name
  status
  ...
```

Every domain row has `org_id`. Every query is filtered by `org_id`. Use a Drizzle helper that requires you to pass the current org context.

Skip nothing on multi-tenancy. The first time a client sees another client's data, the engagement is over.

## What to put on the home dashboard

The home page is the most important screen. It is what the client sees when they log in. Optimize for "the answer in 3 seconds".

A useful layout:

```
+-----------------------------------------------+
|  HEADER: client name, period selector, logout  |
+-----------------------------------------------+
|  THIS WEEK                                     |
|  3 active workstreams. 1 needs decision.       |
|  -------------------------------------------   |
|  - Workstream 1                       (status) |
|  - Workstream 2                       (status) |
|  - Workstream 3                       (status) |
+-----------------------------------------------+
|  KEY METRIC                                    |
|  Big number with trend. One chart.            |
+-----------------------------------------------+
|  LATEST OUTCOMES                              |
|  - Outcome A (date)                           |
|  - Outcome B (date)                           |
+-----------------------------------------------+
|  NEXT UP                                      |
|  - What lands next week                       |
+-----------------------------------------------+
```

Resist the urge to put 20 charts on the home page. The home page is for orienting. The detail screens are for diving deeper.

## How to keep it fresh

A stale dashboard is worse than no dashboard. Three approaches, ranked by quality:

### Approach 1: pull data automatically (best)

Wherever the data already exists (your project tracker, your time tracker, the deployed app's logs), wire it in. Refresh on a schedule.

Pros: fresh by design
Cons: more upfront work

### Approach 2: a daily 10-minute update ritual (acceptable)

Once a day, you or someone on your team logs into the dashboard's admin and updates statuses, adds outcomes, refreshes the metric.

Pros: easy to start
Cons: easy to skip, leading to staleness

### Approach 3: weekly status updates only (do not do this)

You write a weekly status update. Status email is the dashboard. You will fall behind. Skip.

The right answer is a hybrid: automatic pull where data already lives, daily ritual for the rest. Build approach 2 first, migrate things to approach 1 over time.

## Pricing the dashboard into your offer

Do not bill the dashboard separately. Bake it into the price of every retainer. The dashboard is the wrapper your work goes into.

A retainer with a dashboard commands a higher price than the same retainer without a dashboard, because:
- The client perceives more value
- You spend less time on status calls
- Renewals are higher

A reasonable rule: budget 5 to 10% of your retainer hours for dashboard upkeep.

## Building it the first time

You only build the dashboard once. After that, you onboard each client into the same shared dashboard with their own org.

Initial build target: 2 weeks of focused work for one engineer.

| Week | Focus |
|---|---|
| 1 | Auth, multi-tenancy, project model, basic layout |
| 2 | Charts, metrics, status board, deploy |

Use Codex for parallel test generation. Use Claude Code for the architecture and design decisions. Use the [test-fortress workflow](../../claude-code/workflows/test-fortress.md) for the auth and tenancy code.

## Onboarding a client

When a new client signs:

1. Create their org via the admin
2. Invite them via email
3. Set up the initial workstreams in the dashboard
4. Add the first outcome (small, easy, immediate)
5. Send them the URL

Do not wait until you have weeks of data. Even an empty dashboard with a week-1 outcome is better than no dashboard.

## What clients say

Clients with dashboards consistently say things like:
- "I do not have to chase you for status, it is just there"
- "My boss asked what we are getting from you, I just sent the link"
- "I noticed [metric] moved last week, can we talk about it"

That last one is gold. The dashboard generates conversations about the work. Conversations about the work generate ideas for more work. More work generates more revenue.

## Common failure modes

| Failure | Why | Fix |
|---|---|---|
| Dashboard goes stale | No update ritual | Block 10 minutes a day, on calendar |
| Client never logs in | Did not show them how | First call after launch is a 10 min walkthrough |
| Too many metrics | Felt like more was better | Cut to one key metric per client |
| Multi-tenancy bug | Built for single tenant first | Build for multi-tenancy from commit one |
| Client sees an outage | No monitoring | Use the dashboard project as a real production project |

## What this blueprint produces

After 6 months you have:
- A dashboard that all clients use
- Lower churn (clients see value)
- Less time on status meetings
- A product asset that grows in value as you sign more clients

The dashboard is also the hidden seed of a future product. If you build it well, the same dashboard with self-serve sign-up becomes a SaaS aimed at consultants like you.

---

Built by Mr Closer
