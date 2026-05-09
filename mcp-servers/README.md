# mcp-servers

Two real MCP servers and one ultimate config. Everything in this folder compiles, runs, and connects to a real Claude Code or Cowork install.

## What is in this directory

| Folder | What it is |
|---|---|
| [`starter-server/`](./starter-server/) | The smallest possible MCP server that does something useful |
| [`business-tools-server/`](./business-tools-server/) | A practical MCP server with proposal, invoice, and CRM tools |
| [`configs/`](./configs/) | Reusable MCP configs, including the ultimate 20-server config |

## Reading order

If MCP is new to you:

1. Read this README
2. Read `starter-server/README.md` and the source
3. Try the starter server in a real Claude Code session
4. Then read `business-tools-server/` to see a more realistic example
5. Cherry-pick from `configs/ultimate-mcp-config.json` for your own setup

## Building either server

Both servers use the same setup:

```bash
cd starter-server  # or business-tools-server
npm install
npm run build
npm test           # if applicable
```

The compiled output is `dist/index.js`. Add it to your MCP config:

```json
{
  "mcpServers": {
    "starter": {
      "command": "node",
      "args": ["/abs/path/to/starter-server/dist/index.js"]
    }
  }
}
```

Restart your Claude Code or Cowork session to pick up the new server.

## What is the ultimate config

`configs/ultimate-mcp-config.json` is a battle-tested configuration covering 20+ commonly used MCP servers. It is meant to be copied into a fresh setup as a starting point, then trimmed to what you actually need.

Do not enable everything. Each connector is a security surface and a maintenance burden. Start with 5, add more only when a specific skill needs them.

## Common MCP gotchas

| Gotcha | Symptom | Fix |
|---|---|---|
| Wrong path in config | Server never appears | Use absolute paths, not relative |
| Missing build step | "command not found" | Run `npm run build` first |
| Token has expired | Tools fail with 401 | Regenerate the token, restart |
| Two servers with the same name | Only one shows up | Rename one in the config |
| Server crashes on startup | No tools available | Run the command manually to see the error |

---

Built by Mr Closer
