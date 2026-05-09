# Rapid Prototype: 0 to deployed app in under 60 minutes

This is the workflow that turns "I have an idea" into "the app is live and you can use it" inside an hour. It assumes Claude Code is open, you have a Vercel account, and your idea fits in a sentence.

## When to use this

- You want to validate an idea before investing real time
- You need a working demo for a meeting in two hours
- You are practicing shipping speed and want a structured rep

## When not to use this

- The app needs auth, payments, or compliance from day one
- You already have a complex existing codebase to fit it into
- The idea has more than one core flow

## The 60 minute clock

| Time | Phase | Output |
|---|---|---|
| 0:00 to 0:05 | Sharpen the idea | One sentence, one screen, one user |
| 0:05 to 0:15 | Scaffold | Repo, framework, deploy preview |
| 0:15 to 0:40 | Build the core flow | The single thing that proves the idea |
| 0:40 to 0:50 | Polish the seam users see | Copy, error states, basic styling |
| 0:50 to 0:60 | Ship and verify | Production deploy, live URL, smoke test |

If you blow through any phase by more than 5 minutes, cut scope. The deadline matters more than feature parity with your imagined version.

## Phase 1: Sharpen the idea (0:00 to 0:05)

Before you touch a keyboard, write three lines:

```
WHO:    a [user type]
DOES:   one specific action
TO GET: one specific outcome
```

If you cannot fill in those three blanks in 60 seconds, the idea is not ready. Keep refining until it fits.

Example:
```
WHO:    a freelancer staring at a blank invoice
DOES:   pastes a list of work and prices
TO GET: a styled PDF invoice they can email
```

## Phase 2: Scaffold (0:05 to 0:15)

Open Claude Code in an empty folder. Drop this prompt verbatim:

```
I am rapid-prototyping. The app is described in PROMPT below.
PROMPT: <paste your three-line idea>

Constraints:
- Next.js App Router, TypeScript, Tailwind
- Single page application, no auth, no database for now
- Deploy target is Vercel
- We have 50 minutes left

First action: scaffold the project, run it locally, and confirm the dev server is up.
Stop after the dev server confirms running and tell me the local URL.
```

While Claude scaffolds, open a second terminal and pre-create the GitHub repo:

```bash
gh repo create my-prototype --public --source . --remote origin
```

When Claude reports the dev server is up, deploy the empty shell to Vercel:

```bash
vercel --yes
```

You now have a live URL with a hello-world page. The infrastructure is no longer a risk.

## Phase 3: Build the core flow (0:15 to 0:40)

This is the only phase where you actually write product code. Every minute matters.

Give Claude the next prompt:

```
We have 25 minutes for the core flow.

The single user journey to implement is:
<describe in detail the one happy path>

Rules:
- One file per concern, do not over-architect
- No tests in this phase, we are validating the idea
- If anything is ambiguous, ask me one question and pick a default while you wait
- Use the simplest libraries that solve the problem
- After every implementation step, summarize what was built and ask "ship now or keep going?"

Start.
```

Stay at the keyboard. Answer Claude's questions with one-word defaults. Resist the urge to scope-creep.

The whole point of the timebox is to find the unknowns. Most rapid prototypes fail because the founder hides from the unknowns by polishing the parts they understand.

## Phase 4: Polish the seam (0:40 to 0:50)

Now spend 10 minutes only on what the user sees:

- The headline copy on the landing screen
- The primary call to action label
- The error state when the core flow fails
- The success state when it works
- The favicon and the page title

Prompt:

```
We are at the polish phase. 10 minutes for the surface only.
Show me the landing screen as it currently is and propose 5 specific copy and styling changes that would make it feel finished.
Wait for my picks before changing anything.
```

You pick the changes. Claude implements them.

## Phase 5: Ship and verify (0:50 to 0:60)

Deploy to production:

```bash
vercel --prod
```

Hit the production URL on your phone. Run through the core flow exactly as a stranger would. Capture every friction point in a list. Do not fix them yet.

Final prompt of the session:

```
The prototype is live at <URL>. Friction list from my smoke test:
1. ...
2. ...
3. ...

Categorize each as: blocker, polish, future. Output the result as a markdown table.
We are out of time and shipping. The next session will pick from this list.
```

## What you have at the end of 60 minutes

- A live URL anyone can visit
- A GitHub repo with the code
- A categorized backlog ranked by what the next session should attack first
- A working CLAUDE.md that reflects the codebase you actually built

## Common failure modes and how to avoid them

| Failure | Why it happens | Fix |
|---|---|---|
| Spending 20 minutes on the scaffold | You picked too many libraries up front | Default Next plus Tailwind. Always. |
| The core flow does not work at minute 40 | You scoped the flow too wide | Split into a flow A and flow B, ship A only |
| You hate the design at minute 55 | You did not write the copy first | Phase 4 is for surface only, never internals |
| The deploy fails | You did not deploy the empty shell early | Deploy in phase 2, not phase 5 |

## The one rule

Ship at minute 60 even if it is rough. The point of this workflow is to learn whether the idea is worth a second hour. You only learn that by shipping.

---

Built by Mr Closer
