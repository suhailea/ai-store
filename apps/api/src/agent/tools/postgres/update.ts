/**
 * postgres/pg_update — update rows matching a WHERE condition.
 *
 * Write action — requires owner approval before execution.
 * Uses parameterized values to prevent injection.
 */

import { Pool } from "pg";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const update: NativeTool = {
  provider: "postgres",
  toolName: "pg_update",
  readOnly: false,

  schema: {
    name: "pg_update",
    description:
      "Update rows in a PostgreSQL table. Provide the column values to set and a WHERE condition as a parameterized object. Requires approval before execution.",
    input_schema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Target table name, e.g. 'orders'.",
        },
        set: {
          type: "object",
          description: "Columns to update and their new values, e.g. { status: 'shipped', updated_at: 'now()' }",
        },
        where: {
          type: "object",
          description: "Filter columns and their exact match values, e.g. { id: 123 }. At least one filter is required.",
        },
      },
      required: ["table", "set", "where"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken: connectionString } = await getConnectorToken(ctx.businessId, "postgres");

    const table = args.table as string;
    const setValues = args.set as Record<string, unknown>;
    const whereValues = args.where as Record<string, unknown>;

    const setCols = Object.keys(setValues);
    const whereCols = Object.keys(whereValues);

    if (setCols.length === 0) throw new Error("No SET values provided.");
    if (whereCols.length === 0) throw new Error("WHERE condition is required for updates.");

    const params: unknown[] = [];

    const setClause = setCols.map((col) => {
      params.push(setValues[col]);
      return `${col} = $${params.length}`;
    }).join(", ");

    const whereClause = whereCols.map((col) => {
      params.push(whereValues[col]);
      return `${col} = $${params.length}`;
    }).join(" AND ");

    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`;

    const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
    try {
      const result = await pool.query(sql, params);
      return { updatedCount: result.rowCount, rows: result.rows };
    } finally {
      await pool.end();
    }
  },
};

export default update;
