# codex

Codex changes the unit of work from "an interactive session" to "an asynchronous task". You delegate something, walk away, and check in when the task is done. The patterns and configs in this section are designed for that asynchronous mode.

## What is in this directory

| Folder | What it does |
|---|---|
| [`task-patterns/`](./task-patterns/) | Reusable structures for Codex tasks |
| [`sandbox-configs/`](./sandbox-configs/) | Sandbox configurations Codex can use as the execution environment |

## When to reach for Codex over Claude Code

| Situation | Tool |
|---|---|
| You are exploring or debugging | Claude Code |
| You know exactly what you want and want it run unattended | Codex |
| You need parallel work on independent tasks | Codex |
| You need to interact with the agent during the work | Claude Code |
| You want CI-style verification before the change is presented | Codex |

The two are complementary, not competing. A common pattern is to use Claude Code to design a change, then Codex to apply it across many files in parallel.

## Sandbox configs

Codex runs tasks in sandboxed environments. The sandbox config tells Codex what tools, languages, and runtimes are available. The configs in this folder cover common stacks:

- [`nodejs-sandbox.toml`](./sandbox-configs/nodejs-sandbox.toml) -- Node 20, pnpm, Playwright
- [`python-sandbox.toml`](./sandbox-configs/python-sandbox.toml) -- Python 3.12, uv, pytest, ruff
- [`fullstack-sandbox.toml`](./sandbox-configs/fullstack-sandbox.toml) -- Node + Python + Postgres + Redis

Drop the relevant file at the root of your project as `.codex/sandbox.toml` (or whatever your install expects) before kicking off a task.

## Task patterns

Each pattern in [`task-patterns/`](./task-patterns/) is a recipe for a class of work:

- [`parallel-refactor.md`](./task-patterns/parallel-refactor.md) -- split a refactor across N concurrent tasks
- [`test-generation.md`](./task-patterns/test-generation.md) -- generate test suites without supervision
- [`documentation-sweep.md`](./task-patterns/documentation-sweep.md) -- bring documentation up to current code
- [`dependency-upgrade.md`](./task-patterns/dependency-upgrade.md) -- safely upgrade an entire dependency tree

Each pattern has the same structure: when to use it, the prompt template, the sandbox config to pair it with, the verification step, and the expected output.

---

Built by Mr Closer
