/**
 * gmail/send-email — execute an approved email send via the Gmail REST API.
 *
 * Called from the approval execution path only — never directly by the agent.
 * Builds an RFC 2822 message, base64url-encodes it, and posts it to
 * users.messages.send. Handles reply threading when reply_to_id is provided.
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

interface Rfc2822Opts {
  to: string;
  subject: string;
  body: string;
  inReplyTo: string | undefined;
  references: string | undefined;
}

/** Build a minimal RFC 2822 message string. */
function buildRfc2822(opts: Rfc2822Opts): string {
  const lines: string[] = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
  ];

  if (opts.inReplyTo) {
    lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  }
  if (opts.references) {
    lines.push(`References: ${opts.references}`);
  }

  lines.push("", opts.body);

  return lines.join("\r\n");
}

/** base64url-encode (Gmail API requires base64url, not standard base64). */
function toBase64Url(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const sendEmail: NativeTool = {
  provider: "gmail",
  toolName: "send_email",
  readOnly: false, // approval already granted before this is called

  schema: {
    name: "send_email",
    description:
      "Send an email via Gmail. Approval must have been granted before calling this. Supports reply threading via reply_to_id.",
    input_schema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient email address",
        },
        subject: {
          type: "string",
          description: "Email subject line",
        },
        body: {
          type: "string",
          description: "Email body (plain text)",
        },
        reply_to_id: {
          type: "string",
          description: "Gmail message ID to reply to (optional). Adds In-Reply-To and References headers.",
        },
      },
      required: ["to", "subject", "body"],
    },
  },

  async execute(
    args: Record<string, unknown>,
    ctx: ToolContext
  ): Promise<unknown> {
    const to = args.to as string;
    const subject = args.subject as string;
    const body = args.body as string;
    const replyToId = args.reply_to_id as string | undefined;

    const { accessToken } = await getConnectorToken(ctx.businessId, "gmail");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    let inReplyTo: string | undefined;
    let references: string | undefined;
    let threadId: string | undefined;

    // Resolve threading headers from the original message
    if (replyToId) {
      const original = await gmail.users.messages.get({
        userId: "me",
        id: replyToId,
        format: "metadata",
        metadataHeaders: ["Message-ID", "References"],
      });

      const headers = original.data.payload?.headers ?? [];
      const get = (name: string): string =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const messageId = get("Message-ID");
      const existingRefs = get("References");

      inReplyTo = messageId || undefined;
      references = existingRefs
        ? `${existingRefs} ${messageId}`.trim()
        : messageId || undefined;

      threadId = original.data.threadId ?? undefined;
    }

    const raw = buildRfc2822({ to, subject, body, inReplyTo, references });
    const encodedRaw = toBase64Url(raw);

    const sent = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedRaw,
        ...(threadId ? { threadId } : {}),
      },
    });

    return {
      sent: true,
      id: sent.data.id ?? null,
      threadId: sent.data.threadId ?? null,
    };
  },
};

export default sendEmail;
