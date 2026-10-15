import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getDb, teamMemories, tasks } from "@staffroom/db";
import { requireAuth } from "../middleware/auth";
import { requireOwner } from "../middleware/owner";
import { memoryContentSchema } from "../agent/memory";
import { newId } from "../lib/id";
import type { AppEnv } from "../lib/types";

export const teamMemoryRoutes = new Hono<AppEnv>();
teamMemoryRoutes.use("*", requireAuth);
const bodySchema = z.object({ kind: z.enum(["briefing", "delegation_note", "outcome_summary"]),
  content: memoryContentSchema, taskId: z.string().min(1).nullable().default(null) });
const validNote = (body: { kind: string; taskId: string | null }) => body.kind !== "delegation_note" || body.taskId !== null;
async function validTask(businessId: string, taskId: string | null) {
  if (!taskId) return true;
  const [task] = await getDb().select({ id: tasks.id }).from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.businessId, businessId))).limit(1);
  return !!task;
}

teamMemoryRoutes.get("/", async c => {
  const rows = await getDb().select().from(teamMemories)
    .where(eq(teamMemories.businessId, c.get("user").businessId)).orderBy(desc(teamMemories.createdAt));
  return c.json({ ok: true, data: rows });
});
teamMemoryRoutes.post("/", requireOwner, zValidator("json", bodySchema.refine(validNote, "Delegation notes require taskId")), async c => {
  const body = c.req.valid("json");
  const { businessId } = c.get("user");
  if (!await validTask(businessId, body.taskId)) return c.json({ ok: false, error: "Task not found" }, 404);
  const [saved] = await getDb().insert(teamMemories).values({ id: newId("tmem"), businessId, authorEmployeeId: null, ...body }).returning();
  return c.json({ ok: true, data: saved }, 201);
});
teamMemoryRoutes.patch("/:id", requireOwner, zValidator("json", bodySchema.partial().refine(b => Object.keys(b).length > 0)), async c => {
  const db = getDb();
  const { businessId } = c.get("user");
  const where = and(eq(teamMemories.id, c.req.param("id")), eq(teamMemories.businessId, businessId));
  const [existing] = await db.select().from(teamMemories).where(where).limit(1);
  if (!existing) return c.json({ ok: false, error: "Memory not found" }, 404);
  const patch = c.req.valid("json");
  const body = { kind: patch.kind ?? existing.kind, content: patch.content ?? existing.content,
    taskId: patch.taskId === undefined ? existing.taskId : patch.taskId };
  if (!validNote(body)) return c.json({ ok: false, error: "Delegation notes require taskId" }, 422);
  if (!await validTask(businessId, body.taskId)) return c.json({ ok: false, error: "Task not found" }, 404);
  const [saved] = await db.update(teamMemories).set({ kind: body.kind, content: body.content, taskId: body.taskId })
    .where(where).returning();
  return c.json({ ok: true, data: saved });
});
teamMemoryRoutes.delete("/:id", requireOwner, async c => {
  const [deleted] = await getDb().delete(teamMemories)
    .where(and(eq(teamMemories.id, c.req.param("id")), eq(teamMemories.businessId, c.get("user").businessId))).returning({ id: teamMemories.id });
  return deleted ? c.json({ ok: true, data: null }) : c.json({ ok: false, error: "Memory not found" }, 404);
});
