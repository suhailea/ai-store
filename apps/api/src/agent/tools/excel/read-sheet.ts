/**
 * excel/excel_read_sheet — read rows from a sheet in the uploaded Excel file.
 *
 * Returns data as an array of objects (first row = headers).
 * Optionally limit the number of rows returned.
 */

import * as XLSX from "xlsx";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const readSheet: NativeTool = {
  provider: "excel",
  toolName: "excel_read_sheet",
  readOnly: true,

  schema: {
    name: "excel_read_sheet",
    description:
      "Read rows from a sheet in the uploaded Excel file. Returns an array of row objects keyed by column header. Use excel_list_sheets first to get available sheet names.",
    input_schema: {
      type: "object",
      properties: {
        sheet: {
          type: "string",
          description: "Sheet name to read. If omitted, reads the first sheet.",
        },
        limit: {
          type: "number",
          description: "Maximum number of rows to return (default 200, max 1000).",
        },
      },
      required: [],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken: filePath } = await getConnectorToken(ctx.businessId, "excel");

    const workbook = XLSX.readFile(filePath);

    const sheetName = (args.sheet as string | undefined) ?? workbook.SheetNames[0];
    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error(
        `Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(", ")}`
      );
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null });

    const limit = Math.min(Number(args.limit ?? 200), 1000);
    const sliced = rows.slice(0, limit);

    return {
      sheet: sheetName,
      totalRows: rows.length,
      returnedRows: sliced.length,
      rows: sliced,
    };
  },
};

export default readSheet;
