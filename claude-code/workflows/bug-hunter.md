# Bug Hunter: a systematic debugging workflow

Most debugging goes wrong in the first 30 seconds. The temptation to guess is overwhelming. This workflow forces a structured approach that consistently beats intuition for non-trivial bugs.

## When to use this

- A bug has resisted your first three guesses
- The bug only happens "sometimes"
- The reproduction steps are unclear
- The bug is in code you did not write

## The five-phase loop

```
  Reproduce  ───►  Isolate  ───►  Diagnose  ───►  Fix  ───►  Verify
       ▲                                                       │
       └───────────────────────────────────────────────────────┘
```

Every phase has a single output. If you cannot produce the output of a phase, you have not finished it. Do not skip ahead.

## Phase 1: Reproduce

You cannot debug what you cannot reproduce. The output of this phase is a single command or sequence of clicks that always produces the bug.

Tell Claude:

```
I have a bug. Description: <one paragraph>

Phase 1 is reproduction. Help me build a reliable repro.

1. Read the code I share and identify what inputs would trigger the buggy code path
2. Propose 3 minimal reproductions, ranked by simplicity
3. Walk me through executing the simplest one
4. If it does not reproduce, ask me one question and propose the next variant

Stop when we have a repro that fires every single time.
```

If you cannot reproduce after 30 minutes, the issue is not yet a bug. It is a phenomenon. Capture what you observed, file it, and move on. Coming back with a fresh head often surfaces the missing variable.

### Repro sharpening tricks

- Run with the same git SHA twice. Different output means non-determinism somewhere.
- Run on a different machine. Same output means it is in code or data, not environment.
- Disable all caches. If the bug disappears, it lived in a cache.
- Capture exact wall-clock time for each repro. Time-of-day bugs exist.

## Phase 2: Isolate

The output of this phase is the smallest possible piece of code that still reproduces the bug.

Tell Claude:

```
Phase 2 is isolation. The repro is: <command>.

Help me bisect to the smallest reproducer:

1. Identify the function or component closest to the bug
2. Propose a unit-level reproduction in a single test file
3. If that does not reproduce, climb one layer up
4. Repeat until we have a repro that runs in under 5 seconds and uses no network or database

Stop when the unit-level repro fires every time.
```

A bug that takes 5 seconds to reproduce can be debugged 100 times in an hour. A bug that takes 60 seconds can be debugged 6 times in the same hour. Isolation is leverage.

## Phase 3: Diagnose

Now you know what triggers it and how. Find out why.

Tell Claude:

```
Phase 3 is diagnosis. The minimal repro is in <file>.

Build the diagnosis ladder:

1. State the OBSERVED behavior in one sentence
2. State the EXPECTED behavior in one sentence
3. List 5 hypotheses for the gap, each in one line
4. Rank by probability and by cost-to-test
5. We will run the cheapest test first

For each hypothesis:
- Describe the test in one sentence
- Predict the outcome if true
- Predict the outcome if false
- Run it
- Update the ranking based on result

Stop when one hypothesis survives all tests and the others are killed.
```

The discipline here is to write the prediction before you run the test. If you only check the outcome after the fact, you will rationalize whatever you see. Predictions force you to know what you actually expect.

## Phase 4: Fix

The fix should be the most boring code change you can write that resolves the bug. Resist the urge to refactor.

Tell Claude:

```
Phase 4 is the fix. Confirmed root cause: <one sentence>.

Propose the smallest possible fix:

1. The fix should change as few lines as possible
2. It should not include unrelated cleanups
3. It should not add new abstractions
4. It must add a test that fails before the fix and passes after

Show me the test first. Then the fix. Then run both with and without the fix to prove the test catches the bug.
```

If the smallest fix feels wrong, that is a clue that the design has a problem the bug surfaced. Note that, ship the small fix, and file a separate refactor task. Do not combine.

## Phase 5: Verify

The output of this phase is confidence that the fix is real and complete.

Tell Claude:

```
Phase 5 is verification.

1. Re-run the original repro from phase 1, confirm bug is gone
2. Re-run the minimal repro from phase 2, confirm bug is gone
3. Run the full test suite, confirm green
4. Search the codebase for similar code patterns that might have the same bug
5. For each match, run the new test against it (adapted) and report if it also fails

Output a summary:
- Bug fixed: yes or no
- Other instances found: count and locations
- Recommended follow-ups: list
```

The fifth step (searching for similar patterns) is the highest-leverage step in the whole workflow. Bugs cluster. If you wrote the code wrong once, you probably wrote it wrong somewhere else too.

## The hypothesis log

For long-running bug hunts, maintain a hypothesis log:

```markdown
# Hypothesis log: <bug name>

## H1: <hypothesis> | killed
Test: <test>
Predicted-if-true: <outcome>
Actual: <outcome>
Killed because: <reason>

## H2: <hypothesis> | confirmed
Test: <test>
Predicted-if-true: <outcome>
Actual: <outcome>
Confirmed because: <reason>
```

Append to this as you go. When you eventually solve the bug, the log becomes the postmortem. When you do not solve it and have to hand it off, the log is the gift to the next person.

## Anti-patterns

| Anti-pattern | Why it hurts | Counter |
|---|---|---|
| Reading code looking for "the bug" | Wastes hours on big modules | Get a repro first, always |
| Adding 50 print statements | Noisy and slow | Add 3 strategic logs at hypothesized boundaries |
| Fixing the symptom not the cause | Bug returns next quarter | Phase 3 diagnosis is non-negotiable |
| "Restart the server and see if it goes away" | Hides the bug | Reproduce on demand or it is not solved |
| Refactoring while debugging | Two changes at once is unsolvable | Bug fix first, refactor in a separate PR |

## When to give up

If you have spent 4 hours on a single bug and you are still in phase 1 or 2, stop. Three things might help more than another hour of debugging:

1. Walk away for 30 minutes
2. Explain the bug to someone who knows nothing about the system
3. Open a fresh Claude session and re-explain the bug from scratch

Each of these forces you to articulate the problem freshly. Solutions tend to fall out of the articulation, not the additional debugging.

---

Built by Mr Closer
