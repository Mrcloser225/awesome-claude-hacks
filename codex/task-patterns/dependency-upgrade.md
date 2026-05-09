# Pattern: dependency upgrade

Dependencies decay. Every month you do not upgrade is a month closer to a forced upgrade under emergency conditions. This pattern keeps your tree current with controlled risk.

## When to use this

- Quarterly as a maintenance discipline
- When a security advisory hits a transitive dependency
- Before a major release where you want the cleanest possible baseline
- When you are about to start a long project and want a fresh foundation

## When NOT to use this

- The day before a major demo
- During a critical incident
- When you have less than 1 day of slack to handle breakage

## The risk gradient

Not all upgrades are equal. The risk goes up sharply with semver:

| Update type | Risk | Approach |
|---|---|---|
| Patch (1.2.3 to 1.2.4) | Low | Batch and merge |
| Minor (1.2.x to 1.3.0) | Medium | Group by ecosystem, test together |
| Major (1.x to 2.x) | High | One at a time, with reading and a plan |

Treat them differently in the workflow.

## The pattern

### Step 1: take inventory

Run a dependency report and capture the diff between current and latest:

```bash
# Node
npm outdated --json > deps-current.json

# Python
uv pip list --outdated --format json > deps-current.json

# Ruby
bundle outdated --strict
```

You now have a complete list of what is behind. Do not start upgrading yet.

### Step 2: classify

Tell Codex to classify the list:

```
Read the dependency report. Classify each outdated dependency into one of:

- "patch_only": only patch versions behind, low risk
- "minor": minor versions behind, medium risk
- "major": at least one major version behind, high risk
- "deprecated": package is marked deprecated or has a successor
- "removed": package is no longer used in the codebase

For each major upgrade, fetch the changelog or release notes and summarize:
- Breaking changes
- Migration steps
- Estimated effort (small, medium, large)

Output a markdown table sorted by risk and estimated effort.
```

Read the table. Decide your appetite. A typical schedule:
- Patches: do them all this week
- Minor: do the safe ones this sprint
- Major: pick the highest-value one for this quarter

### Step 3: phase 1, patch sweep

For all `patch_only` upgrades, run a single Codex task:

```
Apply all patch upgrades from the dependency report.

Process:
1. Update each dependency to its latest patch version
2. Reinstall the lockfile
3. Run the full test suite
4. If any test fails, identify which dependency caused it and pin that one back
5. Open one PR with the title "chore(deps): patch upgrade sweep <date>"

Acceptance:
- All tests pass on the PR
- Lockfile is updated
- No major or minor versions changed
```

This is usually merged within an hour.

### Step 4: phase 2, minor sweep by ecosystem

Group minor upgrades by ecosystem (testing libs together, build tools together, framework parts together). Run one Codex task per group:

```
Apply minor upgrades for the <ecosystem> packages from the dependency report.

Packages in this group:
<list>

Process:
1. Update all listed packages to the latest minor versions
2. Reinstall the lockfile
3. Run the full test suite
4. If any test fails:
   a. Identify the failing package
   b. Read its release notes
   c. Apply the documented migration if any
   d. Re-run tests
   e. If still failing, pin the offending package back and report

Open one PR with the title "chore(deps): minor upgrade sweep, <ecosystem>"

Acceptance:
- All tests pass
- Lockfile updated
- Migration steps documented in the PR description if any were applied
```

Run these in parallel for different ecosystems. Merge in any order.

### Step 5: phase 3, major upgrades, one at a time

Major upgrades are not a sweep. Each one is its own project.

For each major upgrade:

```
Upgrade <package> from <current major> to <new major>.

Pre-work:
1. Read the migration guide for <new major>
2. List every breaking change that affects this codebase
3. For each, propose a migration step

Execution:
1. Apply the migration steps in order
2. Update the package
3. Run typecheck, lint, full tests, build
4. If anything fails, debug before moving to the next step
5. Update any dependent packages that the migration guide mentions

Open a PR with:
- Title: "chore(deps): upgrade <package> to <new major>"
- Description: full migration steps applied, tests run, breaking changes resolved
```

The PR will be larger and require careful human review. That is the price of major upgrades. Pay it deliberately.

## Verification scripts

For each phase, your CI gate should be the same:

```bash
#!/usr/bin/env bash
set -euo pipefail

# typecheck
pnpm typecheck

# tests
pnpm test

# build
pnpm build

# additionally for major upgrades, smoke test the running app
if [ "${SMOKE_TEST:-0}" = "1" ]; then
  pnpm start &
  SERVER_PID=$!
  sleep 10
  curl -fsSL http://localhost:3000/health
  kill $SERVER_PID
fi
```

A green CI gate for a patch sweep is the minimum to merge. For a major upgrade, run smoke tests too.

## Pinning back

When an upgrade breaks something you cannot fix in the same PR, pin it back:

```json
{
  "dependencies": {
    "broken-package": "1.4.2"
  },
  "pnpm": {
    "overrides": {
      "broken-package": "1.4.2"
    }
  }
}
```

Open an issue titled "Cannot upgrade broken-package past 1.4.2 because <reason>". Revisit at the next sweep.

## Dealing with deprecated packages

For each `deprecated` package:

1. Find the recommended successor
2. Decide if the migration is worth doing now or later
3. If now, treat as a major upgrade with the additional step of replacing the import path
4. If later, document the deprecation in `DEPENDENCIES.md` with a target date

Do not let deprecated packages sit forever. They become security liabilities.

## Cadence

Adopt a quarterly rhythm:

| Quarter | Focus |
|---|---|
| Q1 | Full sweep: patches, minors, one major |
| Q2 | Patches and minors only |
| Q3 | Full sweep: patches, minors, one major |
| Q4 | Patches and minors only |

Spread the heavy work. Do not let dependencies pile up to a single dread-day.

## Output

After this pattern:
- A current dependency tree
- A clear log of which majors were addressed when
- A backlog of pinned-back packages with reasons
- A team that no longer fears the word "upgrade"

---

Built by Mr Closer
