/**
 * gcal/create-event — create a new calendar event (requires approval).
 *
 * readOnly: false — the agent must call create_approval_request first.
 * Actual creation happens only after the owner approves.
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const createEvent: NativeTool = {
  provider: "google_calendar",
  toolName: "create_event",
  readOnly: false,

  schema: {
    name: "create_event",
    description:
      "Create a new event on Google Calendar. Requires owner approval before the event is created. Include all guests, times, and a clear title.",
    input_schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Event title.",
        },
        description: {
          type: "string",
          description: "Event description or agenda (optional).",
        },
        location: {
          type: "string",
          description: "Physical or virtual location (optional).",
        },
        start_time: {
          type: "string",
          description: "Start datetime as ISO 8601 (e.g. '2025-06-15T10:00:00-07:00').",
        },
        end_time: {
          type: "string",
          description: "End datetime as ISO 8601.",
        },
        attendee_emails: {
          type: "array",
          items: { type: "string" },
          description: "List of attendee email addresses (optional).",
        },
        calendar_id: {
          type: "string",
          description: "Calendar ID to create the event in. Defaults to 'primary'.",
        },
        send_updates: {
          type: "string",
          enum: ["all", "externalOnly", "none"],
          description: "Whether to send email invites to attendees. Defaults to 'all'.",
        },
      },
      required: ["summary", "start_time", "end_time"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken } = await getConnectorToken(ctx.businessId, "google_calendar");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    const calendarId = typeof args.calendar_id === "string" ? args.calendar_id : "primary";
    const sendUpdates = (args.send_updates as "all" | "externalOnly" | "none" | undefined) ?? "all";
    const attendeeEmails = Array.isArray(args.attendee_emails) ? (args.attendee_emails as string[]) : [];

    const res = await calendar.events.insert({
      calendarId,
      sendUpdates,
      requestBody: {
        summary: args.summary as string,
        description: typeof args.description === "string" ? args.description : null,
        location: typeof args.location === "string" ? args.location : null,
        start: { dateTime: args.start_time as string },
        end: { dateTime: args.end_time as string },
        attendees: attendeeEmails.map((email) => ({ email })),
      },
    });

    const event = (res as { data: { id?: string | null; htmlLink?: string | null; summary?: string | null; start?: { dateTime?: string | null; date?: string | null }; end?: { dateTime?: string | null; date?: string | null } } }).data;
    return {
      created: true,
      id: event.id ?? null,
      htmlLink: event.htmlLink ?? null,
      summary: event.summary ?? null,
      start: event.start?.dateTime ?? event.start?.date ?? null,
      end: event.end?.dateTime ?? event.end?.date ?? null,
    };
  },
};

export default createEvent;
