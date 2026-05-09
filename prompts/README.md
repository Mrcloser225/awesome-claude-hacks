# prompts

Prompts are the highest-leverage line of code in any AI system. The prompts in this folder are written for Claude specifically and tuned for the latest model.

## What is in this directory

| Folder | What it does |
|---|---|
| [`system-prompts/`](./system-prompts/) | System prompts for specific roles (architect, debugger, security auditor, performance) |
| [`techniques/`](./techniques/) | Prompt engineering patterns that work across roles |

## How to use a system prompt

Drop the system prompt at the start of a Claude session. In Claude Code, that means putting the prompt at the top of your CLAUDE.md or invoking it via a slash command. In the API, set it as the `system` parameter.

System prompts shape the agent's behavior for the entire session. Pick one that matches the work you are about to do.

## When to write your own

The four prompts here are starting points. Customize them when:
- Your team has specific conventions the prompt should respect
- You are working in a domain that needs specialized vocabulary
- You repeatedly find yourself correcting the same kind of behavior

## When NOT to write your own

If a prompt change is a one-off correction inside a single session, do not bake it into the system prompt. System prompts should reflect rules that hold across sessions.

---

Built by Mr Closer
