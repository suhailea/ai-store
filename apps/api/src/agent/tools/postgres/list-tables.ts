/**
 * postgres/pg_list_tables — list all tables in a schema.
 */

import { Pool } from "pg";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const listTables: NativeTool = {
  provider: "postgres",
  toolName: "pg_list_tables",
  readOnly: true,

  schema: {
    name: "pg_list_tables",
    description:
      "List all tables (and views) in the connected PostgreSQL database. Returns table names, schema, type, and estimated row count.",
    input_schema: {
      type: "object",
      properties: {
        schema: {
          type: "string",
          description: "Schema to list tables from. Defaults to 'public'.",
        },
      },
      required: [],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken: connectionString } = await getConnectorToken(ctx.businessId, "postgres");

    const schema = typeof args.schema === "string" ? args.schema : "public";

    const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
    try {
      const result = await pool.query(
        `SELECT
           t.table_schema,
           t.table_name,
           t.table_type,
           COALESCE(s.n_live_tup, 0) AS estimated_rows
         FROM information_schema.tables t
         LEFT JOIN pg_stat_user_tables s
           ON s.schemaname = t.table_schema AND s.relname = t.table_name
         WHERE t.table_schema = $1
         ORDER BY t.table_name`,
        [schema]
      );
      return result.rows;
    } finally {
      await pool.end();
    }
  },
};

export default listTables;
