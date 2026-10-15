/**
 * Google Sheets native tool registry.
 */

import type { NativeTool } from "../types";
import listSheets from "./list-sheets";
import readRange from "./read-range";
import writeRange from "./write-range";

export const gsheetsTools: NativeTool[] = [
  listSheets,
  readRange,
  writeRange,
];
