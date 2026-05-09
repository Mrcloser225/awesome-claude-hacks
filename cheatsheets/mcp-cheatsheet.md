# MCP cheatsheet

One page. Everything you need to be productive with the Model Context Protocol.

## The mental model

MCP is a wire protocol that lets any AI client talk to any tool server. Tools, resources, and prompts are exposed by servers. Clients (Claude Code, Cowork, others) pick them up.

Two halves:
- The server: built once, exposes capabilities
- The client config: tells the client where the servers live

## Server flavors

| Flavor | Where it runs | When to use |
|---|---|---|
| stdio | Locally, launched by the client | Filesystem access, shell tools, custom servers |
| local HTTP | Locally on a port | Sharing one server between multiple clients |
| remote HTTP | Hosted | SaaS connectors, multi-user services |

## Minimum config shape

```json
{
  "mcpServers": {
    "name": {
      "command": "node",
      "args": ["/abs/path/to/server.js"],
      "env": {
        "API_KEY": "value"
      }
    }
  }
}
```

The keys: `command` is the executable, `args` is the argv list (use absolute paths), `env` injects env vars.

## Building a server in 30 lines

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "my-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "hello",
    description: "Say hello",
    inputSchema: { type: "object", properties: { name: { type: "string" } } }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name } = req.params.arguments as { name: string };
  return { content: [{ type: "text", text: `Hello, ${name}!` }] };
});

await server.connect(new StdioServerTransport());
```

See the full [`starter-server`](../mcp-servers/starter-server/) in this repo.

## Top servers worth installing

```
filesystem            local file access
memory                key-value memory across sessions
fetch                 HTTP fetch (the agent's web browser)
github                repos, PRs, issues
postgres              read/write a Postgres database
puppeteer             browser automation
slack                 send and read messages
notion                read and edit pages
```

The full list is in [`ultimate-mcp-config.json`](../mcp-servers/configs/ultimate-mcp-config.json). Trim to your actual needs.

## Auth patterns

| Pattern | When |
|---|---|
| Env var token | Personal API keys |
| OAuth flow | SaaS connectors with per-user access |
| Config file | Many params or multi-tenant routing |

## Debugging

| Step | Command or check |
|---|---|
| Is the server reachable? | `node path/to/server.js` (manually) |
| Are tools registered? | Pipe `{"jsonrpc":"2.0","id":1,"method":"tools/list"}` to it |
| Is auth working? | Call a tool that needs auth, read the error |
| Is the schema right? | Check that the input schema matches what the agent sends |

## Things that go wrong

| Symptom | Cause | Fix |
|---|---|---|
| Server never appears | Wrong path or command | Always use absolute paths |
| Tools missing | Server crashes on startup | Run manually to see the error |
| 401 errors | Token expired | Refresh, then restart |
| Schema rejection | Schema too strict | Loosen optional fields |
| Stdout breaks the wire | Wrote logs to stdout | Only log to stderr |

## Security checklist before installing a third-party server

- Maintainer is reputable
- Source matches the published package
- Permissions are scoped to what you need
- No telemetry that you did not consent to
- Updated within the last 6 months

If any answer is no, build your own from the starter template.

## When to build vs reuse

Reuse when:
- An existing server covers your needs
- The maintainer is responsive

Build when:
- You need a tool no one has built
- You need to embed business logic in the server (the [`business-tools-server`](../mcp-servers/business-tools-server/) is an example)
- You need tighter security than a public server offers

## Stdio rules

If you build a stdio server:

- All logs go to stderr, never stdout
- Stdout is the JSON-RPC transport, anything else corrupts the wire
- Exit non-zero on fatal errors so the client retries cleanly

---

Built by Mr Closer
