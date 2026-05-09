# Hooks

Hooks are the automation that runs without you asking. The two hooks here are the floor on what every project should have. Everything else is taste.

## What is in here

| File | Fires | Purpose |
|---|---|---|
| [`pre-commit-guard.sh`](./pre-commit-guard.sh) | Before each commit | Block bad commits before they exist |
| [`post-commit-notify.sh`](./post-commit-notify.sh) | After each commit | Stream commit activity to a webhook |

## How git hooks work

Git looks for executable scripts in `.git/hooks/` with specific names. When the matching event fires, git runs the script. If the script exits non-zero on a guard hook, the operation is aborted.

The two hooks in this folder cover the two events that matter most:
- `pre-commit` runs before the commit is recorded
- `post-commit` runs after the commit is recorded

## Installing a single hook

```bash
# from your project root
cp /path/to/awesome-claude-hacks/claude-code/hooks/pre-commit-guard.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Installing all hooks

```bash
HOOKS_DIR="/path/to/awesome-claude-hacks/claude-code/hooks"
TARGET=".git/hooks"

cp "$HOOKS_DIR/pre-commit-guard.sh"    "$TARGET/pre-commit"
cp "$HOOKS_DIR/post-commit-notify.sh"  "$TARGET/post-commit"
chmod +x "$TARGET/pre-commit" "$TARGET/post-commit"
```

## Sharing hooks across your team

`.git/hooks/` is local to each clone. To share hooks across your team, commit them to a tracked folder (for example `.githooks/`) and point git at it once:

```bash
git config core.hooksPath .githooks
```

Now everyone on the repo uses the same hooks after running that one command.

## Bypassing a hook safely

The pre-commit guard supports environment overrides for emergencies:

```bash
# skip the whole hook (use sparingly)
GUARD_SKIP=1 git commit -m "emergency hotfix"

# skip just tests
GUARD_NO_TEST=1 git commit -m "wip"
```

Avoid `--no-verify`. It is a blunt instrument and disables every hook, not just the noisy one. Use the env override and you keep the rest of the safety net.

## How these hooks compose with Claude Code

Claude Code respects git hooks. When Claude tries to commit on your behalf, the hooks run. That means you can use Claude to write code knowing that the same guard you trust on your own commits will run on its commits too.

If you want stricter behavior in Claude sessions only, you can branch on the parent process:

```bash
if pgrep -f "claude" >/dev/null; then
  # stricter rules for AI-authored commits
  GUARD_NO_TEST=0
fi
```

## Notification webhook setup

Pick the platform you want to notify and grab a webhook URL. Then write `.git/notify.env` (gitignored, since `.git/` is local):

```bash
# .git/notify.env
NOTIFY_WEBHOOK_URL=<your-slack-or-discord-webhook-url-goes-here>
NOTIFY_FORMAT=slack
NOTIFY_BRANCHES=main,develop
```

Test it with a commit:

```bash
git commit --allow-empty -m "test notification"
```

If the webhook does not fire, run the script manually with verbose curl:

```bash
NOTIFY_WEBHOOK_URL=... bash -x .git/hooks/post-commit
```

---

Built by Mr Closer
