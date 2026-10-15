/**
 * gcal/update-event — patch an existing calendar event (requires approval).
 *
 * Uses PATCH semantics — only supplied fields are updated.
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const updateEvent: NativeTool = {
  provider: "google_calendar",
  toolName: "update_event",
  readOnly: false,

  schema: {
    name: "update_event",
    description:
      "Update an existing calendar event. Only the fields you provide are changed. Requires owner approval.",
    input_schema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "The Google Calendar event ID to update.",
        },
        calendar_id: {
          type: "string",
          description: "Calendar ID the event belongs to. Defaults to 'primary'.",
        },
        summary: {
          type: "string",
          description: "New event title (optional).",
        },
        description: {
          type: "string",
          description: "New event description (optional).",
        },
        location: {
          type: "string",
          description: "New location (optional).",
        },
        start_time: {
          type: "string",
          description: "New start datetime as ISO 8601 (optional).",
        },
        end_time: {
          type: "string",
          description: "New end datetime as ISO 8601 (optional).",
        },
        attendee_emails: {
          type: "array",
          items: { type: "string" },
          description: "Replacement attendee list — replaces all existing attendees if provided.",
        },
        send_updates: {
          type: "string",
          enum: ["all", "externalOnly", "none"],
          description: "Whether to notify attendees of changes. Defaults to 'all'.",
        },
      },
      required: ["event_id"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const eventId = args.event_id as string;
    const calendarId = typeof args.calendar_id === "string" ? args.calendar_id : "primary";
    const sendUpdates = (args.send_updates as "all" | "externalOnly" | "none" | undefined) ?? "all";

    const { accessToken } = await getConnectorToken(ctx.businessId, "google_calendar");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    // Build a partial patch body — only include fields the caller supplied
    const patch: Record<string, unknown> = {};
    if (typeof args.summary === "string") patch.summary = args.summary;
    if (typeof args.description === "string") patch.description = args.description;
    if (typeof args.location === "string") patch.location = args.location;
    if (typeof args.start_time === "string") patch.start = { dateTime: args.start_time };
    if (typeof args.end_time === "string") patch.end = { dateTime: args.end_time };
    if (Array.isArray(args.attendee_emails)) {
      patch.attendees = (args.attendee_emails as string[]).map((email) => ({ email }));
    }

    const res = await calendar.events.patch({
      calendarId,
      eventId,
      sendUpdates,
      requestBody: patch,
    });

    return {
      updated: true,
      id: res.data.id ?? null,
      htmlLink: res.data.htmlLink ?? null,
      summary: res.data.summary ?? null,
      start: res.data.start?.dateTime ?? res.data.start?.date ?? null,
      end: res.data.end?.dateTime ?? res.data.end?.date ?? null,
    };
  },
};

export default updateEvent;
