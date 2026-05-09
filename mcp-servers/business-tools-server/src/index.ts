#!/usr/bin/env node
/**
 * Business Tools MCP Server
 *
 * A practical MCP server with real business automation tools:
 *   - generate_proposal:  produce a structured business proposal in Markdown
 *   - generate_invoice:   produce an invoice in Markdown with totals and tax
 *   - parse_invoice:      extract structured fields from raw invoice text
 *   - crm_lead_score:     score a lead 0..100 based on heuristics
 *   - schedule_block:     suggest a meeting time slot from working-hours rules
 *   - estimate_project:   estimate effort and price from a brief and rate card
 *
 * No external network. All tools are pure functions of their inputs. Compose
 * with other MCP servers to talk to real CRMs, billing systems, or calendars.
 *
 * Author: Mr Closer <jeanpascal@glaxtons.co.uk>
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

const SERVER_NAME = "business-tools-mcp-server";
const SERVER_VERSION = "1.0.0";

const TOOLS: Tool[] = [
  {
    name: "generate_proposal",
    description:
      "Produce a structured business proposal in Markdown. Inputs cover client, scope, timeline, and investment. Output follows the standard sections an enterprise buyer expects.",
    inputSchema: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "Legal name of the client." },
        project_title: { type: "string", description: "Short title for the project." },
        problem: { type: "string", description: "One-paragraph description of the problem." },
        solution: { type: "string", description: "One-paragraph description of the proposed solution." },
        deliverables: { type: "array", items: { type: "string" }, description: "List of deliverables, each starting with a noun." },
        phases: {
          type: "array",
          description: "Project phases in order.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              activities: { type: "array", items: { type: "string" } },
              outputs: { type: "array", items: { type: "string" } }
            },
            required: ["name", "description"]
          }
        },
        timeline_weeks: { type: "number", description: "Total project length in weeks." },
        currency: { type: "string", description: "ISO 4217 currency code, e.g. GBP, USD, EUR.", default: "GBP" },
        price: { type: "number", description: "Total fixed price, before tax." },
        sender_name: { type: "string", description: "Name of the sender from the supplier side." },
        sender_company: { type: "string", description: "Sender company name." }
      },
      required: ["client_name", "project_title", "problem", "solution", "deliverables", "price", "sender_name", "sender_company"]
    }
  },
  {
    name: "generate_invoice",
    description:
      "Produce an invoice in Markdown with line items, subtotals, tax, and totals. Suitable for forwarding to clients or storing in a finance system.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_number: { type: "string", description: "Invoice number to use, e.g. INV-2026-0001." },
        issue_date: { type: "string", description: "ISO date string, YYYY-MM-DD." },
        due_date: { type: "string", description: "ISO date string, YYYY-MM-DD. Defaults to 30 days after issue." },
        from: {
          type: "object",
          properties: {
            name: { type: "string" },
            address: { type: "string" },
            vat_number: { type: "string" }
          },
          required: ["name"]
        },
        to: {
          type: "object",
          properties: {
            name: { type: "string" },
            address: { type: "string" },
            vat_number: { type: "string" }
          },
          required: ["name"]
        },
        currency: { type: "string", default: "GBP" },
        tax_rate_pct: { type: "number", default: 20, description: "Tax rate as a percentage. Defaults to 20 (UK VAT)." },
        line_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" }
            },
            required: ["description", "quantity", "unit_price"]
          }
        },
        notes: { type: "string", description: "Optional payment terms or notes." }
      },
      required: ["invoice_number", "issue_date", "from", "to", "line_items"]
    }
  },
  {
    name: "parse_invoice",
    description:
      "Extract structured fields from raw invoice text. Returns a JSON record with issuer, recipient, dates, amounts, line items, and any flags.",
    inputSchema: {
      type: "object",
      properties: {
        raw_text: { type: "string", description: "The raw text of the invoice (from email body, OCR, or paste)." }
      },
      required: ["raw_text"]
    }
  },
  {
    name: "crm_lead_score",
    description:
      "Score a lead from 0 to 100 based on heuristics over title, company, signal strength, and engagement.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Job title of the contact." },
        company_size: { type: "number", description: "Approximate headcount." },
        industry: { type: "string", description: "Industry or sector." },
        budget_signal: { type: "string", enum: ["none", "weak", "strong"], description: "Strength of any budget signal observed." },
        engagement: { type: "string", enum: ["cold", "opened_email", "replied", "booked_call", "in_negotiation"] },
        icp_match: { type: "boolean", description: "Whether this matches your ideal customer profile." }
      },
      required: ["title", "engagement"]
    }
  },
  {
    name: "schedule_block",
    description:
      "Given a working-hours rule and existing busy slots, suggest available meeting times for a chosen duration.",
    inputSchema: {
      type: "object",
      properties: {
        timezone: { type: "string", description: "IANA timezone, e.g. Europe/London.", default: "Europe/London" },
        work_start_hour: { type: "number", description: "Start of working hours, 0..23.", default: 9 },
        work_end_hour: { type: "number", description: "End of working hours, 0..23.", default: 17 },
        duration_minutes: { type: "number", description: "Length of the meeting in minutes." },
        days_ahead: { type: "number", description: "How many days from today to consider.", default: 5 },
        busy_slots: {
          type: "array",
          description: "Existing busy slots in ISO 8601 format.",
          items: {
            type: "object",
            properties: {
              start: { type: "string" },
              end: { type: "string" }
            },
            required: ["start", "end"]
          }
        }
      },
      required: ["duration_minutes"]
    }
  },
  {
    name: "estimate_project",
    description:
      "Estimate effort and price for a project from a brief and a rate card. Returns low, mid, and high bands with assumptions.",
    inputSchema: {
      type: "object",
      properties: {
        brief: { type: "string", description: "Plain English description of the project." },
        rate_card: {
          type: "object",
          description: "Day rates by role.",
          additionalProperties: { type: "number" }
        },
        complexity: { type: "string", enum: ["simple", "standard", "complex"], default: "standard" },
        currency: { type: "string", default: "GBP" }
      },
      required: ["brief", "rate_card"]
    }
  }
];

type ToolResult = CallToolResult;
const ok = (text: string): ToolResult => ({ content: [{ type: "text", text }] });
const err = (message: string): ToolResult => ({ content: [{ type: "text", text: `Error: ${message}` }], isError: true });

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface ProposalPhase {
  name: string;
  description: string;
  activities?: string[];
  outputs?: string[];
}

function handleGenerateProposal(args: unknown): ToolResult {
  const a = args as {
    client_name: string;
    project_title: string;
    problem: string;
    solution: string;
    deliverables: string[];
    phases?: ProposalPhase[];
    timeline_weeks?: number;
    currency?: string;
    price: number;
    sender_name: string;
    sender_company: string;
  };

  const currency = a.currency ?? "GBP";
  const today = isoDate(new Date());
  const validUntil = isoDate(addDays(new Date(), 30));

  const phasesMd = (a.phases ?? []).map((p, i) => {
    const activities = (p.activities ?? []).map(x => `  - ${x}`).join("\n");
    const outputs = (p.outputs ?? []).map(x => `  - ${x}`).join("\n");
    return [
      `### Phase ${i + 1}: ${p.name}`,
      ``,
      p.description,
      ``,
      activities ? `Activities:\n${activities}` : "",
      ``,
      outputs ? `Outputs:\n${outputs}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const md = `# Proposal: ${a.project_title}

Prepared for **${a.client_name}**
Prepared by **${a.sender_company}** (${a.sender_name})
Date: ${today}
Valid until: ${validUntil}

## Executive summary

${a.problem}

${a.solution}

We propose to deliver this engagement on a fixed-price basis. Investment, scope, and timeline are detailed below.

## Scope of work

${a.deliverables.map(d => `- ${d}`).join("\n")}

## Approach

${phasesMd || "_Phases to be agreed during discovery._"}

## Timeline

Total length: ${a.timeline_weeks ?? "TBC"} weeks from kickoff.

## Investment

Total fixed price: **${fmtMoney(a.price, currency)}** excluding any applicable tax.

Payment schedule: 50% on signing, 50% on delivery, unless otherwise agreed.

## Out of scope

- Items not explicitly listed under Scope of work
- Ongoing support beyond the project end date
- Third-party costs (cloud hosting, licensed software) unless specified

## Acceptance

Accepted and authorised:

____________________________
${a.client_name}
Date: ____________________

____________________________
${a.sender_name} (${a.sender_company})
Date: ____________________
`;

  return ok(md);
}

interface InvoicePartyOut {
  name: string;
  address?: string;
  vat_number?: string;
}
interface InvoiceLineIn {
  description: string;
  quantity: number;
  unit_price: number;
}

function handleGenerateInvoice(args: unknown): ToolResult {
  const a = args as {
    invoice_number: string;
    issue_date: string;
    due_date?: string;
    from: InvoicePartyOut;
    to: InvoicePartyOut;
    currency?: string;
    tax_rate_pct?: number;
    line_items: InvoiceLineIn[];
    notes?: string;
  };

  const currency = a.currency ?? "GBP";
  const taxRate = (a.tax_rate_pct ?? 20) / 100;
  const dueDate = a.due_date ?? isoDate(addDays(new Date(a.issue_date), 30));

  const lineRows = a.line_items.map(l => {
    const total = l.quantity * l.unit_price;
    return `| ${l.description} | ${l.quantity} | ${fmtMoney(l.unit_price, currency)} | ${fmtMoney(total, currency)} |`;
  });

  const subtotal = a.line_items.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const md = `# Invoice ${a.invoice_number}

Issued: ${a.issue_date}
Due: ${dueDate}

## From

${a.from.name}
${a.from.address ?? ""}
${a.from.vat_number ? `VAT: ${a.from.vat_number}` : ""}

## To

${a.to.name}
${a.to.address ?? ""}
${a.to.vat_number ? `VAT: ${a.to.vat_number}` : ""}

## Line items

| Description | Quantity | Unit price | Line total |
|---|---|---|---|
${lineRows.join("\n")}

## Totals

| | |
|---|---|
| Subtotal | ${fmtMoney(subtotal, currency)} |
| Tax (${(taxRate * 100).toFixed(0)}%) | ${fmtMoney(tax, currency)} |
| **Total** | **${fmtMoney(total, currency)}** |

${a.notes ? `\n## Notes\n\n${a.notes}\n` : ""}
`;

  return ok(md);
}

function handleParseInvoice(args: unknown): ToolResult {
  const a = args as { raw_text: string };
  const text = a.raw_text;

  const invoiceIdMatch =
    text.match(/invoice\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9\-_/]+)/i);
  const totalMatch =
    text.match(/total\s*(?:due)?\s*[:\-]?\s*[A-Z]{0,3}\s*\$?£?€?\s*([0-9,]+\.[0-9]{2})/i);
  const subtotalMatch =
    text.match(/subtotal\s*[:\-]?\s*[A-Z]{0,3}\s*\$?£?€?\s*([0-9,]+\.[0-9]{2})/i);
  const dateIssuedMatch =
    text.match(/(?:issued|date)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/);
  const dueMatch =
    text.match(/due\s*(?:date)?\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i);
  const vatMatch = text.match(/(?:vat|tax)\s*(?:reg)?\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z]{2}\s?[0-9]{6,12})/i);
  const currencyMatch = text.match(/\b(GBP|USD|EUR|AUD|CAD|CHF|JPY)\b/);

  const flags: string[] = [];
  if (!vatMatch) flags.push("missing_vat");
  if (subtotalMatch && totalMatch) {
    const subtotal = parseFloat(subtotalMatch[1].replace(/,/g, ""));
    const total = parseFloat(totalMatch[1].replace(/,/g, ""));
    if (Math.abs(total - subtotal) < 0.01 && total > 0) {
      flags.push("possible_zero_tax");
    }
  }
  if (dateIssuedMatch) {
    const d = new Date(dateIssuedMatch[1]);
    if (!isNaN(d.getTime()) && d.getTime() > Date.now()) flags.push("future_date");
  }

  const result = {
    invoice_id: invoiceIdMatch?.[1] ?? null,
    issued: dateIssuedMatch?.[1] ?? null,
    due: dueMatch?.[1] ?? null,
    currency: currencyMatch?.[1] ?? null,
    subtotal: subtotalMatch ? parseFloat(subtotalMatch[1].replace(/,/g, "")) : null,
    total: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, "")) : null,
    issuer_vat: vatMatch?.[1] ?? null,
    flags,
    confidence: invoiceIdMatch && totalMatch ? "high" : "low",
  };

  return ok(JSON.stringify(result, null, 2));
}

const SENIOR_TITLES = [
  "ceo", "cto", "cfo", "coo", "cio", "cmo", "cpo",
  "founder", "co-founder", "owner", "managing director", "md",
  "vp", "vice president", "head of", "director"
];

function handleCrmLeadScore(args: unknown): ToolResult {
  const a = args as {
    title: string;
    company_size?: number;
    industry?: string;
    budget_signal?: "none" | "weak" | "strong";
    engagement: "cold" | "opened_email" | "replied" | "booked_call" | "in_negotiation";
    icp_match?: boolean;
  };

  let score = 0;
  const titleLc = a.title.toLowerCase();

  if (SENIOR_TITLES.some(t => titleLc.includes(t))) score += 20;
  else score += 5;

  if (a.company_size) {
    if (a.company_size >= 500) score += 15;
    else if (a.company_size >= 50) score += 10;
    else if (a.company_size >= 10) score += 5;
  }

  switch (a.budget_signal ?? "none") {
    case "strong": score += 25; break;
    case "weak":   score += 10; break;
    default: break;
  }

  switch (a.engagement) {
    case "in_negotiation": score += 30; break;
    case "booked_call":    score += 22; break;
    case "replied":        score += 15; break;
    case "opened_email":   score += 5;  break;
    case "cold":                       break;
  }

  if (a.icp_match) score += 10;

  score = Math.max(0, Math.min(100, score));

  let rating: "cold" | "warm" | "hot";
  if (score >= 70) rating = "hot";
  else if (score >= 40) rating = "warm";
  else rating = "cold";

  const result = { score, rating };
  return ok(JSON.stringify(result, null, 2));
}

interface BusySlot { start: string; end: string; }

function handleScheduleBlock(args: unknown): ToolResult {
  const a = args as {
    timezone?: string;
    work_start_hour?: number;
    work_end_hour?: number;
    duration_minutes: number;
    days_ahead?: number;
    busy_slots?: BusySlot[];
  };

  const startHour = a.work_start_hour ?? 9;
  const endHour = a.work_end_hour ?? 17;
  const duration = a.duration_minutes;
  const daysAhead = a.days_ahead ?? 5;
  const busy = (a.busy_slots ?? [])
    .map(s => ({ start: new Date(s.start).getTime(), end: new Date(s.end).getTime() }))
    .filter(s => !isNaN(s.start) && !isNaN(s.end))
    .sort((x, y) => x.start - y.start);

  const suggestions: string[] = [];
  const now = new Date();

  for (let day = 1; day <= daysAhead && suggestions.length < 5; day++) {
    const date = addDays(now, day);
    const dow = date.getUTCDay();
    if (dow === 0 || dow === 6) continue;

    const dayStart = new Date(date);
    dayStart.setUTCHours(startHour, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(endHour, 0, 0, 0);

    let cursor = dayStart.getTime();
    const dayEndMs = dayEnd.getTime();

    while (cursor + duration * 60_000 <= dayEndMs && suggestions.length < 5) {
      const slotEnd = cursor + duration * 60_000;
      const conflict = busy.some(b => !(slotEnd <= b.start || cursor >= b.end));
      if (!conflict) {
        suggestions.push(
          `${new Date(cursor).toISOString()} to ${new Date(slotEnd).toISOString()}`
        );
        cursor = slotEnd;
      } else {
        cursor += 30 * 60_000;
      }
    }
  }

  return ok(JSON.stringify({ suggestions, count: suggestions.length }, null, 2));
}

function handleEstimateProject(args: unknown): ToolResult {
  const a = args as {
    brief: string;
    rate_card: Record<string, number>;
    complexity?: "simple" | "standard" | "complex";
    currency?: string;
  };

  const complexity = a.complexity ?? "standard";
  const currency = a.currency ?? "GBP";
  const wordCount = a.brief.trim().split(/\s+/).length;

  const baseDays = Math.max(5, Math.min(40, Math.round(wordCount / 30)));
  const complexityMultiplier = complexity === "simple" ? 0.7 : complexity === "complex" ? 1.6 : 1.0;
  const midDays = Math.round(baseDays * complexityMultiplier);
  const lowDays = Math.max(3, Math.round(midDays * 0.7));
  const highDays = Math.round(midDays * 1.4);

  const rates = Object.entries(a.rate_card);
  const avgRate = rates.length > 0
    ? rates.reduce((s, [, r]) => s + r, 0) / rates.length
    : 800;

  const lowPrice = Math.round(lowDays * avgRate);
  const midPrice = Math.round(midDays * avgRate);
  const highPrice = Math.round(highDays * avgRate);

  const result = {
    complexity,
    estimate_days: { low: lowDays, mid: midDays, high: highDays },
    estimate_price: {
      currency,
      low: lowPrice,
      mid: midPrice,
      high: highPrice,
      formatted: {
        low: fmtMoney(lowPrice, currency),
        mid: fmtMoney(midPrice, currency),
        high: fmtMoney(highPrice, currency),
      },
    },
    average_day_rate_used: avgRate,
    assumptions: [
      "Effort scales linearly with brief length and complexity multiplier",
      "Average rate is a uniform mean across the rate card",
      "No buffer included; add 15-25% contingency for fixed-price work",
      "Excludes third-party costs and travel",
    ],
  };

  return ok(JSON.stringify(result, null, 2));
}

async function main(): Promise<void> {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      switch (name) {
        case "generate_proposal":  return handleGenerateProposal(args);
        case "generate_invoice":   return handleGenerateInvoice(args);
        case "parse_invoice":      return handleParseInvoice(args);
        case "crm_lead_score":     return handleCrmLeadScore(args);
        case "schedule_block":     return handleScheduleBlock(args);
        case "estimate_project":   return handleEstimateProject(args);
        default:                   return err(`Unknown tool: ${name}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return err(`Tool '${name}' failed: ${msg}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(`${SERVER_NAME} v${SERVER_VERSION} ready on stdio\n`);
}

main().catch((e) => {
  const msg = e instanceof Error ? e.stack ?? e.message : String(e);
  process.stderr.write(`Fatal: ${msg}\n`);
  process.exit(1);
});
