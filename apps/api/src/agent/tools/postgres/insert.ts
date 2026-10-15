/**
 * postgres/pg_insert — insert a row into a table.
 *
 * Write action — requires owner approval before execution.
 * Uses parameterized values to prevent injection.
 */

import { Pool } from "pg";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const insert: NativeTool = {
  provider: "postgres",
  toolName: "pg_insert",
  readOnly: false,

  schema: {
    name: "pg_insert",
    description:
      "Insert a single row into a PostgreSQL table. Pass column names and their values as a flat object. Requires approval before execution.",
    input_schema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Target table name, e.g. 'orders' or 'public.orders'.",
        },
        values: {
          type: "object",
          description: "Object mapping column names to values, e.g. { customer_id: 42, status: 'pending' }",
        },
      },
      required: ["table", "values"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken: connectionString } = await getConnectorToken(ctx.businessId, "postgres");

    const table = args.table as string;
    const values = args.values as Record<string, unknown>;

    const columns = Object.keys(values);
    if (columns.length === 0) throw new Error("No values provided for insert.");

    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`;

    const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
    try {
      const result = await pool.query(sql, Object.values(values));
      return { inserted: result.rows[0] ?? null };
    } finally {
      await pool.end();
    }
  },
};

export default insert;
