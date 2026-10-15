import { createMiddleware } from "hono/factory";
import { and, eq } from "drizzle-orm";
import { getDb, humanUsers } from "@staffroom/db";
import type { AppEnv } from "../lib/types";

// Use the current database role, rather than trusting an old JWT role claim.
export const requireOwner = createMiddleware<AppEnv>(async (c, next) => {
  const { userId, businessId } = c.get("user");
  const [owner] = await getDb().select({ id: humanUsers.id }).from(humanUsers).where(and(
    eq(humanUsers.id, userId), eq(humanUsers.businessId, businessId), eq(humanUsers.role, "owner")
  )).limit(1);
  if (!owner) return c.json({ ok: false, error: "Only the business owner can manage these memories." }, 403);
  await next();
});
