/**
 * Google Calendar native tool registry.
 */

import type { NativeTool } from "../types";
import listEvents from "./list-events";
import getEvent from "./get-event";
import createEvent from "./create-event";
import updateEvent from "./update-event";
import deleteEvent from "./delete-event";

export const gcalTools: NativeTool[] = [
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
];
