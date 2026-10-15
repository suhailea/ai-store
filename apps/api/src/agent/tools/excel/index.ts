/**
 * Excel native tool registry.
 */

import type { NativeTool } from "../types";
import listSheets from "./list-sheets";
import readSheet from "./read-sheet";
import writeSheet from "./write-sheet";

export const excelTools: NativeTool[] = [
  listSheets,
  readSheet,
  writeSheet,
];
