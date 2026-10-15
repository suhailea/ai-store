/**
 * Gmail native tool registry — aggregates all Gmail tools into a single array.
 */

import type { NativeTool } from "../types";
import listEmails from "./list-emails";
import getEmail from "./get-email";
import draftEmail from "./draft-email";
import sendEmail from "./send-email";

export const gmailTools: NativeTool[] = [
  listEmails,
  getEmail,
  draftEmail,
  sendEmail,
];
