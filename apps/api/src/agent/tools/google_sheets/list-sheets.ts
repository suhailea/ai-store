/**
 * google_sheets/sheets_list — list all sheets in a spreadsheet.
 *
 * Returns sheet names, IDs, and grid dimensions.
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

function extractSpreadsheetId(idOrUrl: string): string {
  // Accept either a full URL or a bare spreadsheet ID
  const match = idOrUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : idOrUrl;
}

const listSheets: NativeTool = {
  provider: "google_sheets",
  toolName: "sheets_list",
  readOnly: true,

  schema: {
    name: "sheets_list",
    description:
      "List all sheets (tabs) in a Google Sheets spreadsheet. Returns sheet names, IDs, and row/column counts. Pass the spreadsheet URL or ID.",
    input_schema: {
      type: "object",
      properties: {
        spreadsheet_id: {
          type: "string",
          description: "The Google Sheets spreadsheet ID or full URL.",
        },
      },
      required: ["spreadsheet_id"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken } = await getConnectorToken(ctx.businessId, "google_sheets");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: "v4", auth: oauth2 });

    const spreadsheetId = extractSpreadsheetId(args.spreadsheet_id as string);

    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "spreadsheetId,properties.title,sheets(properties)",
    });

    return {
      spreadsheetId: res.data.spreadsheetId,
      title: res.data.properties?.title,
      sheets: (res.data.sheets ?? []).map((s) => ({
        sheetId: s.properties?.sheetId,
        title: s.properties?.title,
        rowCount: s.properties?.gridProperties?.rowCount,
        columnCount: s.properties?.gridProperties?.columnCount,
      })),
    };
  },
};

export default listSheets;
