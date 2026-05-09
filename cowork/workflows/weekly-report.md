# Workflow: weekly business report

A weekly report is the highest-leverage 30 minutes you can spend on your own business. This workflow uses Cowork to compile it from your existing systems instead of writing it from scratch.

## When to use this

- Friday afternoon as a habit
- Sunday evening if you do your weekly review then
- Whenever you realize you have not looked at the numbers for two weeks

## Inputs

The workflow expects access to (via Cowork connectors):
- Your accounting tool or bank feed
- Your CRM or pipeline tracker
- Your project management tool
- Your time tracker (if any)
- Your calendar

If any are missing, the corresponding section comes from your manual notes.

## The five sections

A complete weekly report has five sections in this order. Skip a section only if it really does not apply this week.

### 1. Money

The most important section. Always first.

Compile:
- Revenue this week (cash received and invoiced separately)
- Expenses this week (totals by category)
- Net for the week
- Outstanding receivables (and how old they are)
- Outstanding payables (and when they are due)
- Cash balance now vs cash balance start of week

Prompt to use:

```
Pull from the connected accounting tool the financial data for week starting <Monday date>:
- Revenue cash received
- Revenue invoiced
- Expenses by top-level category
- Aged receivables
- Upcoming payables in next 14 days

Compute net cash for the week.
Output as a markdown table.
Flag anything that looks anomalous.
```

### 2. Pipeline

Where revenue will come from in the next 60 days.

Compile:
- Opportunities by stage
- Total weighted pipeline value
- Movement this week (new opps, won, lost, slipped)
- Top 3 deals to close this week
- Top 3 deals to chase next week

Prompt to use:

```
Pull pipeline data from <CRM>.
For each open opportunity, list: name, stage, value, weighted value, last activity date.

Summarize:
- Total pipeline value (unweighted)
- Total weighted value
- Movement vs last week (new, won, lost, slipped, advanced)
- The 3 oldest opportunities (potential rot)
- The 3 most likely to close this week

Flag any deal that has not had activity in 14 days.
```

### 3. Delivery

Active client and project work.

Compile:
- Active projects
- Status of each (on track, at risk, off track)
- Hours logged this week per project
- Milestones hit this week
- Milestones at risk for next week

Prompt to use:

```
List all active projects from the project tracker.
For each, give: name, owner, status (on/risk/off), milestone due in next 14 days, hours this week.

Highlight projects that:
- Have no time logged in the past 7 days
- Have a milestone due in 7 days that is not in progress
- Have been "at risk" for more than 2 consecutive weeks
```

### 4. People

Time, attention, energy.

Compile:
- Hours worked this week (rough)
- Number of meetings
- Time in deep work blocks
- Anything that should change next week

Prompt to use:

```
Pull calendar data for week of <date>.
Calculate:
- Total hours in meetings
- Number of unique attendees this week
- Largest uninterrupted block of time
- Days with more than 4 hours of meetings

Highlight any pattern that suggests over-scheduling.
```

### 5. Bets and learning

The forward-looking section. Three lines:

1. **The biggest bet I am making next week.** One specific thing you are doing that you are not sure will work.
2. **The biggest thing I learned this week.** A real lesson, ideally with a number attached.
3. **The change I am committing to.** A behavior or process I am adjusting based on what happened this week.

This section is written by you, not generated. Do not let the AI fake insight here.

## Putting it together

The full weekly report prompt:

```
Generate the weekly report for week ending <Friday>.

Sections:
1. Money - pull from accounting
2. Pipeline - pull from CRM
3. Delivery - pull from project tracker
4. People - pull from calendar
5. Bets and learning - leave blank for me to fill

Output as a single Markdown document.
Use tables where they help.
Keep each section under 200 words.
End with a punch list of the 3 highest-leverage actions for next week.
```

## After generation

Read the report. Then do three things:

1. **Tighten section 5**. The AI cannot do this section. You must.
2. **Send section 1 to your accountant** if you have one. Even if they have access. The summary primes the conversation.
3. **Schedule the actions** from the punch list directly into your calendar. Otherwise they will not happen.

## Building the habit

The first 4 weeks are the hardest. The report feels like overhead. By week 8, you will not be able to imagine running the business without it.

Tricks to make the habit stick:
- Same time, same day, every week. Block it on the calendar.
- 30 minutes maximum. If it takes longer, cut a section.
- Save every report in the same folder. Re-reading them monthly is high-leverage.
- Share section 1 with a peer or accountability partner. External eyes prevent self-deception.

## Output

A single markdown file at `reports/weekly-YYYY-MM-DD.md` per week. After 6 months, you have a chronological record of your business at weekly granularity. That record is the most valuable asset you build outside the products themselves.

---

Built by Mr Closer
