/**
 * google_drive/drive_update_file — update the content of an existing Drive file.
 *
 * Overwrites or appends to a plain text file.
 * Write action — requires owner approval before execution.
 */

import { google } from "googleapis";
import { Readable } from "node:stream";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const updateFile: NativeTool = {
  provider: "google_drive",
  toolName: "drive_update_file",
  readOnly: false,

  schema: {
    name: "drive_update_file",
    description:
      "Update the content of an existing plain text file in Google Drive. Can overwrite the entire file or append new content to the end. Requires approval before execution.",
    input_schema: {
      type: "object",
      properties: {
        file_id: {
          type: "string",
          description: "The Google Drive file ID to update.",
        },
        content: {
          type: "string",
          description: "New content to write.",
        },
        mode: {
          type: "string",
          enum: ["overwrite", "append"],
          description: "'overwrite' replaces the entire file. 'append' adds content to the end. Default: overwrite.",
        },
      },
      required: ["file_id", "content"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken } = await getConnectorToken(ctx.businessId, "google_drive");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2 });

    const fileId = args.file_id as string;
    const newContent = args.content as string;
    const mode = (args.mode as string) ?? "overwrite";

    let finalContent = newContent;

    if (mode === "append") {
      // Fetch existing content first
      try {
        const existing = await drive.files.get(
          { fileId, alt: "media" },
          { responseType: "text" }
        );
        finalContent = (existing.data as string) + "\n" + newContent;
      } catch {
        // If fetch fails, just overwrite
        finalContent = newContent;
      }
    }

    await drive.files.update({
      fileId,
      media: {
        mimeType: "text/plain",
        body: Readable.from([finalContent]),
      },
      fields: "id,name,modifiedTime",
    });

    return { id: fileId, updated: true, mode };
  },
};

export default updateFile;
