# Claude Code cheatsheet

One page. Everything you reach for during a session.

## Essential commands

```bash
claude                # start a session in current directory
claude --print        # run a single prompt and exit (great for scripts)
claude --resume       # resume the last session in this directory
claude --continue     # continue the previous conversation
```

## Slash commands

| Command | What it does |
|---|---|
| `/help` | Show help |
| `/clear` | Clear conversation history |
| `/compact` | Summarize conversation to reduce tokens |
| `/cost` | Show token usage and cost |
| `/init` | Initialize CLAUDE.md from the current codebase |
| `/review` | Review pending PR or branch |
| `/config` | Open settings |

## CLAUDE.md essentials

Drop a `CLAUDE.md` at the root of your project. Claude reads it at the start of every session. Cover:
- Stack
- Layout
- Commands
- House conventions
- Definition of done
- Things to never do without asking

Templates live in [`/claude-code/claude-md-templates/`](../claude-code/claude-md-templates/).

## Hooks

Hooks fire on real events. Install with:

```bash
cp /path/to/awesome-claude-hacks/claude-code/hooks/pre-commit-guard.sh \
   .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

The included hooks:
- `pre-commit-guard.sh` runs lint, typecheck, tests on changed files
- `post-commit-notify.sh` posts to Slack/Discord/Teams on every commit

## MCP config

Location varies by install. Drop the [`ultimate-mcp-config.json`](../mcp-servers/configs/ultimate-mcp-config.json) and trim to what you need.

Minimal starter set:
```
filesystem  memory  fetch  github  business-tools
```

## Context tips

- Add to context: paste a file, drop a path, or use `@filename` if your client supports it
- Trim context: `/clear` if the session has wandered, or `/compact` to summarize
- External memory: facts that hold across sessions go in CLAUDE.md, not the session

## Common patterns

| You want to... | Say this |
|---|---|
| Plan before coding | "Before any code changes, walk me through 2-3 approaches." |
| Avoid scope creep | "Stop after the first failing test passes. Do not refactor." |
| Get a second look | "Critique your own change as if you were a senior reviewer." |
| Write tests | "Add tests that fail before this fix and pass after." |
| Stay focused | "List the changes you will make. Wait for me to approve before applying." |

## Speed tips

- `/clear` between unrelated tasks instead of starting a new session
- Use the [`project-scanner.sh`](../claude-code/scripts/project-scanner.sh) on a fresh repo to bootstrap a CLAUDE.md
- Use the [`context-optimizer.sh`](../claude-code/scripts/context-optimizer.sh) to find and exclude bloat
- Run multiple sessions in parallel with [`multi-session.sh`](../claude-code/scripts/multi-session.sh)

## Things that go wrong

| Symptom | Cause | Fix |
|---|---|---|
| Wrong file edited | Ambiguous reference | Always pass file paths explicitly |
| Forgot a constraint | CLAUDE.md is generic | Add specific rules to CLAUDE.md |
| Loops on the same fix | Lost the test it should pass | Restate the failing test |
| Slow first response | Big project, no .claudeignore | Run context-optimizer.sh |
| Tool not found | MCP server failed to load | Check MCP config and tokens |

## When to switch tools

| Situation | Tool |
|---|---|
| Exploring or debugging | Claude Code |
| Run a long task unattended | Codex |
| Run something with my business tools | Cowork |
| Need real keyboard control | Claude Code with full sandbox |

---

Built by Mr Closer
