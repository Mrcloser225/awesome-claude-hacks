# Business Tools MCP Server

A practical MCP server with six tools that automate the back-office work of a small services business: proposals, invoices, CRM lead scoring, scheduling, and project estimation.

No external network calls. Every tool is a pure function of its inputs. Compose this server with other MCP servers (CRM, billing, calendar) when you need real systems behind the workflow.

## Tools

| Tool | What it does |
|---|---|
| `generate_proposal` | Build a Markdown proposal from structured inputs |
| `generate_invoice` | Build a Markdown invoice with totals and tax |
| `parse_invoice` | Pull structured fields from raw invoice text |
| `crm_lead_score` | Score a lead 0..100 with cold/warm/hot rating |
| `schedule_block` | Suggest meeting times around busy slots |
| `estimate_project` | Estimate effort and price from a brief and rate card |

## Build

```bash
npm install
npm run build
```

The output is at `dist/index.js`.

## Connect to Claude Code or Cowork

Add to your MCP config:

```json
{
  "mcpServers": {
    "business-tools": {
      "command": "node",
      "args": ["/absolute/path/to/awesome-claude-hacks/mcp-servers/business-tools-server/dist/index.js"]
    }
  }
}
```

Restart your client.

## Try it

In a Claude session:

> "Use business-tools to generate a proposal for Acme Ltd. Project title: Q2 Conversion Rate Sprint. Problem: their checkout abandonment is 68%. Solution: a 6-week funnel rebuild. Deliverables: redesigned cart, new checkout, A/B test framework. Price: GBP 45000. Timeline: 6 weeks. Sender: Mr Closer at Glaxtons."

The agent should call `generate_proposal` with structured args and return a Markdown proposal you can paste into a docx.

## How each tool works

### generate_proposal

Pure templating. The output follows the structure most enterprise buyers expect (executive summary, scope, approach, timeline, investment, out of scope, acceptance). All inputs are required to be specific. There is no auto-puffery.

### generate_invoice

Computes subtotals, applies the configured tax rate, totals, and produces a clean Markdown table. Defaults the due date to issue date plus 30 days. Defaults tax to 20% (UK VAT). Override either as needed.

### parse_invoice

Regex-based extraction. Reliably catches: invoice number, total, subtotal, dates, currency, VAT number. Emits `flags` for common problems (missing VAT, possible zero tax, future date) and a `confidence` rating. Pair with a real OCR step if you are reading PDFs.

### crm_lead_score

Heuristic scoring. Senior titles, larger company sizes, stronger budget signals, deeper engagement, and ICP match all add points. Returns a 0..100 score and a cold/warm/hot rating.

The heuristic is intentionally simple and explainable. If you need a learned model, swap this tool out for a wrapper around your model endpoint.

### schedule_block

Given a working-hours rule and a list of existing busy slots, suggests up to 5 available time windows over the next N days, skipping weekends. Useful when paired with a real calendar MCP server: that server returns the busy slots, this tool finds the gaps.

### estimate_project

Estimates effort from brief length and a complexity multiplier, then prices it against the average day rate from your rate card. Returns low / mid / high bands with explicit assumptions. Use as a starting point, not as a quote.

## Extending

To add a new tool:

1. Add a `Tool` entry to `TOOLS` in `src/index.ts` with a strict input schema
2. Add a `handle*` function next to the others
3. Add a switch case in the request handler
4. Rebuild

The server uses no global state and no network. Keep new tools the same way unless you really need to connect to something. When you do, add error handling that fails closed, not open.

## Testing manually

```bash
# build
npm run build

# pipe a tools/list request to it
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

You should see a JSON-RPC response with the tool list.

## License

MIT. See the repo root [LICENSE](../../LICENSE).

---

Built by Mr Closer
