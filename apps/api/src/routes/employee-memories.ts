import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { employees, memories, getDb } from "@staffroom/db";
import { requireAuth } from "../middleware/auth";
import { requireOwner } from "../middleware/owner";
import { memoryContentSchema } from "../agent/memory";
import { newId } from "../lib/id";
import type { AppEnv } from "../lib/types";

export const employeeMemoryRoutes = new Hono<AppEnv>();
employeeMemoryRoutes.use("*", requireAuth, requireOwner);
const targetInBusiness = createMiddleware<AppEnv>(async (c, next) => {
  const [target] = await getDb().select({ id: employees.id }).from(employees).where(and(
    eq(employees.id, c.req.param("employeeId")!), eq(employees.businessId, c.get("user").businessId)
  )).limit(1);
  if (!target) return c.json({ ok: false, error: "Employee not found" }, 404);
  await next();
});
const bodySchema = z.object({ kind: z.enum(["instruction", "preference", "correction", "episodic", "learned"]), content: memoryContentSchema });

employeeMemoryRoutes.post("/:employeeId/memories", targetInBusiness, zValidator("json", bodySchema), async c => {
  const [saved] = await getDb().insert(memories).values({
    id: newId("mem"), employeeId: c.req.param("employeeId"), source: "onboarding", ...c.req.valid("json"),
  }).returning();
  return c.json({ ok: true, data: saved }, 201);
});
employeeMemoryRoutes.patch("/:employeeId/memories/:memoryId", targetInBusiness,
  zValidator("json", bodySchema.partial().refine(b => Object.keys(b).length > 0)), async c => {
    const body = c.req.valid("json");
    const [saved] = await getDb().update(memories).set({
      ...(body.kind !== undefined ? { kind: body.kind } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}), source: "onboarding",
    })
      .where(and(eq(memories.id, c.req.param("memoryId")), eq(memories.employeeId, c.req.param("employeeId")))).returning();
    return saved ? c.json({ ok: true, data: saved }) : c.json({ ok: false, error: "Memory not found" }, 404);
  });
employeeMemoryRoutes.delete("/:employeeId/memories/:memoryId", targetInBusiness, async c => {
  const [deleted] = await getDb().delete(memories)
    .where(and(eq(memories.id, c.req.param("memoryId")), eq(memories.employeeId, c.req.param("employeeId")))).returning({ id: memories.id });
  return deleted ? c.json({ ok: true, data: null }) : c.json({ ok: false, error: "Memory not found" }, 404);
});
