import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { businessMemories, getDb } from "@staffroom/db";
import { requireAuth } from "../middleware/auth";
import { requireOwner } from "../middleware/owner";
import { memoryContentSchema } from "../agent/memory";
import { newId } from "../lib/id";
import type { AppEnv } from "../lib/types";

export const businessMemoryRoutes = new Hono<AppEnv>();
businessMemoryRoutes.use("*", requireAuth);
const bodySchema = z.object({ kind: z.enum(["policy", "brand_voice", "company_fact", "sop"]), content: memoryContentSchema });

businessMemoryRoutes.get("/", async c => {
  const rows = await getDb().select().from(businessMemories)
    .where(eq(businessMemories.businessId, c.get("user").businessId)).orderBy(desc(businessMemories.createdAt));
  return c.json({ ok: true, data: rows });
});
businessMemoryRoutes.post("/", requireOwner, zValidator("json", bodySchema), async c => {
  const [saved] = await getDb().insert(businessMemories).values({
    id: newId("bmem"), businessId: c.get("user").businessId, source: "owner", ...c.req.valid("json"),
  }).returning();
  return c.json({ ok: true, data: saved }, 201);
});
businessMemoryRoutes.patch("/:id", requireOwner, zValidator("json", bodySchema.partial().refine(b => Object.keys(b).length > 0)), async c => {
  const body = c.req.valid("json");
  const [saved] = await getDb().update(businessMemories).set({
    ...(body.kind !== undefined ? { kind: body.kind } : {}),
    ...(body.content !== undefined ? { content: body.content } : {}),
  })
    .where(and(eq(businessMemories.id, c.req.param("id")), eq(businessMemories.businessId, c.get("user").businessId))).returning();
  return saved ? c.json({ ok: true, data: saved }) : c.json({ ok: false, error: "Memory not found" }, 404);
});
businessMemoryRoutes.delete("/:id", requireOwner, async c => {
  const [deleted] = await getDb().delete(businessMemories)
    .where(and(eq(businessMemories.id, c.req.param("id")), eq(businessMemories.businessId, c.get("user").businessId))).returning({ id: businessMemories.id });
  return deleted ? c.json({ ok: true, data: null }) : c.json({ ok: false, error: "Memory not found" }, 404);
});
