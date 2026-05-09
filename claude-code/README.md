# claude-code

This section is the load-bearing wall of the repo. Everything else builds on the patterns here.

## What is in this directory

| Folder | What it does |
|---|---|
| [`hooks/`](./hooks/) | Git and harness hooks that fire automatically |
| [`workflows/`](./workflows/) | Multi-step playbooks for common engineering tasks |
| [`claude-md-templates/`](./claude-md-templates/) | Drop-in CLAUDE.md files for popular stacks |
| [`scripts/`](./scripts/) | Helper scripts for context management and orchestration |

## How these pieces fit together

```
        ┌──────────────────────┐
        │   project-scanner    │  ← reads your project
        └──────────┬───────────┘
                   │ writes
                   ▼
        ┌──────────────────────┐
        │      CLAUDE.md       │  ← gives Claude Code its bearings
        └──────────┬───────────┘
                   │ informs
                   ▼
        ┌──────────────────────┐
        │      workflows       │  ← run the right playbook
        └──────────┬───────────┘
                   │ trigger
                   ▼
        ┌──────────────────────┐
        │        hooks         │  ← guard the boundaries
        └──────────────────────┘
```

## Where to start

If you are new to Claude Code, run [`scripts/project-scanner.sh`](./scripts/project-scanner.sh) on your repo. It will produce a CLAUDE.md you can drop in immediately.

If you already have Claude Code humming, install [`hooks/pre-commit-guard.sh`](./hooks/pre-commit-guard.sh). It is the single highest-leverage hook in this repo.

If you are about to start a new project, copy the right [template](./claude-md-templates/) into your repo before your first Claude session.

---

Built by Mr Closer
