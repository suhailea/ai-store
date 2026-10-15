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

  const rows = await db.select({
    provider: schema.connectorTools.provider,
    toolName: schema.connectorTools.toolName,
  }).from(schema.connectorTools)
    .where(eq(schema.connectorTools.businessId, "biz_suhailea"))
    .orderBy(schema.connectorTools.provider, schema.connectorTools.toolName);

  if (rows.length === 0) {
    console.log("No connector tools found in DB for biz_suhailea");
  } else {
    for (const r of rows) console.log(`${r.provider}/${r.toolName}`);
  }

  await client.end();
}

main().catch(console.error);
