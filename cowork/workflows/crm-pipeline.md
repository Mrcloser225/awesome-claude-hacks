# Workflow: managing a sales pipeline via Cowork

A pipeline only earns its keep if it stays current. Most pipelines rot because keeping them current is tedious. This workflow automates the tedious part so the human only does the judgment part.

## When to use this

- Daily, as a 5-minute discipline
- Weekly, as a 30-minute review
- Monthly, as a 90-minute audit

You run all three. They serve different purposes.

## Pipeline stages

Adopt these stages. Adjust labels to taste, but keep the count to 6 or fewer. Pipelines with 12 stages are noise.

| Stage | Definition | Exit criteria |
|---|---|---|
| Lead | Identified, not contacted | First message sent |
| Contacted | Outreach sent, no reply | Reply received or 21 days pass |
| Qualified | They have a real need and budget | Discovery call booked |
| Proposed | Proposal in their hands | They confirm received and reading |
| Negotiating | Specific objections being worked | Verbal yes or no |
| Won / Lost | Closed | Move to active or archive |

Anything in the pipeline must be in exactly one of these stages. No "hot lead" custom labels. No half-states.

## Daily: the 5 minute drill

Every working day, run this prompt:

```
Pipeline drill.

1. Pull all open opportunities from <CRM>.
2. For each, show: name, stage, last activity date, days in stage, owner.
3. Highlight in red: any opportunity with no activity in the past 5 days.
4. Highlight in amber: any opportunity in stage for longer than the typical cycle time.
5. Output a 5-line briefing:
   - The 1 deal I should call today
   - The 1 deal I should email today
   - The 1 deal that needs research before next contact
   - Any deal that should be moved to Lost honestly
   - The number to focus on this week

Be brutal. If a deal has gone cold, say so.
```

Read the 5-line briefing. Take the three actions. Move on.

## Weekly: the 30 minute review

Once a week, every week, on the same day. Friday afternoon is good. Sunday is fine.

Run this prompt:

```
Weekly pipeline review for week ending <date>.

Section 1: stage distribution
- Count of deals at each stage
- Total weighted value at each stage
- Comparison to last week

Section 2: movement this week
- New deals added
- Deals advanced (and from which stage to which)
- Deals lost (and reason if known)
- Deals stalled (no movement in 7+ days)

Section 3: cycle time
- Average days in each stage
- Deals significantly above average

Section 4: top 5 to close
- 5 deals most likely to close in the next 14 days
- For each: name, value, expected close, single most important next action

Section 5: rot list
- Deals over 60 days old in any pre-Won stage
- For each: my recommendation - chase, kill, or downgrade

Output as Markdown, ready to paste into a weekly note.
```

After reading:
1. Mark deals to kill as Lost
2. Schedule the next action for each top-5 deal
3. Adjust stages where movement happened but the CRM has not caught up

## Monthly: the audit

Once a month. 90 minutes. Cancel meetings if you have to. Schedule it.

```
Monthly pipeline audit for <month>.

Section 1: source quality
- Group deals by lead source
- For each source, compute: total deals, conversion rate to Qualified, conversion rate to Won, average deal size, average cycle time

Section 2: ICP fit
- For each Won deal in the past 90 days, list: industry, size, decision-maker title, problem space
- For each Lost deal in the past 90 days, list the same plus the loss reason
- Identify the 3 strongest signals that a deal is likely to close

Section 3: stuck patterns
- Stages where deals tend to die
- Common objections from Lost deals
- Common reasons for cycle time blowing out

Section 4: recommendations
- Sources to invest more in
- Sources to stop using
- ICP filters to apply earlier
- Stages where the playbook needs improvement

Output as Markdown. End with the 3 highest-impact changes for next month.
```

After the audit:
1. Update your ICP definition if the data demands it
2. Kill or scale lead sources accordingly
3. Update your sales playbook for the stuck stage
4. File the audit. Re-read it before next month's audit.

## Common failure modes

| Failure | Fix |
|---|---|
| Pipeline never gets reviewed | Block the recurring time on calendar, no exceptions |
| Stages drift, deals are mislabeled | Run the daily drill, correct in real time |
| Lost deals do not get marked Lost | Be honest. A bloated pipeline lies to you about your future. |
| The same hot deal is "still hot" 90 days later | If a deal has not advanced in 30 days, it is not hot. Act on it or kill it. |
| The CRM has fewer fields than the team needs | Add fields slowly. Two new fields per quarter, max. |

## Pipeline hygiene rules

A pipeline you can trust follows these rules:

1. **Every deal has an owner.** No "TBD" assignments.
2. **Every deal has a next action.** No "waiting on them" without a follow-up scheduled.
3. **Every deal has a last activity date.** Updated automatically by the CRM if possible.
4. **Every deal has an expected close date.** Updated when reality changes. A close date that has slipped 3 times is a Lost deal in waiting.
5. **Every deal in Negotiating has a specific dollar number.** No "around 20k". Numbers move deals.

## Output

After this workflow, you have:
- A daily 5-line briefing in your morning
- A weekly review filed in your project notes
- A monthly audit feeding the next quarter's strategy
- A pipeline that reflects reality, not aspiration

The pipeline is now an instrument, not a vanity dashboard.

---

Built by Mr Closer
