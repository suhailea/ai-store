/**
 * Generic MCP HTTP client.
 *
 * Wraps @modelcontextprotocol/sdk to connect to any remote MCP server
 * over the Streamable HTTP transport (the standard for hosted MCP endpoints).
 *
 * Usage:
 *   const result = await callMcpTool({
 *     serverUrl: "https://gmailmcp.googleapis.com/mcp/v1",
 *     accessToken: "ya29.xxx",
 *     toolName: "list_emails",
 *     toolArgs: { maxResults: 10 },
 *   });
 *
 * Each call opens a fresh session, calls the tool, and closes the transport.
 * MCP servers are stateless for tool calls so session reuse is not required.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import logger from "../../lib/logger";
import { MCP_REGISTRY, type DiscoverableProvider } from "./registry";

/** Check live metadata instead of guessing safety from a tool's name. */
export async function isMcpToolReadOnly(
  provider: DiscoverableProvider,
  accessToken: string,
  toolName: string
): Promise<boolean> {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_REGISTRY[provider]), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const client = new Client({ name: "staffroom-agent", version: "1.0.0" }, { capabilities: {} });
  try {
    await client.connect(transport as Parameters<typeof client.connect>[0]);
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const page = await client.listTools(cursor ? { cursor } : {});
      const tool = page.tools.find((t) => t.name === toolName);
      if (tool) return tool.annotations?.readOnlyHint === true;
      cursor = page.nextCursor;
      if (cursor && seen.has(cursor)) throw new Error("Tool catalog repeated a pagination cursor.");
      if (cursor) seen.add(cursor);
    } while (cursor);
    throw new Error("Configured tool is no longer available. Refresh the connector's tools.");
  } finally {
    await client.close();
  }
}

export interface McpCallOptions {
  /** Full URL of the MCP server endpoint */
  serverUrl: string;
  /** Bearer token to pass in Authorization header */
  accessToken: string;
  /** MCP tool name to call */
  toolName: string;
  /** Arguments to pass to the tool */
  toolArgs: Record<string, unknown>;
}

/**
 * Opens an MCP session, calls a single tool, closes the session, and returns
 * the raw result content array from the MCP response.
 */
export async function callMcpTool(opts: McpCallOptions): Promise<unknown> {
  const { serverUrl, accessToken, toolName, toolArgs } = opts;

  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const client = new Client(
    { name: "staffroom-agent", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport as Parameters<typeof client.connect>[0]);

    logger.debug("MCP tool call", { serverUrl, toolName, toolArgs });

    const response = await client.callTool({ name: toolName, arguments: toolArgs });

    logger.debug("MCP tool response", { toolName, isError: response.isError });

    const content = response.content as McpContentBlock[];

    if (response.isError) {
      const errorText = content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      throw new Error(`MCP tool error from ${toolName}: ${errorText}`);
    }

    // Return parsed content — text blocks are JSON-decoded if possible
    return extractMcpContent(content);
  } finally {
    await client.close();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type McpContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource"; resource: unknown };

/**
 * Extracts the most useful value from MCP response content blocks.
 * - Single text block that is valid JSON → parsed object
 * - Single text block → raw string
 * - Multiple blocks → array
 */
function extractMcpContent(content: McpContentBlock[]): unknown {
  const textBlocks = content.filter((c): c is { type: "text"; text: string } => c.type === "text");

  if (textBlocks.length === 1) {
    try {
      return JSON.parse(textBlocks[0].text);
    } catch {
      return textBlocks[0].text;
    }
  }

  if (textBlocks.length > 1) {
    return textBlocks.map((b) => {
      try {
        return JSON.parse(b.text);
      } catch {
        return b.text;
      }
    });
  }

  return content;
}
