/**
 * google_drive/drive_get_file — get metadata and text content of a Drive file.
 *
 * For Google Docs, Sheets, Slides: exports as plain text.
 * For plain text / markdown / CSV files: downloads content directly.
 * For binary files (images, PDFs): returns metadata only.
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const EXPORTABLE_MIME: Record<string, string> = {
  "application/vnd.google-apps.document":     "text/plain",
  "application/vnd.google-apps.spreadsheet":  "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

const TEXT_MIME_PREFIX = ["text/", "application/json", "application/csv"];

const getFile: NativeTool = {
  provider: "google_drive",
  toolName: "drive_get_file",
  readOnly: true,

  schema: {
    name: "drive_get_file",
    description:
      "Get the metadata and text content of a Google Drive file by its ID. Returns name, MIME type, and content (plain text for Docs/Sheets/Slides, raw text for text files). Binary files return metadata only.",
    input_schema: {
      type: "object",
      properties: {
        file_id: {
          type: "string",
          description: "The Google Drive file ID.",
        },
      },
      required: ["file_id"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken } = await getConnectorToken(ctx.businessId, "google_drive");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2 });

    const fileId = args.file_id as string;

    // Get metadata
    const meta = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,modifiedTime,size",
    });

    const mimeType = meta.data.mimeType ?? "";
    const result: Record<string, unknown> = {
      id: meta.data.id,
      name: meta.data.name,
      mimeType,
      modifiedTime: meta.data.modifiedTime,
    };

    // Try to get text content
    const exportMime = EXPORTABLE_MIME[mimeType];
    const isTextFile = TEXT_MIME_PREFIX.some((prefix) => mimeType.startsWith(prefix));

    if (exportMime) {
      // Google Workspace file — export as text
      const exported = await drive.files.export(
        { fileId, mimeType: exportMime },
        { responseType: "text" }
      );
      result.content = (exported.data as string).slice(0, 50000); // cap at 50k chars
    } else if (isTextFile) {
      // Plain text file — download directly
      const downloaded = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "text" }
      );
      result.content = (downloaded.data as string).slice(0, 50000);
    } else {
      result.content = null;
      result.note = "Binary file — content not available as text.";
    }

    return result;
  },
};

export default getFile;
