/**
 * gcal/list-events — list upcoming calendar events.
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const listEvents: NativeTool = {
  provider: "google_calendar",
  toolName: "list_events",
  readOnly: true,

  schema: {
    name: "list_events",
    description: "List calendar events within a time range. Defaults to the next 7 days if no range is specified.",
    input_schema: {
      type: "object",
      properties: {
        time_min: {
          type: "string",
          description: "Start of the range as an ISO 8601 datetime (e.g. '2025-01-01T00:00:00Z'). Defaults to now.",
        },
        time_max: {
          type: "string",
          description: "End of the range as an ISO 8601 datetime. Defaults to 7 days from now.",
        },
        max_results: {
          type: "number",
          description: "Maximum number of events to return (default: 20, max: 100).",
        },
        calendar_id: {
          type: "string",
          description: "Calendar ID to query. Defaults to 'primary'.",
        },
        query: {
          type: "string",
          description: "Free-text search query to filter events by title or description.",
        },
      },
      required: [],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken } = await getConnectorToken(ctx.businessId, "google_calendar");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    const now = new Date();
    const defaultMax = new Date(now);
    defaultMax.setDate(defaultMax.getDate() + 7);

    const timeMin = typeof args.time_min === "string" ? args.time_min : now.toISOString();
    const timeMax = typeof args.time_max === "string" ? args.time_max : defaultMax.toISOString();
    const maxResults = typeof args.max_results === "number" ? Math.min(args.max_results, 100) : 20;
    const calendarId = typeof args.calendar_id === "string" ? args.calendar_id : "primary";
    const query = typeof args.query === "string" ? args.query : undefined;

    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
      ...(query ? { q: query } : {}),
    });

    const events = res.data.items ?? [];
    return events.map((e) => ({
      id: e.id ?? "",
      summary: e.summary ?? "(no title)",
      description: e.description ?? "",
      location: e.location ?? "",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      attendees: (e.attendees ?? []).map((a) => ({ email: a.email ?? "", name: a.displayName ?? "", status: a.responseStatus ?? "" })),
      organizer: e.organizer?.email ?? "",
      status: e.status ?? "",
      htmlLink: e.htmlLink ?? "",
    }));
  },
};

export default listEvents;
