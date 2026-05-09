# Codex cheatsheet

One page. The patterns that earn the cost of running unattended tasks.

## What Codex is for

Asynchronous, parallelizable engineering work. You hand it a job, walk away, and check in when it is done.

If you need to be in the loop on every step, use Claude Code instead.

## When to reach for Codex

- A change that touches many files in the same way
- Test generation across a module or project
- Documentation updates after a refactor
- Bulk dependency upgrades

See the [task patterns](../codex/task-patterns/) for proven shapes.

## When NOT to reach for Codex

- Open-ended exploration
- One-off design decisions
- Anything that needs creative judgment per file
- Anything that requires real human review at every step

## Sandbox setup

Drop a sandbox config at the path your install expects (commonly `.codex/sandbox.toml`). Use the configs from this repo:

- [`nodejs-sandbox.toml`](../codex/sandbox-configs/nodejs-sandbox.toml)
- [`python-sandbox.toml`](../codex/sandbox-configs/python-sandbox.toml)
- [`fullstack-sandbox.toml`](../codex/sandbox-configs/fullstack-sandbox.toml)

Edit versions and env vars before kicking off a task.

## Task prompt shape

Every Codex task should declare:

```
GOAL: <one sentence>

CONSTRAINTS:
- <what to leave alone>
- <quality bars>
- <file or scope boundaries>

PROCESS:
- <ordered steps>
- <stopping condition>

VERIFICATION (run before declaring done):
- <command to run>
- <expected result>

ON FAILURE:
- <fall-back behavior, e.g. "skip the file and report">
```

A task with all five sections succeeds 80% of the time. A task missing any of them fails 80% of the time.

## Parallel work

For tasks that split cleanly across files, use the [parallel-refactor pattern](../codex/task-patterns/parallel-refactor.md):

```bash
# 1. enumerate files
rg -l "from 'old-package'" --type ts > files.txt

# 2. split into batches
split -l 25 files.txt batch-

# 3. one Codex task per batch
```

Each task opens a small PR. Merge in dependency order.

## Batch sizes

- Trivial change: 50 to 100 files per task
- Moderate change: 10 to 30 files per task
- Complex change: 3 to 10 files per task

## Verification scripts

Always include a verification step. The cheapest verification:

```bash
# typecheck
pnpm typecheck

# tests for the changed area
pnpm test --changed

# confirm the symbol no longer exists (refactor sanity check)
if rg -q "removedSymbol" --type ts; then
  echo "still appears, failed"
  exit 1
fi
```

## Token economy

Tasks that are too small waste setup overhead. Tasks that are too large blow the context window. Aim for batches that:
- Take 2 to 10 minutes of wall-clock to complete
- Touch under 100 KB of source
- Run a single bounded verification at the end

## Things that go wrong

| Symptom | Cause | Fix |
|---|---|---|
| Task hits timeout | Batch too big | Halve the batch size |
| Task makes surprising edits | Constraints too loose | Tighten "leave alone" list |
| Task reports done but tests fail | No verification step | Always include one |
| Two batches edit the same file | Bad partitioning | Re-partition by directory, not by file count |
| Same change applied differently | Prompt drift between tasks | Pin the prompt as a file, reference it identically |

## Cost control

- Run small experiments first. Calibrate the prompt on 5 files.
- Pre-compute file lists. Don't make Codex enumerate.
- Set a verification time budget. Bail if it overruns.

## Common patterns to reach for

| Job | Pattern |
|---|---|
| Add a missing prop everywhere | Parallel refactor |
| Generate tests for a module | Test generation |
| Update README and docs | Documentation sweep |
| Bump every dependency | Dependency upgrade |

## Output of a successful Codex run

- A clean PR per batch with a focused diff
- Green CI on each PR
- A summary of skips and reasons
- Total time: hours, not days

---

Built by Mr Closer
