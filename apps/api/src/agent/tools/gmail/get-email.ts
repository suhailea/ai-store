/**
 * gmail/get-email — fetch a single email by ID.
 *
 * Retrieves the full message, decodes the base64 body, extracts plain text,
 * wraps the body with untrusted content delimiters, and runs a sync injection
 * scan before returning.
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import { wrapUntrusted, scanSync } from "../../guardrails";
import logger from "../../../lib/logger";
import type { NativeTool, ToolContext } from "../types";

/** Decode a base64url-encoded string (Gmail uses base64url, not standard base64). */
function decodeBase64Url(encoded: string): string {
  // Replace URL-safe chars and pad before decoding
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

/** Recursively walk a message part tree and collect plain-text content. */
function extractPlainText(payload: {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: Array<{ mimeType?: string | null; body?: { data?: string | null } | null; parts?: unknown[] }> | null;
}): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts && payload.parts.length > 0) {
    for (const part of payload.parts) {
      const text = extractPlainText(part as Parameters<typeof extractPlainText>[0]);
      if (text) return text;
    }
  }

  return "";
}

const getEmail: NativeTool = {
  provider: "gmail",
  toolName: "get_email",
  readOnly: true,

  schema: {
    name: "get_email",
    description: "Fetch the full content of a single email by its ID. Returns sender, recipient, subject, date, and body text.",
    input_schema: {
      type: "object",
      properties: {
        email_id: {
          type: "string",
          description: "The Gmail message ID (from list_emails)",
        },
      },
      required: ["email_id"],
    },
  },

  async execute(
    args: Record<string, unknown>,
    ctx: ToolContext
  ): Promise<unknown> {
    const emailId = args.email_id as string;

    const { accessToken } = await getConnectorToken(ctx.businessId, "gmail");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    const msg = await gmail.users.messages.get({
      userId: "me",
      id: emailId,
      format: "full",
    });

    const headers = msg.data.payload?.headers ?? [];
    const get = (name: string): string =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    const body = extractPlainText(msg.data.payload ?? {});

    // Injection scan — block before the body reaches the agent
    const scan = scanSync(body);
    if (!scan.clean) {
      logger.warn("Prompt injection detected in email body", {
        businessId: ctx.businessId,
        emailId,
        matches: scan.matches,
      });
      return {
        blocked: true,
        reason: `Email body blocked: potential prompt injection (${scan.matches.join(", ")}).`,
      };
    }

    return {
      id: emailId,
      from: get("From"),
      to: get("To"),
      subject: get("Subject"),
      date: get("Date"),
      body: wrapUntrusted(body),
    };
  },
};

export default getEmail;
