#!/usr/bin/env node
/**
 * Starter MCP Server
 *
 * The smallest useful Model Context Protocol server. It exposes three tools:
 *   - echo:        round-trips text, useful for verifying the server is reachable
 *   - now:         returns the current time in a chosen timezone
 *   - word_count:  counts words, characters, lines in a piece of text
 *
 * Use this as the starting point for your own server. Replace the tools
 * in TOOLS and CALL_TOOL below.
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

const SERVER_NAME = "starter-mcp-server";
const SERVER_VERSION = "1.0.0";

const TOOLS: Tool[] = [
  {
    name: "echo",
    description:
      "Echo back the provided text. Useful for verifying the server is reachable and that the round-trip works.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to echo back.",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "now",
    description:
      "Return the current date and time. Optionally formatted for a specific IANA timezone.",
    inputSchema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            "IANA timezone identifier (for example, 'Europe/London', 'America/New_York'). Defaults to UTC.",
        },
        format: {
          type: "string",
          enum: ["iso", "human"],
          description:
            "'iso' for ISO 8601, 'human' for a readable string. Defaults to 'iso'.",
        },
      },
    },
  },
  {
    name: "word_count",
    description:
      "Count words, characters (with and without spaces), and lines in a piece of text.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to analyze.",
        },
      },
      required: ["text"],
    },
  },
];

type ToolResult = CallToolResult;

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function err(message: string): ToolResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

function handleEcho(args: unknown): ToolResult {
  const a = args as { text?: unknown };
  if (typeof a.text !== "string") {
    return err("'text' is required and must be a string");
  }
  return ok(a.text);
}

function handleNow(args: unknown): ToolResult {
  const a = (args ?? {}) as { timezone?: unknown; format?: unknown };
  const tz = typeof a.timezone === "string" ? a.timezone : "UTC";
  const fmt = a.format === "human" ? "human" : "iso";
  const now = new Date();

  try {
    if (fmt === "iso") {
      if (tz === "UTC") {
        return ok(now.toISOString());
      }
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(now);
      const get = (t: string) => parts.find(p => p.type === t)?.value ?? "00";
      const iso = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")} ${tz}`;
      return ok(iso);
    }
    return ok(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(now)
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(`Could not format time for timezone '${tz}': ${msg}`);
  }
}

function handleWordCount(args: unknown): ToolResult {
  const a = args as { text?: unknown };
  if (typeof a.text !== "string") {
    return err("'text' is required and must be a string");
  }
  const text = a.text;
  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/u).length;
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/gu, "").length;
  const lines = text === "" ? 0 : text.split(/\r\n|\r|\n/u).length;

  return ok(
    JSON.stringify(
      { words, characters: chars, characters_no_spaces: charsNoSpaces, lines },
      null,
      2
    )
  );
}

async function main(): Promise<void> {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
      case "echo":
        return handleEcho(args);
      case "now":
        return handleNow(args);
      case "word_count":
        return handleWordCount(args);
      default:
        return err(`Unknown tool: ${name}`);
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
