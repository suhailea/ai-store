/**
 * MCP Auth Registry — centralized connector token management.
 *
 * Single responsibility: given a businessId + provider, return a valid
 * access token. Handles DB loading, expiry checking, and token refresh.
 *
 * Each provider has its own refresh strategy:
 *   - google  → OAuth2 refresh_token flow via googleapis
 *   - slack   → tokens do not expire, no refresh needed
 *   - microsoft → MSAL manages refresh internally (future)
 *
 * All MCP integration modules (gmail.ts, gcal.ts, slack.ts) call
 * getConnectorToken() instead of owning their own token logic.
 */

import { eq, and, desc } from "drizzle-orm";
import { google } from "googleapis";
import { getDb, connectorAccounts } from "@staffroom/db";
import logger from "../../lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type McpProvider = "gmail" | "google_calendar" | "google_drive" | "google_sheets" | "postgres" | "excel" | "slack" | "outlook" | "outlook_calendar";

interface ConnectorToken {
  accessToken: string;
  connectorId: string;
}

// ─── Provider refresh strategies ─────────────────────────────────────────────

/**
 * Refresh a Google OAuth2 access token using the stored refresh token.
 * Works for both Gmail and Google Calendar (same OAuth app, different scopes).
 */
async function refreshGoogleToken(
  connectorId: string,
  refreshToken: string
): Promise<string> {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Google token refresh returned no access token.");
  }

  const db = getDb();
  await db
    .update(connectorAccounts)
    .set({
      accessToken: credentials.access_token,
      expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
    })
    .where(eq(connectorAccounts.id, connectorId));

  logger.info("Google access token refreshed", { connectorId });

  return credentials.access_token;
}

// Refresh dispatch — add new providers here only
const REFRESH_STRATEGIES: Partial<
  Record<McpProvider, (connectorId: string, refreshToken: string) => Promise<string>>
> = {
  gmail:            refreshGoogleToken,
  google_calendar:  refreshGoogleToken,
  google_drive:     refreshGoogleToken,
  google_sheets:    refreshGoogleToken,
  // slack: no refresh needed — tokens do not expire
  // outlook: MSAL manages refresh internally (future)
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load a valid access token for the given business + provider.
 *
 * - Throws if no connector row exists (integration not connected).
 * - Refreshes automatically if the token is within 60 seconds of expiry.
 * - Persists the refreshed token back to the DB before returning.
 */
export async function getConnectorToken(
  businessId: string,
  provider: McpProvider
): Promise<ConnectorToken> {
  const db = getDb();

  const [connector] = await db
    .select()
    .from(connectorAccounts)
    .where(
      and(
        eq(connectorAccounts.businessId, businessId),
        eq(connectorAccounts.provider, provider)
      )
    )
    .orderBy(desc(connectorAccounts.connectedAt))
    .limit(1);

  if (!connector) {
    throw new Error(
      `${provider} is not connected. Connect it in the Connectors page first.`
    );
  }

  // Token is still valid — return as-is
  const expiresAt = connector.expiresAt;
  const isExpired = expiresAt !== null && expiresAt <= new Date(Date.now() + 60_000);

  if (!isExpired) {
    return { accessToken: connector.accessToken, connectorId: connector.id };
  }

  // Need to refresh
  const refresh = REFRESH_STRATEGIES[provider];

  if (!refresh) {
    // Provider tokens don't expire (e.g. Slack) — return as-is even if expiresAt is set
    return { accessToken: connector.accessToken, connectorId: connector.id };
  }

  if (!connector.refreshToken) {
    throw new Error(
      `${provider} token is expired and no refresh token is available. Please reconnect.`
    );
  }

  logger.info("Refreshing connector token", { businessId, provider, connectorId: connector.id });

  const accessToken = await refresh(connector.id, connector.refreshToken);

  return { accessToken, connectorId: connector.id };
}
