/**
 * google_drive/list_files — list files in Google Drive.
 *
 * Returns file names, IDs, MIME types, and modification times.
 * Supports filtering by folder or search query.
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const listFiles: NativeTool = {
  provider: "google_drive",
  toolName: "drive_list_files",
  readOnly: true,

  schema: {
    name: "drive_list_files",
    description:
      "List files and folders in Google Drive. Optionally filter by a parent folder ID or search query. Returns file name, ID, MIME type, and last modified time.",
    input_schema: {
      type: "object",
      properties: {
        folder_id: {
          type: "string",
          description:
            "ID of the folder to list files in. Omit to list from the root 'My Drive'.",
        },
        query: {
          type: "string",
          description:
            "Drive search query, e.g. 'name contains \"report\"' or 'mimeType=\"application/vnd.google-apps.spreadsheet\"'.",
        },
        max_results: {
          type: "number",
          description: "Maximum number of files to return (default: 30, max: 100).",
        },
      },
      required: [],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken } = await getConnectorToken(ctx.businessId, "google_drive");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2 });

    const maxResults = typeof args.max_results === "number" ? Math.min(args.max_results, 100) : 30;
    const folderId = typeof args.folder_id === "string" ? args.folder_id : null;
    const query = typeof args.query === "string" ? args.query : null;

    const qParts: string[] = ["trashed = false"];
    if (folderId) qParts.push(`'${folderId}' in parents`);
    if (query) qParts.push(query);

    const res = await drive.files.list({
      q: qParts.join(" and "),
      pageSize: maxResults,
      fields: "files(id,name,mimeType,modifiedTime,size,parents)",
      orderBy: "modifiedTime desc",
    });

    return (res.data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      size: f.size ?? null,
    }));
  },
};

export default listFiles;
