/**
 * google_drive/drive_create_file — create a new file in Google Drive.
 *
 * Creates a plain text file or Google Doc with the given content.
 * Write action — requires owner approval before execution.
 */

import { google } from "googleapis";
import { Readable } from "node:stream";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const createFile: NativeTool = {
  provider: "google_drive",
  toolName: "drive_create_file",
  readOnly: false,

  schema: {
    name: "drive_create_file",
    description:
      "Create a new text file in Google Drive with the given name and content. Optionally place it in a specific folder. Requires approval before execution.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "File name including extension, e.g. 'weekly-report-2026-W41.txt'",
        },
        content: {
          type: "string",
          description: "Plain text content of the file.",
        },
        folder_id: {
          type: "string",
          description: "ID of the parent folder. Omit to create in 'My Drive' root.",
        },
      },
      required: ["name", "content"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken } = await getConnectorToken(ctx.businessId, "google_drive");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2 });

    const name = args.name as string;
    const content = typeof args.content === "string" ? args.content : "";
    const folderId = typeof args.folder_id === "string" ? args.folder_id : undefined;

    const res = await drive.files.create({
      requestBody: {
        name,
        mimeType: "text/plain",
        ...(folderId ? { parents: [folderId] } : {}),
      },
      media: {
        mimeType: "text/plain",
        body: Readable.from([content]),
      },
      fields: "id,name,webViewLink",
    });

    return {
      id: res.data.id,
      name: res.data.name,
      webViewLink: res.data.webViewLink,
    };
  },
};

export default createFile;
