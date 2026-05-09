# Pattern: parallel refactor

When a refactor follows the same mechanical change across many files, you do not need one expert person doing it sequentially. You need N agents doing it in parallel, then you merge the results.

## When to use this

- A library API changed and you need to update every call site
- You are renaming a concept across the codebase
- You are migrating a pattern (e.g. callback to async/await) across hundreds of files
- You are switching frameworks for one layer (e.g. fetch to axios, lodash to native)

## When NOT to use this

- The refactor requires creative judgment per file (use Claude Code instead)
- The files have hidden interdependencies that get exposed by the refactor
- You cannot describe the change in 5 sentences

## The pattern

```
            ┌──────────────────────────┐
            │ 1. Define the unit task  │
            └─────────────┬────────────┘
                          ▼
            ┌──────────────────────────┐
            │ 2. Partition the files   │
            └─────────────┬────────────┘
                          ▼
            ┌──────────────────────────┐
            │ 3. Spawn N codex tasks   │
            └─────────────┬────────────┘
                          ▼
            ┌──────────────────────────┐
            │ 4. Wait and verify       │
            └─────────────┬────────────┘
                          ▼
            ┌──────────────────────────┐
            │ 5. Merge in dependency   │
            │    order                 │
            └──────────────────────────┘
```

## Step 1: define the unit task

Write the smallest possible prompt that describes the refactor on a SINGLE file. Test it on one file in Claude Code. Iterate the prompt until it produces a clean diff.

Template:

```
Apply this exact refactor to the given file.

WHAT TO CHANGE:
<one paragraph describing the change>

WHAT TO LEAVE ALONE:
<one paragraph listing common pitfalls so the agent does not over-reach>

VERIFICATION (run before declaring done):
- The file still compiles or lints
- All tests in this file still pass
- The diff is bounded to the described change
- No imports were removed if they are still used

If you cannot complete the refactor on this file because of unusual code, do not partially refactor. Output a single line: "SKIP: <reason>" and exit clean.
```

## Step 2: partition the files

Run a script to enumerate the files that need the change. Save them to a file:

```bash
# example: every file that imports from the old API
rg -l "from 'old-package'" --type ts > files.txt
wc -l files.txt
```

Decide on partition size. Codex tasks have overhead per task. The right size depends on the model and the complexity of the change. As a rule of thumb:

- Trivial change (one-line replacement): 50 to 100 files per task
- Moderate change (a few related lines): 10 to 30 files per task
- Complex change (function signature plus all call sites in a file): 3 to 10 files per task

Split the file list into batches:

```bash
split -l 25 files.txt batch-
```

You now have `batch-aa`, `batch-ab`, etc.

## Step 3: spawn N codex tasks

For each batch, kick off a Codex task with the unit-task prompt and the file list. The task body looks like:

```
You will refactor a list of files. Apply the unit task to each file.

Files in this batch:
<paste the contents of batch-aa>

Unit task:
<paste the unit task from step 1>

After all files are processed, output a summary:
- Files refactored cleanly: count
- Files skipped: count and reason
- Files where the refactor partially failed: count and which ones

Open a single PR for this batch with the title:
"refactor(<scope>): batch <batch-name>"
```

Spawn one task per batch in parallel.

## Step 4: wait and verify

Each task produces a PR. Verify each PR before merging:

1. CI is green
2. The diff is bounded to the unit task (no surprise edits)
3. The file count matches the batch size minus skips
4. Spot-check 3 random files to confirm the change is correct

If any PR has surprises, do not merge. Open it in Claude Code, investigate, and either fix or close.

## Step 5: merge in dependency order

The order of merging matters when the refactor touches files that depend on each other.

Rules:
- If file A imports from file B, merge B's PR first
- If two PRs touch the same file (rare but happens at batch boundaries), rebase the second on the first

For most refactors, dependency order does not matter. But it matters enough to check.

## Example: rename a hook from useFoo to useBar

```
WHAT TO CHANGE:
- Rename every import and reference of useFoo to useBar
- Update the import path from 'old/hooks' to 'new/hooks'

WHAT TO LEAVE ALONE:
- Variable names that happen to contain "foo" but are not the hook
- Comments that mention useFoo (these will be cleaned up in a separate sweep)

VERIFICATION:
- pnpm typecheck passes for this file's package
- pnpm test in this file's package passes
- The diff only touches imports and identifiers, not logic
```

This change can run as a parallel refactor against 500 files in 5 batches of 100. Total wall-clock time: about 30 minutes.

## Verification scripts

For larger refactors, build a verification script that runs after every batch:

```bash
#!/usr/bin/env bash
# verify-batch.sh
set -e

# 1. typecheck the whole monorepo
pnpm typecheck

# 2. test only changed packages
pnpm test --changed

# 3. confirm the symbol no longer exists
if rg -q "useFoo" --type ts; then
  echo "ERROR: useFoo still appears somewhere"
  rg "useFoo" --type ts
  exit 1
fi

echo "Batch verified."
```

## Outputs

After this pattern completes:
- A series of small PRs, one per batch, each readable in 10 minutes
- A clean main branch with the refactor fully applied
- A `SKIP` list of files that need human attention
- Total time: hours instead of days

---

Built by Mr Closer
