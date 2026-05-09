<div align="center">

# awesome-claude-hacks

### The definitive collection of Claude Code, Cowork, and Codex hacks, automations, and blueprints.

> "The best way to predict the future is to automate it."

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/Mrcloser225/awesome-claude-hacks?style=social)](https://github.com/Mrcloser225/awesome-claude-hacks/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/Mrcloser225/awesome-claude-hacks?style=social)](https://github.com/Mrcloser225/awesome-claude-hacks/network/members)
[![GitHub last commit](https://img.shields.io/github/last-commit/Mrcloser225/awesome-claude-hacks)](https://github.com/Mrcloser225/awesome-claude-hacks/commits/main)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

**Built by [Mr Closer](mailto:jeanpascal@glaxtons.co.uk)**

</div>

---

## Why this repo exists

Every other resource covers Claude Code OR Cowork OR Codex. Nobody has put the three together. Real automation lives in the gaps between these tools, not inside any single one. This repo fills that gap.

If you ship software, run a business, or operate at the boundary between code and operations, the patterns here are the shortest path between an idea and a working system.

## What you get

- Battle-tested **hooks** for Claude Code that actually fire
- **Skills** for Cowork that handle real business workflows
- **Sandbox configs** for Codex that pass the first time
- **MCP servers** in TypeScript that compile and run
- **CLAUDE.md templates** that survive the first refactor
- **Workflows** that take you from cold start to deployed system
- **Cheatsheets** for the moments where you need the answer right now

Every file in this repo is complete. No placeholders. No TODOs. No half-finished examples.

## Table of contents

| Section | What is in it |
|---|---|
| [claude-code/](./claude-code/) | Hooks, workflows, CLAUDE.md templates, orchestration scripts |
| [cowork/](./cowork/) | Skills, plugins, business workflows |
| [codex/](./codex/) | Task patterns and sandbox configs |
| [mcp-servers/](./mcp-servers/) | Starter and business-tools MCP servers in TypeScript |
| [prompts/](./prompts/) | System prompts and prompt engineering techniques |
| [blueprints/](./blueprints/) | End-to-end business automation blueprints |
| [cheatsheets/](./cheatsheets/) | One-page references for every tool |

## Quick start (60 seconds to value)

```bash
# 1. Clone the repo
git clone https://github.com/Mrcloser225/awesome-claude-hacks.git
cd awesome-claude-hacks

# 2. Install a CLAUDE.md template into your project
cp claude-code/claude-md-templates/nextjs-project.md ~/your-project/CLAUDE.md

# 3. Install the pre-commit hook
cp claude-code/hooks/pre-commit-guard.sh ~/your-project/.git/hooks/pre-commit
chmod +x ~/your-project/.git/hooks/pre-commit

# 4. Open your project in Claude Code
cd ~/your-project && claude
```

That's it. You now have a project with a working CLAUDE.md, an automated pre-commit guard, and a Claude Code session that knows what your code looks like.

## The philosophy

Three rules govern every file here:

1. **Declarative over imperative.** Tell the agent what done looks like, not how to do it.
2. **Loop until done.** Every workflow has a verification step. No silent failures.
3. **Compound.** Hooks feed workflows. Workflows feed skills. Skills feed blueprints. Each layer increases leverage.

## Section deep dives

### claude-code/

The Claude Code section is the most opinionated part of this repo. The CLAUDE.md templates were extracted from real production projects. The hooks are the same ones running on Mr Closer's machine right now.

Highlights:
- [`pre-commit-guard.sh`](./claude-code/hooks/pre-commit-guard.sh) catches lint, typecheck, and test failures before they hit your branch
- [`rapid-prototype.md`](./claude-code/workflows/rapid-prototype.md) is a workflow that takes you from blank repo to deployed app in under 60 minutes
- [`project-scanner.sh`](./claude-code/scripts/project-scanner.sh) reads your project and writes a custom CLAUDE.md from what it finds

### cowork/

Cowork is where AI stops being a chat assistant and starts being a colleague. The skills here are not toys. They wire up to real business processes.

Highlights:
- [`proposal-generator/`](./cowork/skills/proposal-generator/) turns a one-line brief into a full client proposal
- [`meeting-to-actions/`](./cowork/skills/meeting-to-actions/) takes raw meeting notes and outputs a structured action list with owners and deadlines
- [`crm-pipeline.md`](./cowork/workflows/crm-pipeline.md) runs the entire weekly sales-pipeline review

### codex/

Codex changes how parallel work gets done. The task patterns in this section are designed to run unattended in the cloud.

Highlights:
- [`parallel-refactor.md`](./codex/task-patterns/parallel-refactor.md) splits a refactor across N concurrent Codex tasks
- [`fullstack-sandbox.toml`](./codex/sandbox-configs/fullstack-sandbox.toml) is the only Codex sandbox config you will ever need for a Next.js plus Postgres stack

### mcp-servers/

The MCP ecosystem moves fast. The two servers here are minimal, complete, and current as of release.

Highlights:
- [`starter-server/`](./mcp-servers/starter-server/) is the smallest possible MCP server that still does something useful
- [`business-tools-server/`](./mcp-servers/business-tools-server/) ships with invoice, proposal, and CRM tools wired up
- [`ultimate-mcp-config.json`](./mcp-servers/configs/ultimate-mcp-config.json) connects 20+ servers in one drop-in config

### prompts/

Prompts are still the highest-leverage line of code in any AI system. The prompts here are written for Claude specifically and assume the latest model.

### blueprints/

Blueprints are the longest documents in the repo. Each one walks through building a complete business system from scratch using the patterns from the other sections.

### cheatsheets/

When you need the answer in 5 seconds and not 5 minutes.

## Star history

If this repo helps you ship faster, smash the star. Star count is the heartbeat that tells contributors the work is worth continuing.

```
★ Star this repo to follow updates ★
```

## Contributing

Contributions are welcome and rewarded. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR. Quality bar is high. Half-finished work gets closed.

## Contact

- Author: **Mr Closer**
- Email: jeanpascal@glaxtons.co.uk
- GitHub: [@Mrcloser225](https://github.com/Mrcloser225)

For commercial automation work, agency partnerships, or custom Claude Code engagements, email above.

## License

MIT. See [LICENSE](./LICENSE). Use it. Fork it. Sell what you build with it.

---

<div align="center">

### Built by Mr Closer

**The best way to predict the future is to automate it.**

If this repo saved you a week, [pay it forward](./CONTRIBUTING.md).

</div>
