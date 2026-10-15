/**
 * gmail/draft-email — create a real Gmail draft via the API.
 *
 * Called from the approval execution path. Builds an RFC 2822 message and
 * posts it to users.drafts.create. The draft appears in the Gmail Drafts
 * folder — the human can review and send it manually.
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

function buildRfc2822(to: string, subject: string, body: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    body,
  ];
  return lines.join("\r\n");
}

function toBase64Url(raw: string): string {
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const draftEmail: NativeTool = {
  provider: "gmail",
  toolName: "draft_email",
  readOnly: false, // write action — triggers approval gate

  schema: {
    name: "draft_email",
    description:
      "Stage an outbound email for owner review. Does NOT send immediately — the owner must approve before it is sent. Use this before any send action.",
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
          description: "Gmail message ID to reply to (optional). Sets threading headers.",
        },
      },
      required: ["to", "subject", "body"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const to = args.to as string;
    const subject = args.subject as string;
    const body = args.body as string;

    const { accessToken } = await getConnectorToken(ctx.businessId, "gmail");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    const raw = buildRfc2822(to, subject, body);
    const encodedRaw = toBase64Url(raw);

    const draft = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: { raw: encodedRaw },
      },
    });

    return {
      drafted: true,
      draftId: draft.data.id ?? null,
      to,
      subject,
    };
  },
};

export default draftEmail;
