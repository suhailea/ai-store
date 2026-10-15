/**
 * gmail/list-emails — list recent emails from the inbox.
 *
 * Fetches message list via Gmail REST API then resolves basic headers
 * (From, Subject, Date) + snippet for each message.
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const listEmails: NativeTool = {
  provider: "gmail",
  toolName: "list_emails",
  readOnly: true,

  schema: {
    name: "list_emails",
    description: "List recent emails from the Gmail inbox. Returns sender, subject, date, and a short snippet for each message.",
    input_schema: {
      type: "object",
      properties: {
        max_results: {
          type: "number",
          description: "Maximum number of emails to return (default: 20, max: 100)",
        },
        query: {
          type: "string",
          description: "Gmail search query to filter messages, e.g. 'from:alice@example.com is:unread'",
        },
      },
      required: [],
    },
  },

  async execute(
    args: Record<string, unknown>,
    ctx: ToolContext
  ): Promise<unknown> {
    const { accessToken } = await getConnectorToken(ctx.businessId, "gmail");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    const maxResults = typeof args.max_results === "number" ? args.max_results : 20;
    const query = typeof args.query === "string" ? args.query : undefined;

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      ...(query ? { q: query } : {}),
    });

    const messageRefs = listRes.data.messages ?? [];

    if (messageRefs.length === 0) {
      return [];
    }

    // Fetch headers for each message in parallel
    const messages = await Promise.all(
      messageRefs.map(async (ref) => {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: ref.id!,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });

        const headers = msg.data.payload?.headers ?? [];
        const get = (name: string): string =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

        return {
          id: ref.id ?? "",
          from: get("From"),
          subject: get("Subject"),
          date: get("Date"),
          snippet: msg.data.snippet ?? "",
        };
      })
    );

    return messages;
  },
};

export default listEmails;
