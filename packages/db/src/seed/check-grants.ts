import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../schema";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });

  const emps = await db.select({ id: schema.employees.id, name: schema.employees.displayName, isManager: schema.employees.isManager })
    .from(schema.employees)
    .where(eq(schema.employees.businessId, "biz_suhailea"));

  for (const emp of emps) {
    const grants = await db.select().from(schema.employeeToolGrants).where(eq(schema.employeeToolGrants.employeeId, emp.id));
    const tag = emp.isManager ? " [MANAGER]" : "";
    console.log(`${emp.name}${tag}: ${grants.length ? grants.map(g => `${g.provider}/${g.toolName}`).join(", ") : "NO GRANTS"}`);
  }

  await client.end();
}

main().catch(console.error);
