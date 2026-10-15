/**
 * postgres/pg_describe_table — get column names and types for a table.
 */

import { Pool } from "pg";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const describeTable: NativeTool = {
  provider: "postgres",
  toolName: "pg_describe_table",
  readOnly: true,

  schema: {
    name: "pg_describe_table",
    description:
      "Get the column names, data types, nullability, and default values for a table in the connected PostgreSQL database.",
    input_schema: {
      type: "object",
      properties: {
        table: {
          type: "string",
          description: "Table name to describe, e.g. 'orders' or 'public.orders'.",
        },
      },
      required: ["table"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken: connectionString } = await getConnectorToken(ctx.businessId, "postgres");

    const tableName = args.table as string;
    const parts = tableName.split(".");
    const schema = parts.length > 1 ? parts[0] : "public";
    const table = parts.length > 1 ? parts[1] : parts[0];

    const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
    try {
      const result = await pool.query(
        `SELECT
           column_name,
           data_type,
           is_nullable,
           column_default,
           character_maximum_length
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [schema, table]
      );

      if (result.rows.length === 0) {
        return { error: `Table '${tableName}' not found in schema '${schema}'.` };
      }

      return { table: tableName, columns: result.rows };
    } finally {
      await pool.end();
    }
  },
};

export default describeTable;
