/**
 * google_sheets/sheets_read — read cell values from a Google Sheets range.
 *
 * Returns rows as arrays of values using A1 notation or named ranges.
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

function extractSpreadsheetId(idOrUrl: string): string {
  const match = idOrUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : idOrUrl;
}

const readRange: NativeTool = {
  provider: "google_sheets",
  toolName: "sheets_read",
  readOnly: true,

  schema: {
    name: "sheets_read",
    description:
      "Read cell values from a Google Sheets spreadsheet using A1 notation (e.g. 'Sheet1!A1:D10') or a named range. Returns rows as arrays of values.",
    input_schema: {
      type: "object",
      properties: {
        spreadsheet_id: {
          type: "string",
          description: "The Google Sheets spreadsheet ID or full URL.",
        },
        range: {
          type: "string",
          description:
            "A1 notation range, e.g. 'Sheet1!A1:E20' or just 'A1:D10' for the first sheet. Use 'Sheet1' (no range) to read the entire sheet.",
        },
      },
      required: ["spreadsheet_id", "range"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken } = await getConnectorToken(ctx.businessId, "google_sheets");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: "v4", auth: oauth2 });

    const spreadsheetId = extractSpreadsheetId(args.spreadsheet_id as string);
    const range = args.range as string;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "FORMATTED_VALUE",
    });

    const rows = res.data.values ?? [];

    return {
      range: res.data.range,
      rowCount: rows.length,
      rows,
    };
  },
};

export default readRange;
