import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
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

  const accounts = await db.select({
    id: schema.connectorAccounts.id,
    businessId: schema.connectorAccounts.businessId,
    provider: schema.connectorAccounts.provider,
    hasAccess: schema.connectorAccounts.accessToken,
    hasRefresh: schema.connectorAccounts.refreshToken,
    expiresAt: schema.connectorAccounts.expiresAt,
  }).from(schema.connectorAccounts);

  console.log("Connector accounts:");
  for (const a of accounts) {
    console.log(`  ${a.provider} | biz=${a.businessId} | hasAccess=${!!a.hasAccess} | hasRefresh=${!!a.hasRefresh} | expires=${a.expiresAt}`);
  }

  await client.end();
}

main().catch(console.error);
