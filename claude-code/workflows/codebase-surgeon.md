# Codebase Surgeon: refactor a legacy codebase safely

Most refactors fail not because the new design is wrong, but because the team lost the safety net halfway through. This workflow keeps the safety net intact at every step.

## When to use this

- You inherited code you did not write and have to change it
- A "small change" keeps breaking three other things
- You need to extract a module from a monolith without freezing the team
- You are migrating frameworks, languages, or a database

## The four-step loop

Every refactor session in this workflow follows the same loop. You will run it many times.

```
   ┌─────────────────────────────┐
   │  1. Map the blast radius    │
   └──────────────┬──────────────┘
                  ▼
   ┌─────────────────────────────┐
   │  2. Pin the behavior        │
   └──────────────┬──────────────┘
                  ▼
   ┌─────────────────────────────┐
   │  3. Move in small commits   │
   └──────────────┬──────────────┘
                  ▼
   ┌─────────────────────────────┐
   │  4. Re-verify and rinse     │
   └─────────────────────────────┘
```

## Step 1: Map the blast radius

Before changing anything, get Claude Code to draw you a map of what depends on the code you are touching.

```
I am about to refactor <module or file>.
Before any code changes, produce a blast radius report:

1. List every file in the repo that imports from this module
2. For each importer, list the symbols it imports
3. Flag any symbols that are exported but unused
4. Identify any tests that exercise the module directly
5. Identify any tests that exercise the module indirectly through importers
6. Output the report as a markdown table

Do not propose changes yet.
```

Read the report. If you are surprised by anything in it, that surprise is the whole reason the refactor felt risky. Pin it in your notes.

## Step 2: Pin the behavior

The biggest risk in a refactor is that you change behavior the tests do not catch. Lock the current behavior in before you touch the implementation.

```
For every public function in <module>, write a characterization test that:
- Calls the function with a representative input
- Asserts on the current output (whatever it is, even if it looks wrong)
- Has a comment explaining what behavior is being pinned

If a function has no representative input, write a test that pins the failure mode (the current exception or error message).

Save these tests in tests/characterization/<module>.test.ts.
Run them and confirm 100 percent pass.
```

If you discover bugs while writing characterization tests, do not fix them yet. Pin the bug. Write a separate ticket. Continue the refactor against current behavior. Bug fixes are a different kind of work.

## Step 3: Move in small commits

The refactor itself happens one mechanical step at a time. Every step ends with a green test run and a commit.

Tell Claude:

```
We will refactor <module> in commits of one mechanical step each.
For each step:
1. Describe the step in one sentence
2. Make the change
3. Run the characterization tests, confirm green
4. Run the rest of the test suite, confirm green
5. Commit with message: "refactor(<module>): <one sentence step>"
6. Stop and ask "next step?"

The first step is: <example: extract pure functions from class methods>.
```

Resist the urge to combine steps. The commit history is your safety net. If something goes wrong three steps from now, the only way to know which step caused it is if each step is its own commit.

### Mechanical step menu

Pick steps from this menu in order. Earlier steps are safer.

1. Rename for clarity (no behavior change)
2. Extract a pure function from a method
3. Replace a literal with a named constant
4. Inline a one-line helper that has only one caller
5. Move related functions into the same file
6. Move a file to a more accurate folder, update imports
7. Replace a class with a function or vice versa
8. Change a function signature, update all call sites in the same commit
9. Replace one library with another
10. Replace a data shape, update all readers and writers in the same commit

Steps 1 to 5 are reversible in seconds. Steps 6 to 10 require more thought. Never combine a step from the second half with another step.

## Step 4: Re-verify and rinse

After a batch of 5 to 10 steps, run the full pipeline:

```
Re-verify the module after the latest batch:

1. Re-run the blast radius report from step 1
2. Compare it to the original report and note diffs
3. Run all tests
4. Build the project
5. Output a status: ready for next batch | need investigation

If status is "need investigation", explain why and propose what to look at first.
```

If the diff in the blast radius report is not what you expected, stop. Investigate before adding more steps on top.

## Working with Claude on a long refactor

A long refactor can span many sessions. The risk is that context is lost between sessions and Claude rediscovers the same problems each time. The fix is to maintain a single living document.

Create `REFACTOR_LOG.md` at the repo root and tell Claude to append to it:

```
Maintain REFACTOR_LOG.md at the repo root.
After every batch, append:
- Date and session number
- Steps completed in this batch
- Any surprises encountered
- The next step you would propose
- Any blockers that need a human decision

Read the log before starting any new batch.
```

This log makes the refactor restartable. You can come back a week later and Claude reads the log to recover state.

## Avoiding the worst trap

The worst trap in a long refactor is the "almost there" trap. You are 80 percent done, the new code is better, and the old code is half-deleted. Then a deadline hits and you ship with both code paths active. Six months later nobody remembers which path is correct.

Avoid the trap with one rule: never delete the old path until the new path has been in production for at least one full release cycle and you have explicitly confirmed nothing else uses it.

Add a step at the end of the loop:

```
Every 5 batches, verify:
- Is the old code path still reachable in production?
- If yes, what would it take to remove it?
- If no, write the deletion commit and stop. Do not push.

Output this as a checklist I have to tick before merging.
```

## Output of a successful refactor

- A green CI build at every commit on the refactor branch
- A `REFACTOR_LOG.md` that explains every decision
- Characterization tests that exist after the refactor and run as part of CI
- Old code deleted, not commented out
- A short PR description that links to the log instead of trying to summarize it

---

Built by Mr Closer
