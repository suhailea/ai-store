import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
let _db = null;
export function getDb() {
    if (!_db) {
        const url = process.env.DATABASE_URL;
        if (!url)
            throw new Error("DATABASE_URL is not set");
        const client = postgres(url, { max: 10 });
        _db = drizzle(client, { schema });
    }
    return _db;
}
