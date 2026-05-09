# Building Cowork plugins for business automation

A Cowork plugin is a unit of capability you can ship to your team or your clients. The skills in this repo are individual capabilities. A plugin bundles many skills together with the connectors and config they need.

This guide walks through building a plugin from scratch using the skills in this repo as starting material.

## When to build a plugin

- Your team wants Cowork to behave the same way across machines
- You want to ship a repeatable Cowork setup to a client
- You have more than 3 skills you want to share together
- You need versioning and updates for your skills

## Plugin anatomy

```
my-plugin/
  plugin.yaml            Plugin manifest
  README.md              Description for the marketplace
  skills/                Individual SKILL.md files in folders
  agents/                Agent definitions if any
  commands/              Slash command definitions if any
  prompts/               Reusable prompts referenced by skills
  hooks/                 Optional pre and post hooks
  .env.example           Example env vars the plugin needs
```

## The plugin manifest

`plugin.yaml` declares what the plugin offers.

```yaml
name: my-plugin
version: 0.1.0
author: Mr Closer
description: One-line description Cowork shows in the plugin list.
homepage: https://github.com/Mrcloser225/awesome-claude-hacks
license: MIT

# What the plugin contributes
skills:
  - skills/proposal-generator
  - skills/invoice-processor
  - skills/meeting-to-actions
  - skills/email-drafter

# MCP connectors the plugin expects
connectors:
  required:
    - microsoft365
    - clickup
  optional:
    - stripe
    - hubspot

# Environment variables the plugin uses
env:
  - name: COMPANY_NAME
    required: true
    description: Legal name to use in proposals and invoices
  - name: HOME_CURRENCY
    required: false
    default: GBP
    description: Default currency for invoice categorization

# Slash commands the plugin registers
commands:
  - name: /proposal
    description: Run the proposal-generator skill
  - name: /invoice
    description: Run the invoice-processor skill
```

## Picking the right granularity

A common mistake is to build one giant plugin that does everything. Resist. The right size for a plugin is 3 to 8 skills that share:
- A common audience (all for finance, all for sales, etc.)
- A common set of connectors (all need ClickUp, all need Stripe)
- A common life cycle (you ship updates to all of them together)

If two skills have nothing in common, they belong in two different plugins.

## Connectors

Connectors give skills access to external systems through MCP. The Cowork connector library covers most common SaaS already. If your skill needs a new one, you have three options:

1. **Use the official Anthropic-built connector** if the SaaS has one. List it under `required` in the manifest.
2. **Use a community-built connector** by referencing its npm package or git URL.
3. **Build your own connector** using the MCP server pattern from the [`mcp-servers/`](../../mcp-servers/) section of this repo.

Option 3 is the most powerful. The [`business-tools-server`](../../mcp-servers/business-tools-server/) in this repo is a working example.

## Versioning

Every plugin must have a version. Use semantic versioning:
- Major bump for breaking changes to a skill's behavior or output format
- Minor bump for new skills or new optional features
- Patch bump for fixes, prompt improvements, copy edits

Document changes in `CHANGELOG.md` at the plugin root. Keep the changelog short and human-readable.

## Distribution

Three options, in order of formality:

1. **Public GitHub repo**. Anyone can install with `cowork plugin install <github-url>`.
2. **Private package** for client engagements. Host in a private registry or distribute by tarball.
3. **Marketplace listing** (for plugins that are mature, documented, and meet the marketplace bar).

## Testing your plugin before shipping

A plugin that breaks the user's Cowork session is worse than no plugin. Before publishing:

1. Install the plugin in a fresh Cowork instance with a different account
2. Verify each skill triggers when its description matches the user's input
3. Verify each skill does NOT trigger when the description does not match
4. Run the slash commands and confirm they produce the expected output
5. Test with all required connectors disconnected. The plugin should fail gracefully with a clear error.
6. Test with optional connectors disconnected. The plugin should still work with reduced features.

## Maintenance

A plugin is a product. Once you ship one, expect:
- Bug reports for skills that misfire on edge cases
- Feature requests for adjacent capabilities
- Connector breakage when the underlying SaaS changes their API

Budget time for maintenance proportional to how many people use it. A plugin used by 50 people will need updates roughly monthly.

## Example: extending the proposal generator

Say you want the proposal generator to also push the proposal into your CRM. Two ways to do it:

**Option A: extend the skill** - Modify `proposal-generator/SKILL.md` to call the CRM connector after generating the proposal. Quick, but couples the skill to the connector.

**Option B: chain skills** - Keep the proposal generator unchanged. Add a new `proposal-to-crm` skill that takes a generated proposal and pushes it to the CRM. Cowork can chain them in a single conversation.

Option B is better because each skill stays focused and can be reused.

---

Built by Mr Closer
