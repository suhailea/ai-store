/**
 * PostgreSQL native tool registry.
 */

import type { NativeTool } from "../types";
import query from "./query";
import listTables from "./list-tables";
import describeTable from "./describe-table";
import insert from "./insert";
import update from "./update";

export const postgresTools: NativeTool[] = [
  query,
  listTables,
  describeTable,
  insert,
  update,
];
