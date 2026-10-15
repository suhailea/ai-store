/**
 * gcal/get-event — fetch a single calendar event by ID.
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const getEvent: NativeTool = {
  provider: "google_calendar",
  toolName: "get_event",
  readOnly: true,

  schema: {
    name: "get_event",
    description: "Fetch the full details of a single calendar event by its ID.",
    input_schema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "The Google Calendar event ID (from list_events).",
        },
        calendar_id: {
          type: "string",
          description: "Calendar ID the event belongs to. Defaults to 'primary'.",
        },
      },
      required: ["event_id"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const eventId = args.event_id as string;
    const calendarId = typeof args.calendar_id === "string" ? args.calendar_id : "primary";

    const { accessToken } = await getConnectorToken(ctx.businessId, "google_calendar");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    const res = await calendar.events.get({ calendarId, eventId });
    const e = res.data;

    return {
      id: e.id ?? "",
      summary: e.summary ?? "(no title)",
      description: e.description ?? "",
      location: e.location ?? "",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      attendees: (e.attendees ?? []).map((a) => ({
        email: a.email ?? "",
        name: a.displayName ?? "",
        status: a.responseStatus ?? "",
      })),
      organizer: e.organizer?.email ?? "",
      status: e.status ?? "",
      conferenceData: e.conferenceData ?? null,
      htmlLink: e.htmlLink ?? "",
      created: e.created ?? "",
      updated: e.updated ?? "",
    };
  },
};

export default getEvent;
