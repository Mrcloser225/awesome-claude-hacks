# Connecting any tool to Cowork via MCP

The Model Context Protocol is the standard way to expose a tool to Claude. Once a tool speaks MCP, Cowork can use it. This guide covers the practical side: picking, installing, and configuring connectors.

## What MCP actually is

MCP defines two things:
1. A wire protocol for messages between the AI client and a tool server
2. A schema for declaring what tools, resources, and prompts a server offers

Anthropic, third parties, and you can all build MCP servers. Cowork can talk to all of them through the same interface.

## Three flavors of MCP server

| Flavor | Where it runs | Best for |
|---|---|---|
| Local stdio | Your machine, launched by Cowork | Tools that need filesystem access or local commands |
| Local HTTP | Your machine, listening on a port | Tools you also want to share between Cowork and other apps |
| Remote HTTP | A hosted URL | SaaS connectors, multi-user tools |

## Picking a connector

Before building, search:
1. The Cowork connector marketplace
2. The Anthropic MCP server registry
3. The community awesome-mcp lists on GitHub

If a connector exists, use it. Building your own is a last resort.

## Installing a connector in Cowork

Cowork stores its MCP config in a file (location depends on your install). The config is a single JSON object with one entry per server.

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_yourTokenHere"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/you/Documents"
      ]
    },
    "stripe": {
      "command": "npx",
      "args": ["-y", "@stripe/mcp"],
      "env": {
        "STRIPE_API_KEY": "sk_test_..."
      }
    }
  }
}
```

After saving, restart Cowork. The new servers appear in the connector list.

## The minimum viable connector

If you do need to build your own, the smallest possible MCP server is around 30 lines of TypeScript. The [`starter-server/`](../../mcp-servers/starter-server/) in this repo is a working example. Read its source before you write anything.

## Authentication patterns

Three common patterns for getting credentials into a connector:

### 1. Environment variables (simplest)

The server reads `process.env.MY_TOKEN`. Cowork passes env vars through the `env` block of the manifest.

Use for: personal tokens, API keys, short-lived credentials.

### 2. OAuth flow (most flexible)

The server implements an OAuth flow that the user completes on first connection. Tokens are stored locally and refreshed automatically.

Use for: SaaS connectors that need per-user access.

Most modern MCP servers (Microsoft 365, Google Workspace, Notion, Slack) use OAuth.

### 3. Configuration file (for complex setups)

The server reads from a config file pointed at by an env var. The user creates the config once.

Use for: connectors that need many parameters (database URLs, regional settings, multi-tenant routing).

## Debugging an MCP connector

If a connector misbehaves, check in this order:

1. **Is it loaded?** Cowork shows connected servers in the connector list. If it is missing, the manifest is wrong or the server crashed at startup.
2. **Is it authenticated?** Try a tool call and read the error. Most failures here are stale tokens.
3. **Are tools registered?** Ask Cowork "what tools does <server-name> offer?". If the list is empty, the server is up but did not register its tools.
4. **Is the schema right?** A common failure is a tool whose input schema is too strict. Loosen the schema and retry.

For deep debugging, run the server manually with stdio and send raw MCP messages with a JSON-RPC client. Painful but always works.

## Security checklist

Before installing a third-party connector, ask:

- Who maintains it? Is it abandoned?
- What permissions does it require?
- Does it have a privacy policy?
- Does the source code match the published package?
- Does it phone home to anywhere unexpected?

If any answer is unclear, do not install. Build your own from the starter-server template.

## Multi-tenant deployments

If you are running Cowork for a team, you have two patterns:

### Pattern A: each user has their own MCP config

Each team member configures their own connectors with their own credentials. Simple, but updates require coordination.

### Pattern B: shared MCP servers behind auth

You host a small set of MCP servers on your infrastructure. Each server proxies to the underlying SaaS using per-user OAuth tokens. Users connect once via their Cowork install.

Pattern B is more work to set up but vastly easier to operate at scale.

## Recommended starter set for a small business

If you are setting up Cowork for the first time, install these connectors before anything else:

```json
{
  "mcpServers": {
    "filesystem":  { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/you/Documents"] },
    "github":      { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "..." } },
    "memory":      { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"] },
    "fetch":       { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-fetch"] }
  }
}
```

Add SaaS connectors (CRM, billing, calendar) only when a specific skill needs them. Connectors are not free. Each one is something to maintain and a surface to compromise.

---

Built by Mr Closer
