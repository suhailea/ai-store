/**
 * MCP provider registry.
 *
 * Single source of truth for all MCP server endpoints.
 * Maps connector provider keys → MCP server URLs.
 *
 * Add new providers here — no other file needs to know the URL.
 */

// gmail and google_calendar are native tools (direct REST API) — not MCP.
export type DiscoverableProvider = "slack";

export const MCP_REGISTRY: Record<DiscoverableProvider, string> = {
  slack: "https://mcp.slack.com/mcp",
};

/** Type guard — true if the provider has a registered MCP URL. */
export function isDiscoverableProvider(provider: string): provider is DiscoverableProvider {
  return Object.hasOwn(MCP_REGISTRY, provider);
}
