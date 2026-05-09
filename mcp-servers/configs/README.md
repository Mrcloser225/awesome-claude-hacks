# MCP configs

Drop-in config files. The flagship is [`ultimate-mcp-config.json`](./ultimate-mcp-config.json).

## ultimate-mcp-config.json

Twenty-plus MCP servers covering filesystem, memory, web fetch, sequential thinking, source control (GitHub, GitLab, git), databases (Postgres, SQLite), browser automation (Puppeteer, Playwright), team chat (Slack), Google Workspace (Drive, Maps), payments (Stripe), project management (Linear, Notion), search (Brave, Exa), plus the two MCP servers built in this repo (starter, business-tools).

### How to use

1. Copy the file to your client's MCP config location (varies by client and OS)
2. Replace every `replace_me` token with your real credentials
3. Replace `${USER}` with your username if your client does not expand it
4. Trim every server you do not actually need
5. Restart your client

### Do not enable everything

Each enabled server is:
- A surface to attack
- A source of token expiry
- A package to keep up to date
- A tool registry that increases the agent's "what should I try" overhead

Start with the smallest set that powers your immediate work:

```
filesystem
memory
fetch
github
business-tools
```

Add the rest only when a specific skill needs them.

### Auth patterns

Most servers in this config use environment variables for credentials. A few use OAuth flows (Google Drive, Slack with the official server). When in doubt:

1. Run the server manually first to see what it asks for
2. Read the server's README for its auth model
3. Set env vars in your shell before launching your client (some clients pass them through, some do not)

### Updating

The packages in this config follow npm release cadence. Run `npx -y <package>` always pulls the latest. If you want pinned versions, replace `npx -y <package>` with `npx -y <package>@<version>`. Pinning is recommended for production setups.

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Server fails to load | Token wrong or missing | Read your client's MCP startup logs |
| Tool list is empty | Server connected but failed to register | Run the server manually with stdio |
| `${USER}` not expanded | Some clients do not interpolate | Hardcode the username |
| Two servers fighting | Same name | Rename one |
| Slow startup | npx pulling packages | Switch to local install or pin |

---

Built by Mr Closer
