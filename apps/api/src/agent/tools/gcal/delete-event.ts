/**
 * gcal/delete-event — delete a calendar event (requires approval).
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const deleteEvent: NativeTool = {
  provider: "google_calendar",
  toolName: "delete_event",
  readOnly: false,

  schema: {
    name: "delete_event",
    description:
      "Permanently delete a calendar event. Requires owner approval. Optionally notify attendees.",
    input_schema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "The Google Calendar event ID to delete.",
        },
        calendar_id: {
          type: "string",
          description: "Calendar ID the event belongs to. Defaults to 'primary'.",
        },
        send_updates: {
          type: "string",
          enum: ["all", "externalOnly", "none"],
          description: "Whether to notify attendees of the cancellation. Defaults to 'all'.",
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

    await calendar.events.delete({ calendarId, eventId, sendUpdates });

    return { deleted: true, event_id: eventId };
  },
};

export default deleteEvent;
