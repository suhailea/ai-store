/**
 * postgres/pg_query — run a read-only SELECT query.
 *
 * Only SELECT statements are allowed. The query string is sent as-is to
 * the database — results are returned as untrusted data (same as all tool
 * results in this platform).
 */

import { Pool } from "pg";
import { getConnectorToken } from "../../mcp/auth";
import type { NativeTool, ToolContext } from "../types";

const query: NativeTool = {
  provider: "postgres",
  toolName: "pg_query",
  readOnly: true,

  schema: {
    name: "pg_query",
    description:
      "Run a read-only SELECT query against the connected PostgreSQL database. Returns rows as an array of objects. Only SELECT statements are permitted.",
    input_schema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "A SELECT SQL query to execute, e.g. 'SELECT * FROM orders WHERE status = $1'",
        },
        params: {
          type: "array",
          description: "Optional parameterized query values corresponding to $1, $2, ... placeholders.",
          items: {},
        },
      },
      required: ["sql"],
    },
  },

  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const { accessToken: connectionString } = await getConnectorToken(ctx.businessId, "postgres");

    const sql = args.sql as string;
    const params = Array.isArray(args.params) ? args.params : [];

    // Enforce SELECT-only
    const normalized = sql.trim().replace(/\s+/g, " ").toUpperCase();
    if (!normalized.startsWith("SELECT") && !normalized.startsWith("WITH")) {
      throw new Error("Only SELECT queries are allowed via pg_query. Use pg_insert or pg_update for writes.");
    }

    const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
    try {
      const result = await pool.query(sql, params as unknown[]);
      return {
        rowCount: result.rowCount,
        rows: result.rows,
        fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
      };
    } finally {
      await pool.end();
    }
  },
};

export default query;
