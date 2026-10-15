/**
 * google_sheets/sheets_write — write or append rows to a Google Sheets range.
 *
 * Write action — requires owner approval before execution.
 */

import { google } from "googleapis";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

function extractSpreadsheetId(idOrUrl: string): string {
  const match = idOrUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : idOrUrl;
}

const writeRange: NativeTool = {
  provider: "google_sheets",
  toolName: "sheets_write",
  readOnly: false,

  schema: {
    name: "sheets_write",
    description:
      "Write rows of data to a Google Sheets range, or append rows after the last row with data. Requires approval before execution.",
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
            "A1 notation range to write to, e.g. 'Sheet1!A1' or 'Sheet1!A:E'. For append mode, this specifies the sheet name, e.g. 'Sheet1'.",
        },
        rows: {
          type: "array",
          description: "Array of rows to write. Each row is an array of cell values.",
          items: {
            type: "array",
            items: {},
          },
        },
        mode: {
          type: "string",
          enum: ["overwrite", "append"],
          description:
            "'overwrite' writes to the exact range. 'append' adds rows after the last row with data in the sheet. Default: append.",
        },
      },
      required: ["spreadsheet_id", "range", "rows"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken } = await getConnectorToken(ctx.businessId, "google_sheets");

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: "v4", auth: oauth2 });

    const spreadsheetId = extractSpreadsheetId(args.spreadsheet_id as string);
    const range = args.range as string;
    const rows = args.rows as unknown[][];
    const mode = (args.mode as string) ?? "append";

    if (mode === "append") {
      const res = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows },
      });
      return {
        updatedRange: res.data.updates?.updatedRange,
        updatedRows: res.data.updates?.updatedRows,
        mode: "append",
      };
    } else {
      const res = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
      return {
        updatedRange: res.data.updatedRange,
        updatedRows: res.data.updatedRows,
        mode: "overwrite",
      };
    }
  },
};

export default writeRange;
