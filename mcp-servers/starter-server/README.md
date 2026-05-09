# Starter MCP Server

The smallest possible useful Model Context Protocol server. Three tools, around 150 lines of TypeScript, fully typed, ready to extend.

Use this as the starting point for your own MCP server.

## What it does

Exposes three tools:

| Tool | Purpose |
|---|---|
| `echo` | Round-trips text. Useful for verifying the server is connected. |
| `now` | Returns the current date and time, with optional timezone and format. |
| `word_count` | Counts words, characters (with and without spaces), and lines. |

## Build

```bash
npm install
npm run build
```

The output is at `dist/index.js`.

## Run standalone

```bash
node dist/index.js
```

The server speaks stdio. It is not designed to be used directly from a shell. Connect it to Claude Code or Cowork instead.

## Connect to Claude Code

Add this to your MCP config (location depends on your install):

```json
{
  "mcpServers": {
    "starter": {
      "command": "node",
      "args": ["/absolute/path/to/awesome-claude-hacks/mcp-servers/starter-server/dist/index.js"]
    }
  }
}
```

Restart Claude Code. The three tools should appear under the `starter` server.

## Connect to Cowork

Cowork uses the same MCP config shape. The path will be different, but the JSON looks the same. Refer to the [`cowork/plugins/mcp-connector-guide.md`](../../cowork/plugins/mcp-connector-guide.md) for the exact location.

## Verify it works

In a Claude Code session, ask:

> "Use the starter server's echo tool to send back the text 'hello world'"

You should see the tool fire and return `hello world`.

Then ask:

> "What time is it in Tokyo right now?"

The agent should call the `now` tool with `timezone: "Asia/Tokyo"`.

## Extend it

Adding a new tool is three steps:

1. Add an entry to the `TOOLS` array in `src/index.ts`
2. Add a handler function (`handleMyTool`)
3. Add a case for it in the `CallToolRequestSchema` switch

Rebuild with `npm run build` and restart your client. The new tool appears.

## Patterns to copy

When you build your own server, copy these patterns from the starter:

- **`ok` and `err` helpers** for consistent return shapes
- **JSON Schema input validation** declared once per tool, not parsed in handlers
- **Typed argument extraction** with explicit checks before use
- **stderr for logs**, never stdout (stdout is the MCP transport)

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Tool calls fail silently | You wrote to stdout for logging | Use `process.stderr.write` instead |
| Server crashes on connect | Missing dependency | Run `npm install` then `npm run build` |
| Tool not found | Schema cached on the client | Restart the client after adding tools |
| Wrong absolute path | Path resolves differently in your client | Always use absolute paths in config |

## License

MIT. See the repo root [LICENSE](../../LICENSE).

---

Built by Mr Closer
