# cowork

Cowork is where Claude becomes a colleague rather than a chat assistant. The skills, plugins, and workflows in this folder turn AI into business infrastructure.

## What is in this directory

| Folder | What it does |
|---|---|
| [`skills/`](./skills/) | Drop-in skills following the Cowork SKILL.md format |
| [`plugins/`](./plugins/) | Guides for building Cowork plugins and connecting MCP tools |
| [`workflows/`](./workflows/) | End-to-end business workflows you can run with Cowork |

## Skill format

Every skill in this section follows the official Cowork format. A skill lives in its own folder and contains a `SKILL.md` with YAML frontmatter:

```yaml
---
name: skill-name
description: One-line description that Cowork uses to decide when to invoke this skill.
---
```

The body is the actual instructions Cowork follows when the skill is invoked.

## When to use a skill vs a workflow

- A **skill** is invoked by Cowork when a user matches its description. Use skills for capabilities that should be reusable across many situations.
- A **workflow** is a multi-step playbook a human runs deliberately. Use workflows for processes that need a human in the driver's seat.

The four skills in this folder are designed to be invoked from any Cowork context. The three workflows are designed to be triggered explicitly.

## Installing a skill

1. Copy the skill folder into your Cowork plugin's `skills/` directory
2. The plugin manifest will discover it automatically on next load
3. Test by asking Cowork the kind of question the skill description matches

## Installing all skills

```bash
COWORK_PLUGIN_DIR="$HOME/.cowork/plugins/awesome-claude-hacks"
mkdir -p "$COWORK_PLUGIN_DIR/skills"
cp -r ./skills/* "$COWORK_PLUGIN_DIR/skills/"
```

Then restart Cowork.

---

Built by Mr Closer
