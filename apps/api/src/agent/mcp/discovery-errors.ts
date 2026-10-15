/** Never return raw MCP/HTTP response bodies to the product UI. */
export function discoveryErrorMessage(error: unknown): string {
  const details = error as { code?: unknown; status?: unknown; name?: unknown; message?: unknown } | null;
  const status = details?.code ?? details?.status;
  if (status === 401 || status === 403) {
    return "Tool discovery was denied. Reconnect this account and check its permissions.";
  }
  if (details?.name === "TimeoutError" || details?.name === "AbortError") {
    return "Loading tools timed out. Please try again.";
  }
  if (typeof details?.message === "string") {
    if (/^(slack) is not connected\./.test(details.message)) {
      return "Connect this account in Connectors before loading tools.";
    }
    if (/token is expired and no refresh token is available/.test(details.message)) {
      return "This connection has expired. Reconnect the account to load tools.";
    }
  }
  return "Could not load tools from this connection. Please try again.";
}
