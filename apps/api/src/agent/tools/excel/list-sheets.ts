/**
 * excel/excel_list_sheets — list all sheet names in the uploaded Excel file.
 */

import * as XLSX from "xlsx";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const listSheets: NativeTool = {
  provider: "excel",
  toolName: "excel_list_sheets",
  readOnly: true,

  schema: {
    name: "excel_list_sheets",
    description: "List all sheet names in the uploaded Excel file connected to this business.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  async execute(_args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken: filePath } = await getConnectorToken(ctx.businessId, "excel");

    const workbook = XLSX.readFile(filePath);
    return { sheets: workbook.SheetNames };
  },
};

export default listSheets;
