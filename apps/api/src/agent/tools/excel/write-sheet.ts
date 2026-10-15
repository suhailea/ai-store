/**
 * excel/excel_write_sheet — append or update rows in a sheet in the uploaded Excel file.
 *
 * Supports two modes:
 *  - append: adds rows after the last existing row
 *  - update: overwrites a specific row by 1-based row number (1 = header, 2 = first data row)
 */

import * as XLSX from "xlsx";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const writeSheet: NativeTool = {
  provider: "excel",
  toolName: "excel_write_sheet",
  readOnly: false,

  schema: {
    name: "excel_write_sheet",
    description:
      "Append new rows or update existing rows in a sheet of the uploaded Excel file. Use mode 'append' to add rows at the end, or 'update' with row_number to overwrite a specific row (2 = first data row after header). Always use excel_read_sheet first to understand the columns.",
    input_schema: {
      type: "object",
      properties: {
        sheet: {
          type: "string",
          description: "Sheet name to write to. Use excel_list_sheets to get available names.",
        },
        mode: {
          type: "string",
          enum: ["append", "update"],
          description: "'append' adds rows after the last row. 'update' overwrites a specific row.",
        },
        rows: {
          type: "array",
          description: "Array of row objects. Keys must match the sheet's column headers exactly.",
          items: { type: "object" },
        },
        row_number: {
          type: "number",
          description: "Required for mode 'update'. 1-based row number to overwrite (1 = header row, 2 = first data row).",
        },
      },
      required: ["sheet", "mode", "rows"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken: filePath } = await getConnectorToken(ctx.businessId, "excel");

    const sheetName = args.sheet as string;
    const mode = args.mode as "append" | "update";
    const rows = args.rows as Record<string, unknown>[];
    const rowNumber = args.row_number as number | undefined;

    if (!rows || rows.length === 0) throw new Error("rows must be a non-empty array.");
    if (mode === "update" && (!rowNumber || rowNumber < 2)) {
      throw new Error("row_number must be >= 2 for update mode (row 1 is the header).");
    }

    const workbook = XLSX.readFile(filePath);

    if (!workbook.SheetNames.includes(sheetName)) {
      throw new Error(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(", ")}`);
    }

    const worksheet = workbook.Sheets[sheetName];
    const existing = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null });

    let updated: Record<string, unknown>[];

    if (mode === "append") {
      updated = [...existing, ...rows];
    } else {
      // update: row_number is 1-based; row 1 = header, row 2 = existing[0]
      const dataIndex = rowNumber! - 2;
      if (dataIndex < 0 || dataIndex >= existing.length) {
        throw new Error(`row_number ${rowNumber} is out of range. Sheet has ${existing.length} data rows (rows 2–${existing.length + 1}).`);
      }
      updated = [...existing];
      updated[dataIndex] = { ...existing[dataIndex], ...rows[0] };
    }

    // Rebuild the sheet and write back to file
    const newSheet = XLSX.utils.json_to_sheet(updated);
    workbook.Sheets[sheetName] = newSheet;
    XLSX.writeFile(workbook, filePath);

    return {
      ok: true,
      sheet: sheetName,
      mode,
      rowsAffected: rows.length,
      totalRows: updated.length,
    };
  },
};

export default writeSheet;
