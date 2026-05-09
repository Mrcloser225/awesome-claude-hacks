# Cowork cheatsheet

One page. The mental model and the moves you reach for.

## What Cowork is

Claude that lives in your business systems. Not a chat sidekick, a colleague.

- Skills: capabilities Cowork invokes when input matches their description
- Plugins: bundles of skills with connectors and config
- Connectors: MCP-based integrations to your tools

## Skill anatomy

```yaml
---
name: skill-name
description: A specific description that decides when this skill fires.
---

# Skill body
Instructions Cowork follows when this skill is invoked.
```

The description is the most important field. It is what Cowork pattern-matches to decide whether to invoke. Be specific about triggers.

## Top skills to install first

- [`proposal-generator`](../cowork/skills/proposal-generator/SKILL.md): turn a brief into a structured proposal
- [`invoice-processor`](../cowork/skills/invoice-processor/SKILL.md): parse and categorize invoices
- [`meeting-to-actions`](../cowork/skills/meeting-to-actions/SKILL.md): notes to action plan
- [`email-drafter`](../cowork/skills/email-drafter/SKILL.md): bullet points to email

Drop them in `~/.cowork/plugins/<your-plugin>/skills/`.

## Plugin manifest essentials

```yaml
name: my-plugin
version: 0.1.0
author: You
skills:
  - skills/proposal-generator
connectors:
  required:
    - microsoft365
    - clickup
env:
  - name: COMPANY_NAME
    required: true
```

## Connector starter set

```json
{
  "mcpServers": {
    "filesystem":  { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/Documents"] },
    "github":      { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "..." } },
    "memory":      { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"] },
    "fetch":       { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-fetch"] }
  }
}
```

Add SaaS connectors when a specific skill needs them.

## Daily moves

| Need | Say |
|---|---|
| Process the meeting recording | "Run meeting-to-actions on <link>" |
| Send a proposal | "Draft a proposal for Acme on the Q2 redesign at GBP 45k" |
| Reply to a thread | "Draft a reply to Sara: I am free Tuesday or Wednesday for 20 minutes" |
| Categorize last week's invoices | "Process the invoices in my downloads folder" |
| Pipeline check | "Run the daily pipeline drill" |

## Voice rules to add to your skills

If your team has a brand voice, bake it in. Common rules:

- No em dashes
- No "leverage" as a verb
- Specific over generic
- Short sentences
- Lead with the observation
- One idea per paragraph

These belong in the skill body, not in every prompt.

## When to chain skills

Two skills can be chained in a single conversation:

> "Run meeting-to-actions on <link>, then run email-drafter to send each action to its owner."

Cowork will invoke the first skill, take its output, and feed it to the second.

## When to build a custom skill

Build a skill when:
- You have done the same prompt 5+ times manually
- The trigger is specific enough that misfires are rare
- The output is structured

Do NOT build a skill for one-off tasks. Just ask.

## Building a connector

If a tool you use does not have an MCP server, build one. Start with the [`starter-server`](../mcp-servers/starter-server/) template. About 150 lines of TypeScript.

## Things that go wrong

| Symptom | Cause | Fix |
|---|---|---|
| Skill never triggers | Description too vague | Make description more specific |
| Skill triggers when it shouldn't | Description too broad | Add explicit "do not invoke" cases |
| Wrong tool for the job | Two skills overlap | Differentiate by domain in the descriptions |
| Connector keeps disconnecting | Token expired | Refresh, set up auto-refresh if available |

## Top failure mode

The most common failure is over-automating. A skill that fires 80% correctly and 20% wrongly is worse than a skill that fires only when explicitly asked.

When you are unsure, scope the skill tighter. Broaden it later when it has proven reliable.

---

Built by Mr Closer
