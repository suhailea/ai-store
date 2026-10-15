/**
 * /api/connectors
 *
 * Handles OAuth connect / callback / list / disconnect for:
 *   - Gmail          (Google OAuth2)
 *   - Google Calendar (Google OAuth2 — same app, different scopes)
 *   - Outlook        (Microsoft MSAL)
 *   - Outlook Calendar (Microsoft MSAL — same app, different scopes)
 *   - Slack          (@slack/oauth)
 *
 * To add a new provider: add an entry to PROVIDER_CONFIG below. Nothing else.
 */

import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { google } from "googleapis";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { getDb, connectorAccounts, connectorTools } from "@staffroom/db";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/id";
import { discoverProviderTools } from "../agent/mcp/discovery";
import { discoveryErrorMessage } from "../agent/mcp/discovery-errors";
import { isDiscoverableProvider } from "../agent/mcp/registry";
import logger from "../lib/logger";
import type { AppEnv } from "../lib/types";

export const connectorRoutes = new Hono<AppEnv>();

// ─── Provider configuration ───────────────────────────────────────────────────
// Each provider declares: what scopes it needs and how to build its auth URL.

const GOOGLE_SCOPES: Record<string, string[]> = {
  gmail: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.send",
    "openid",
    "email",
  ],
  google_calendar: [
    "https://www.googleapis.com/auth/calendar",
    "openid",
    "email",
  ],
  google_drive: [
    "https://www.googleapis.com/auth/drive",
    "openid",
    "email",
  ],
  google_sheets: [
    "https://www.googleapis.com/auth/spreadsheets",
    "openid",
    "email",
  ],
};

const MICROSOFT_SCOPES: Record<string, string[]> = {
  outlook: ["offline_access", "Mail.Read", "Mail.Send", "User.Read"],
  outlook_calendar: ["offline_access", "Calendars.ReadWrite", "User.Read"],
};

// User token scopes required by the Slack MCP server
const SLACK_USER_SCOPES = [
  "search:read.public",
  "channels:history",
  "groups:history",
  "mpim:history",
  "im:history",
  "channels:read",
  "groups:read",
  "chat:write",
  "users:read",
  "users:read.email",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function googleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function msalClient() {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? "common"}`,
    },
  });
}

function slackAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID!,
    user_scope: SLACK_USER_SCOPES.join(","),
    redirect_uri: process.env.SLACK_REDIRECT_URI!,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

// ─── GET /api/connectors ──────────────────────────────────────────────────────
// Returns all connected accounts for the authenticated business (tokens omitted).

connectorRoutes.get("/", requireAuth, async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();

  const rows = await db
    .select({
      id: connectorAccounts.id,
      businessId: connectorAccounts.businessId,
      provider: connectorAccounts.provider,
      accountEmail: connectorAccounts.accountEmail,
      scopes: connectorAccounts.scopes,
      connectedAt: connectorAccounts.connectedAt,
    })
    .from(connectorAccounts)
    .where(eq(connectorAccounts.businessId, businessId));

  return c.json({ ok: true, data: rows });
});

// ─── DELETE /api/connectors/:id ───────────────────────────────────────────────
// Revoke & delete a connected account.

connectorRoutes.delete("/:id", requireAuth, async (c) => {
  const { businessId } = c.get("user");
  const id = c.req.param("id");
  const db = getDb();

  await db
    .delete(connectorAccounts)
    .where(
      and(
        eq(connectorAccounts.id, id),
        eq(connectorAccounts.businessId, businessId)
      )
    );

  return c.json({ ok: true, data: null });
});

// ─── Google: connect ──────────────────────────────────────────────────────────
// GET /api/connectors/gmail/connect
// GET /api/connectors/google_calendar/connect
// GET /api/connectors/google_drive/connect
// GET /api/connectors/google_sheets/connect

connectorRoutes.get("/:provider/connect", requireAuth, async (c) => {
  const provider = c.req.param("provider");
  const { businessId, userId } = c.get("user");

  if (provider in GOOGLE_SCOPES) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return c.json({ ok: false, error: "Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env" }, 503);
    }
    const oauth2 = googleOAuthClient();
    const url = oauth2.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_SCOPES[provider],
      state: JSON.stringify({ provider, businessId, userId }),
    });
    return c.redirect(url);
  }

  if (provider === "outlook" || provider === "outlook_calendar") {
    if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
      return c.json({ ok: false, error: "Microsoft OAuth not configured. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to .env" }, 503);
    }
    const msal = msalClient();
    const url = await msal.getAuthCodeUrl({
      scopes: MICROSOFT_SCOPES[provider],
      redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
      state: JSON.stringify({ provider, businessId, userId }),
    });
    return c.redirect(url);
  }

  if (provider === "slack") {
    if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET || !process.env.SLACK_REDIRECT_URI) {
      return c.json({ ok: false, error: "Slack OAuth not configured. Add SLACK_CLIENT_ID, SLACK_CLIENT_SECRET and SLACK_REDIRECT_URI to .env" }, 503);
    }
    const state = JSON.stringify({ businessId, userId });
    return c.redirect(slackAuthUrl(state));
  }

  return c.json({ ok: false, error: `Unknown provider: ${provider}` }, 400);
});

// ─── Google: callback ─────────────────────────────────────────────────────────
// GET /api/connectors/gmail/callback   (handles both gmail + google_calendar via state)

connectorRoutes.get("/gmail/callback", async (c) => {
  const code = c.req.query("code");
  const stateRaw = c.req.query("state");

  if (!code || !stateRaw) {
    return c.redirect(`${process.env.APP_URL}/connectors?error=google_missing_params`);
  }

  let state: { provider: string; businessId: string };
  try {
    state = JSON.parse(stateRaw);
  } catch {
    return c.redirect(`${process.env.APP_URL}/connectors?error=google_bad_state`);
  }

  try {
    const oauth2 = googleOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // Fetch account email
    const oauth2Info = google.oauth2({ version: "v2", auth: oauth2 });
    const { data: profile } = await oauth2Info.userinfo.get();

    const db = getDb();

    // Upsert: one row per (businessId, provider)
    const existing = await db
      .select({ id: connectorAccounts.id })
      .from(connectorAccounts)
      .where(
        and(
          eq(connectorAccounts.businessId, state.businessId),
          eq(connectorAccounts.provider, state.provider)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(connectorAccounts)
        .set({
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token ?? null,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          accountEmail: profile.email ?? null,
          scopes: tokens.scope ?? null,
          connectedAt: new Date(),
        })
        .where(eq(connectorAccounts.id, existing[0].id));
    } else {
      await db.insert(connectorAccounts).values({
        id: newId("con"),
        businessId: state.businessId,
        provider: state.provider,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        accountEmail: profile.email ?? null,
        scopes: tokens.scope ?? null,
      });
    }

    // Fire-and-forget tool discovery — must not block the OAuth redirect
    discoverProviderTools(state.businessId, state.provider).catch((err) =>
      logger.warn("Background tool discovery failed", {
        provider: state.provider,
        error: (err as Error).message,
      })
    );

    return c.redirect(`${process.env.APP_URL}/connectors?connected=${state.provider}`);
  } catch (err) {
    logger.error("Google OAuth callback error", { error: (err as Error).message });
    return c.redirect(`${process.env.APP_URL}/connectors?error=google_callback_failed`);
  }
});

// ─── Microsoft: callback ──────────────────────────────────────────────────────
// GET /api/connectors/outlook/callback  (handles both outlook + outlook_calendar)

connectorRoutes.get("/outlook/callback", async (c) => {
  const code = c.req.query("code");
  const stateRaw = c.req.query("state");

  if (!code || !stateRaw) {
    return c.redirect(`${process.env.APP_URL}/connectors?error=microsoft_missing_params`);
  }

  let state: { provider: string; businessId: string };
  try {
    state = JSON.parse(stateRaw);
  } catch {
    return c.redirect(`${process.env.APP_URL}/connectors?error=microsoft_bad_state`);
  }

  try {
    const msal = msalClient();
    const result = await msal.acquireTokenByCode({
      code,
      scopes: MICROSOFT_SCOPES[state.provider] ?? MICROSOFT_SCOPES.outlook,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
    });

    const db = getDb();

    const existing = await db
      .select({ id: connectorAccounts.id })
      .from(connectorAccounts)
      .where(
        and(
          eq(connectorAccounts.businessId, state.businessId),
          eq(connectorAccounts.provider, state.provider)
        )
      )
      .limit(1);

    const accountEmail = result.account?.username ?? null;
    const expiresAt = result.expiresOn ? new Date(result.expiresOn) : null;

    if (existing.length > 0) {
      await db
        .update(connectorAccounts)
        .set({
          accessToken: result.accessToken,
          expiresAt,
          accountEmail,
          scopes: result.scopes.join(" "),
          connectedAt: new Date(),
        })
        .where(eq(connectorAccounts.id, existing[0].id));
    } else {
      await db.insert(connectorAccounts).values({
        id: newId("con"),
        businessId: state.businessId,
        provider: state.provider,
        accessToken: result.accessToken,
        refreshToken: null, // MSAL manages refresh internally via token cache
        expiresAt,
        accountEmail,
        scopes: result.scopes.join(" "),
      });
    }

    return c.redirect(`${process.env.APP_URL}/connectors?connected=${state.provider}`);
  } catch (err) {
    logger.error("Microsoft OAuth callback error", { error: (err as Error).message });
    return c.redirect(`${process.env.APP_URL}/connectors?error=microsoft_callback_failed`);
  }
});

// ─── Slack: callback ──────────────────────────────────────────────────────────

connectorRoutes.get("/slack/callback", async (c) => {
  const code = c.req.query("code");
  const stateRaw = c.req.query("state");

  if (!code) {
    return c.redirect(`${process.env.APP_URL}/connectors?error=slack_missing_code`);
  }

  let businessId = "";
  try {
    const meta = JSON.parse(stateRaw ?? "{}");
    businessId = meta.businessId ?? "";
  } catch {
    return c.redirect(`${process.env.APP_URL}/connectors?error=slack_bad_state`);
  }

  try {
    const { WebClient } = await import("@slack/web-api");
    const client = new WebClient();
    const result = await client.oauth.v2.access({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: process.env.SLACK_REDIRECT_URI!,
    });

    // Slack MCP requires a user token — extract from authed_user
    const authedUser = (result as any).authed_user as { access_token?: string; scope?: string } | undefined;
    const userToken = authedUser?.access_token;
    if (!userToken) {
      logger.error("Slack OAuth: no user token returned", { result });
      return c.redirect(`${process.env.APP_URL}/connectors?error=slack_no_user_token`);
    }

    const teamName = (result as any).team?.name as string | undefined;
    const accountEmail = teamName ?? null;
    const scopes = authedUser?.scope ?? SLACK_USER_SCOPES.join(",");

    const db = getDb();
    const existing = await db
      .select({ id: connectorAccounts.id })
      .from(connectorAccounts)
      .where(and(
        eq(connectorAccounts.businessId, businessId),
        eq(connectorAccounts.provider, "slack")
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(connectorAccounts).set({
        accessToken: userToken,
        accountEmail,
        scopes,
        connectedAt: new Date(),
      }).where(eq(connectorAccounts.id, existing[0].id));
    } else {
      await db.insert(connectorAccounts).values({
        id: newId("con"),
        businessId,
        provider: "slack",
        accessToken: userToken,
        refreshToken: null,
        expiresAt: null,
        accountEmail,
        scopes,
      });
    }

    // Fire-and-forget tool discovery from Slack MCP
    discoverProviderTools(businessId, "slack").catch((err) =>
      logger.warn("Slack MCP tool discovery failed", { error: (err as Error).message })
    );

    return c.redirect(`${process.env.APP_URL}/connectors?connected=slack`);
  } catch (err) {
    logger.error("Slack OAuth callback error", { error: (err as Error).message });
    return c.redirect(`${process.env.APP_URL}/connectors?error=slack_callback_failed`);
  }
});

// ─── PostgreSQL: connect (connection string, no OAuth) ────────────────────────
// POST /api/connectors/postgres/connect

connectorRoutes.post("/postgres/connect", requireAuth, async (c) => {
  const { businessId } = c.get("user");
  const body = await c.req.json<{ connectionString: string }>();
  const connectionString = body?.connectionString?.trim();

  if (!connectionString) {
    return c.json({ ok: false, error: "connectionString is required." }, 400);
  }

  // Basic format check
  if (!connectionString.startsWith("postgresql://") && !connectionString.startsWith("postgres://")) {
    return c.json({ ok: false, error: "Invalid connection string. Must start with postgresql:// or postgres://" }, 400);
  }

  // Test the connection
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 8000 });
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    return c.json({ ok: false, error: `Could not connect: ${(err as Error).message}` }, 422);
  } finally {
    await pool.end();
  }

  const db = getDb();

  // Extract a friendly label from the connection string (database name)
  let dbLabel: string | null = null;
  try {
    const url = new URL(connectionString);
    dbLabel = url.pathname.replace("/", "") || url.hostname;
  } catch {
    dbLabel = null;
  }

  // Upsert: one row per (businessId, "postgres")
  const existing = await db
    .select({ id: connectorAccounts.id })
    .from(connectorAccounts)
    .where(and(eq(connectorAccounts.businessId, businessId), eq(connectorAccounts.provider, "postgres")))
    .limit(1);

  if (existing.length > 0) {
    await db.update(connectorAccounts).set({
      accessToken: connectionString,
      accountEmail: dbLabel,
      connectedAt: new Date(),
    }).where(eq(connectorAccounts.id, existing[0].id));
  } else {
    await db.insert(connectorAccounts).values({
      id: newId("con"),
      businessId,
      provider: "postgres",
      accessToken: connectionString,
      refreshToken: null,
      expiresAt: null,
      accountEmail: dbLabel,
      scopes: null,
    });
  }

  return c.json({ ok: true, data: { provider: "postgres", accountEmail: dbLabel } });
});

// ─── Excel: upload (multipart, no OAuth) ─────────────────────────────────────
// POST /api/connectors/excel/upload

connectorRoutes.post("/excel/upload", requireAuth, async (c) => {
  const { businessId } = c.get("user");

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return c.json({ ok: false, error: "No file provided. Send a multipart field named 'file'." }, 400);
  }

  const name = file.name ?? "";
  const ext = name.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
    return c.json({ ok: false, error: "Only .xlsx, .xls, and .csv files are supported." }, 400);
  }

  // Validate it's a real workbook by parsing it
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");

  const uploadDir = join(process.cwd(), "uploads", businessId);
  await mkdir(uploadDir, { recursive: true });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const XLSX = await import("xlsx");
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    if (!wb.SheetNames.length) throw new Error("No sheets found.");
  } catch (err) {
    return c.json({ ok: false, error: `Invalid file: ${(err as Error).message}` }, 422);
  }

  const filePath = join(uploadDir, `excel.${ext}`);
  await writeFile(filePath, buffer);

  const db = getDb();

  const existing = await db
    .select({ id: connectorAccounts.id })
    .from(connectorAccounts)
    .where(and(eq(connectorAccounts.businessId, businessId), eq(connectorAccounts.provider, "excel")))
    .limit(1);

  if (existing.length > 0) {
    await db.update(connectorAccounts).set({
      accessToken: filePath,
      accountEmail: name,
      connectedAt: new Date(),
    }).where(eq(connectorAccounts.id, existing[0].id));
  } else {
    await db.insert(connectorAccounts).values({
      id: newId("con"),
      businessId,
      provider: "excel",
      accessToken: filePath,
      refreshToken: null,
      expiresAt: null,
      accountEmail: name,
      scopes: null,
    });
  }

  return c.json({ ok: true, data: { provider: "excel", accountEmail: name } });
});

// ─── GET /api/connectors/:provider/tools ──────────────────────────────────────
// List all discovered tools for a provider for the authenticated business.

connectorRoutes.get("/:provider/tools", requireAuth, async (c) => {
  const { businessId } = c.get("user");
  const provider = c.req.param("provider");
  const db = getDb();

  const rows = await db
    .select({
      id:           connectorTools.id,
      provider:     connectorTools.provider,
      toolName:     connectorTools.toolName,
      description:  connectorTools.description,
      inputSchema:  connectorTools.inputSchema,
      discoveredAt: connectorTools.discoveredAt,
    })
    .from(connectorTools)
    .where(
      and(
        eq(connectorTools.businessId, businessId),
        eq(connectorTools.provider, provider)
      )
    );

  return c.json({ ok: true, data: rows });
});

// ─── POST /api/connectors/:provider/tools/refresh ─────────────────────────────
// Trigger a fresh tool discovery from the MCP server.

connectorRoutes.post("/:provider/tools/refresh", requireAuth, async (c) => {
  const { businessId } = c.get("user");
  const provider = c.req.param("provider");

  if (!isDiscoverableProvider(provider)) {
    return c.json({ ok: false, error: `Provider "${provider}" does not support tool discovery.` }, 400);
  }

  try {
    const result = await discoverProviderTools(businessId, provider);
    return c.json({ ok: true, data: { discovered: result.count } });
  } catch (err) {
    logger.warn("MCP tool discovery failed", {
      businessId,
      provider,
      errorType: err instanceof Error ? err.name : "UnknownError",
      code: (err as { code?: unknown } | null)?.code,
    });
    return c.json({ ok: false, error: discoveryErrorMessage(err) }, 422);
  }
});
