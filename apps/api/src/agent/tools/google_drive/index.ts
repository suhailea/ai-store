/**
 * Google Drive native tool registry.
 */

import type { NativeTool } from "../types";
import listFiles from "./list-files";
import getFile from "./get-file";
import createFile from "./create-file";
import updateFile from "./update-file";

export const gdriveTools: NativeTool[] = [
  listFiles,
  getFile,
  createFile,
  updateFile,
];
