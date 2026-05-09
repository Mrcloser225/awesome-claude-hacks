# Keyboard shortcuts

One page. The shortcuts that earn their keep across Claude Code, Cowork, Codex, and the supporting tools.

## Claude Code (terminal)

| Shortcut | Action |
|---|---|
| `Ctrl + C` | Cancel the current generation |
| `Ctrl + D` | End session |
| `Ctrl + L` | Clear the screen (history kept) |
| `Up arrow` | Recall previous prompt |
| `Esc` then type | Edit a previous prompt without re-typing |
| `Tab` | Autocomplete file paths in `@filename` |

## Common slash commands

| Command | Action |
|---|---|
| `/help` | Help |
| `/clear` | Clear conversation history |
| `/compact` | Summarize history to save tokens |
| `/cost` | Token usage and cost so far |
| `/init` | Generate a CLAUDE.md from current code |
| `/review` | Review a PR or branch |
| `/config` | Settings |
| `/model` | Switch model |
| `/exit` | Quit |

## Claude Code (VS Code extension)

| Shortcut | Action |
|---|---|
| `Cmd + Shift + L` (Mac) | Open Claude side panel |
| `Ctrl + Shift + L` (Win/Linux) | Open Claude side panel |
| `Cmd + Enter` | Submit prompt |
| `Cmd + K` then `C` | Comment selection |
| `Right click > Send to Claude` | Pipe selection into a prompt |

(Adjust to your install. These are the defaults at the time of writing.)

## Cowork

| Shortcut | Action |
|---|---|
| Trigger phrase | The skill description matches input |
| `/skill <name>` | Invoke a specific skill explicitly |
| `Cmd + K` | Open Cowork command palette (in supported clients) |

Cowork runs primarily off natural language, not shortcuts. Make your skill descriptions specific so the right one fires.

## Codex

| Action | How |
|---|---|
| Start a task | Submit a prompt with the task shape |
| Cancel a task | Cancel via the Codex UI / dashboard |
| Re-run a task | "retry" with adjusted prompt |
| View logs | Codex dashboard, scoped to the task |

Codex is async by design. Most "shortcuts" are about prompt structure, not key chords.

## Tmux (for multi-session orchestration)

| Shortcut | Action |
|---|---|
| `Ctrl + b` then `c` | New window |
| `Ctrl + b` then `n` | Next window |
| `Ctrl + b` then `p` | Previous window |
| `Ctrl + b` then `d` | Detach session |
| `tmux attach` | Reattach session |

Used heavily by [`multi-session.sh`](../claude-code/scripts/multi-session.sh).

## Git for AI workflows

| Action | Command |
|---|---|
| Stage everything tracked | `git add -u` |
| Commit without pre-commit hook | `GUARD_SKIP=1 git commit` (uses the hook in this repo) |
| Show what changed | `git diff --stat` |
| Show what is staged | `git diff --cached --stat` |
| Find recent commits by topic | `git log --oneline --grep='topic'` |
| Cherry-pick a commit | `git cherry-pick <sha>` |

## Shell (zsh/bash)

| Shortcut | Action |
|---|---|
| `Ctrl + R` | Reverse search history |
| `Ctrl + A` / `Ctrl + E` | Beginning / end of line |
| `Ctrl + W` | Delete word before cursor |
| `Ctrl + U` | Delete entire line |
| `!!` | Repeat previous command |
| `!$` | Last argument of previous command |

`Ctrl + R` plus `!$` together cover 80% of recall needs.

## VS Code

| Shortcut | Action |
|---|---|
| `Cmd + P` | Quick open file |
| `Cmd + Shift + P` | Command palette |
| `Cmd + B` | Toggle sidebar |
| `Cmd + J` | Toggle terminal |
| `Cmd + ,` | Settings |
| `Cmd + K` then `S` | Keyboard shortcut editor |
| `Cmd + Shift + F` | Search across files |

## What to memorize

If you only learn 10:

1. `/clear` to reset Claude Code mid-session
2. `Ctrl + C` to cancel a runaway generation
3. `/compact` to free tokens without starting over
4. Up arrow to recall and edit prompts
5. `Cmd + P` in VS Code to jump files
6. `Ctrl + R` in shell for history
7. `tmux attach` to reconnect after a disconnect
8. `git diff --cached --stat` before committing
9. `Cmd + Shift + P` in VS Code for everything else
10. `Esc` then type, to edit a previous prompt without retyping

---

Built by Mr Closer
