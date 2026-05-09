# Contributing to awesome-claude-hacks

Thanks for considering a contribution. The bar here is high on purpose. The whole point of this repo is that every file works on the first read. Help keep it that way.

## Before you open a PR

Read this section in full. Most rejected PRs fail one of these checks.

### 1. The contribution must work end to end

If you add a script, run it on a clean machine. If you add a CLAUDE.md template, drop it into a real project and start a Claude Code session. If you add an MCP server, compile it and connect it.

PRs with TODOs, placeholders, or "left as exercise for the reader" code will be closed.

### 2. The contribution must fill a gap, not duplicate one

Search the existing files first. If there is already a workflow that does roughly what yours does, improve the existing one rather than adding a near-duplicate.

### 3. House style is non-negotiable

- No em dashes anywhere. Use double hyphens or rewrite the sentence.
- No asterisks for emphasis in prose. Use bold sparingly and only when structurally necessary.
- Author tag at the bottom of every long-form file: `Built by Mr Closer`
- Plain English. No marketing language. No padding.

### 4. File naming follows the repo conventions

| Type | Pattern |
|---|---|
| Workflow | `kebab-case.md` |
| Script | `kebab-case.sh` |
| Skill | `kebab-case/SKILL.md` |
| Sandbox config | `kebab-case-sandbox.toml` |
| Cheatsheet | `tool-cheatsheet.md` |

## What gets accepted fast

- Real automations that solve a problem you actually had this month
- Cleanups of existing files: typos, broken links, outdated commands
- Better examples for an existing workflow
- New cheatsheets for tools we have not covered

## What does not get accepted

- "Awesome list" link dumps with no working code
- AI-generated walls of text with no original insight
- Anything that requires a paid API key with no free tier
- Anything that depends on a specific OS without a cross-platform alternative

## How to submit

1. Fork the repo
2. Create a branch: `git checkout -b add-my-thing`
3. Add your file in the right section
4. Test it
5. Open a PR with a clear description

PRs should describe:
- What problem the contribution solves
- How you tested it
- Anything a reviewer should know

## Recognition

Significant contributors get listed in the README. Repeat contributors with three or more accepted PRs get co-maintainer rights.

## Contact

For anything that does not fit a GitHub issue: jeanpascal@glaxtons.co.uk

---

Built by Mr Closer
