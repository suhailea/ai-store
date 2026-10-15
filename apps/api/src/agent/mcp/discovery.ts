/**
 * MCP tool discovery service.
 *
 * Connects to a provider's MCP server, fetches its tool list via
 * client.listTools(), and upserts the results into connector_tools.
 *
 * Called in two places:
 *   1. Fire-and-forget after a successful OAuth callback (connectors.ts)
 *   2. On-demand via POST /api/connectors/:provider/tools/refresh
 *
 * Failures in (1) must never crash the OAuth redirect — callers must
 * catch and log. Failures in (2) are returned as HTTP 422.
 */

import { eq, and } from "drizzle-orm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getDb, connectorTools } from "@staffroom/db";
import { getConnectorToken } from "./auth";
import { MCP_REGISTRY, isDiscoverableProvider } from "./registry";
import { newId } from "../../lib/id";
import logger from "../../lib/logger";

export interface DiscoveryResult {
  provider: string;
  count: number;
}

/**
 * Fetch the tool list from a provider's MCP server and persist it to DB.
 * Throws if the provider is not in the registry or the connector is not connected.
 */
export async function discoverProviderTools(
  businessId: string,
  provider: string
): Promise<DiscoveryResult> {
  if (!isDiscoverableProvider(provider)) {
    throw new Error(`Provider "${provider}" has no registered MCP URL and cannot be discovered.`);
  }

  const { accessToken } = await getConnectorToken(businessId, provider);

  const serverUrl = MCP_REGISTRY[provider];

  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const client = new Client(
    { name: "staffroom-discovery", version: "1.0.0" },
    { capabilities: {} }
  );

  let discoveredTools: Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>;

  try {
    await client.connect(transport as Parameters<typeof client.connect>[0]);
    discoveredTools = [];
    let cursor: string | undefined;
    const seenCursors = new Set<string>();
    do {
      const result = await client.listTools(cursor ? { cursor } : {});
      discoveredTools.push(...result.tools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: t.inputSchema as Record<string, unknown>,
      })));
      cursor = result.nextCursor;
      if (cursor && seenCursors.has(cursor)) {
        throw new Error("Tool discovery returned a repeated pagination cursor.");
      }
      if (cursor) seenCursors.add(cursor);
    } while (cursor);
  } finally {
    await client.close();
  }

  const db = getDb();
  const now = new Date();

  for (const tool of discoveredTools) {
    const [existing] = await db
      .select({ id: connectorTools.id })
      .from(connectorTools)
      .where(
        and(
          eq(connectorTools.businessId, businessId),
          eq(connectorTools.provider, provider),
          eq(connectorTools.toolName, tool.name)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(connectorTools)
        .set({
          description:  tool.description ?? "",
          inputSchema:  tool.inputSchema as Record<string, unknown>,
          discoveredAt: now,
        })
        .where(eq(connectorTools.id, existing.id));
    } else {
      await db.insert(connectorTools).values({
        id:           newId("ctool"),
        businessId,
        provider,
        toolName:     tool.name,
        description:  tool.description ?? "",
        inputSchema:  tool.inputSchema as Record<string, unknown>,
        discoveredAt: now,
      });
    }
  }

  logger.info("MCP tool discovery complete", { businessId, provider, count: discoveredTools.length });

  return { provider, count: discoveredTools.length };
}
