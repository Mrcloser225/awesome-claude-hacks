# Pattern: documentation sweep

Documentation drifts. Code changes, docs do not, and slowly the docs become misleading. A periodic documentation sweep catches the drift before it gets dangerous.

## When to use this

- Before a major release
- After a refactor that changed public APIs
- Quarterly, as a maintenance habit
- When onboarding new team members exposes "the docs lie" moments

## When NOT to use this

- For docs about why decisions were made (those need humans)
- For tutorials that depend on user-facing flows (verify by hand)
- For API references where the docs are auto-generated (regenerate, do not patch)

## What the pattern actually does

Codex does three things in a documentation sweep:

1. **Verify** existing docs against the code they claim to describe
2. **Update** docs that are out of sync
3. **Flag** docs that cannot be verified automatically

It does NOT:
- Add new docs to undocumented code (that is a different pattern)
- Rewrite docs in a different style
- Change the structure of the docs

## The pattern

### Step 1: enumerate doc files

```bash
# every markdown file in docs and READMEs
fd -e md . docs/ > docs-to-check.txt
fd "README.md$" . >> docs-to-check.txt
```

Exclude generated docs (typedoc output, openapi spec rendered as markdown, etc.). They are regenerated from source, not edited.

### Step 2: define the verification per doc type

| Doc type | What to verify |
|---|---|
| README quickstart | Every command runs without error in a fresh shell |
| API reference | Every documented function exists with the documented signature |
| Configuration docs | Every option exists in the schema and the default matches |
| Tutorial | Every code block runs to completion |
| Architecture doc | Every named component exists in the codebase |

For each doc type, write a one-paragraph verification recipe.

### Step 3: spawn one task per doc

Prompt template:

```
Verify and update the documentation file below.

FILE: <path>

CODE THE FILE REFERENCES:
<list of files this doc claims to describe>

PROCESS:
1. Read the doc and extract every factual claim about the code:
   - Function signatures
   - Command examples
   - File paths
   - Configuration options
   - Versions
2. For each claim, verify it against the current code
3. If a claim is wrong, propose the corrected version
4. If a claim cannot be verified automatically, mark it FLAGGED

OUTPUT:
A diff for the file plus a summary:
- Claims verified: count
- Claims corrected: count and list
- Claims flagged: count and list

Do not change wording, formatting, or structure. Only fix factual errors.
```

### Step 4: review and merge

Documentation diffs are easy to review. The pattern surfaces clearly:
- Old function name appearing in a sentence: rename to current
- Command using an outdated flag: replace
- Config option that no longer exists: remove the section
- Defaults that changed: update the value

Watch for false positives. Sometimes the doc describes legacy behavior on purpose for migration guides. The "FLAGGED" output is where the human attention goes.

## Special handling: example code blocks

Code blocks in tutorials are the highest-value thing to verify. They are also the most likely to drift.

Add a sub-step to the prompt:

```
For every fenced code block in the doc:
1. Extract the language tag
2. If the block is meant to be runnable (shell, python, javascript, etc.), construct a runnable script from it
3. Execute the script in the sandbox
4. If it fails, capture the error and propose a fix

Skip code blocks tagged "diff", "yaml" (config), or "html" (rendered output).
```

This catches the "copy paste from the README and it does not work" complaint that haunts many open source projects.

## Special handling: links

Every link in the doc should be verified.

```
For every link in the doc:
1. If internal (relative path), verify the target file exists
2. If anchor (#section), verify the section exists in the target
3. If external (http), verify the URL responds with 2xx (not 4xx or 5xx)

Output a list of broken links separately. Do not auto-correct external links.
```

External link rot happens whether you want it to or not. Catch it early.

## Cadence

Run this pattern on a schedule. Suggested cadence:

| Trigger | What to sweep |
|---|---|
| Before each release | Top-level READMEs and quickstart |
| After a major refactor | Docs in the affected modules |
| Monthly | Tutorials, examples, getting-started |
| Quarterly | The full documentation tree |

## Output

After a sweep:
- Documentation that matches reality
- A flagged list of items needing human review
- A clear count of how much drift was caught
- A repeatable rhythm so future drift is bounded

---

Built by Mr Closer
