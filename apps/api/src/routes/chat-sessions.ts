import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb, chatSessions, tasks, runs, employees } from "@staffroom/db";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/id";
import type { AppEnv } from "../lib/types";

export const chatSessionRoutes = new Hono<AppEnv>();

chatSessionRoutes.use("*", requireAuth);

const createSessionSchema = z.object({
  employeeId: z.string(),
  title: z.string().optional(),
});

// GET /chat-sessions?employeeId=xxx
// Returns sessions for employee, newest first, with taskCount
chatSessionRoutes.get("/", async (c) => {
  const { businessId } = c.get("user");
  const employeeId = c.req.query("employeeId");
  if (!employeeId) return c.json({ ok: false, error: "employeeId required" }, 400);

  const db = getDb();

  // Verify employee belongs to this business
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.businessId, businessId)));

  if (!employee) return c.json({ ok: false, error: "Employee not found" }, 404);

  const sessions = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.employeeId, employeeId), eq(chatSessions.businessId, businessId)))
    .orderBy(desc(chatSessions.updatedAt));

  // Count tasks per session
  const taskCounts = await Promise.all(
    sessions.map(async (s) => {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(eq(tasks.chatSessionId, s.id));
      return row?.count ?? 0;
    })
  );

  const data = sessions.map((s, i) => ({ ...s, taskCount: taskCounts[i] }));
  return c.json({ ok: true, data });
});

// POST /chat-sessions
// Creates a new session
chatSessionRoutes.post("/", zValidator("json", createSessionSchema), async (c) => {
  const { businessId, userId } = c.get("user");
  const body = c.req.valid("json");
  const db = getDb();

  // Verify employee belongs to this business
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, body.employeeId), eq(employees.businessId, businessId)));

  if (!employee) return c.json({ ok: false, error: "Employee not found" }, 404);

  const id = newId("csn");
  await db.insert(chatSessions).values({
    id,
    businessId,
    employeeId: body.employeeId,
    createdByHumanId: userId,
    title: body.title ?? "New chat",
  });

  const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
  return c.json({ ok: true, data: { ...session, taskCount: 0 } }, 201);
});

// DELETE /chat-sessions/:id
chatSessionRoutes.delete("/:id", async (c) => {
  const { businessId } = c.get("user");
  const sessionId = c.req.param("id");
  const db = getDb();

  const [session] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.businessId, businessId)));

  if (!session) return c.json({ ok: false, error: "Session not found" }, 404);

  // Null out chatSessionId on tasks (keep tasks, just unlink from session)
  await db.update(tasks).set({ chatSessionId: null }).where(eq(tasks.chatSessionId, sessionId));
  await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));

  return c.json({ ok: true, data: null });
});

// GET /chat-sessions/:id/tasks
// Returns all tasks in session with latest run
chatSessionRoutes.get("/:id/tasks", async (c) => {
  const { businessId } = c.get("user");
  const sessionId = c.req.param("id");
  const db = getDb();

  // Verify session belongs to this business
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.businessId, businessId)));

  if (!session) return c.json({ ok: false, error: "Session not found" }, 404);

  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.chatSessionId, sessionId), eq(tasks.businessId, businessId)))
    .orderBy(desc(tasks.createdAt));

  if (rows.length === 0) return c.json({ ok: true, data: [] });

  // Fetch latest run per task
  const runRows = await Promise.all(
    rows.map((t) =>
      db.select().from(runs).where(eq(runs.taskId, t.id)).orderBy(desc(runs.createdAt)).limit(1)
        .then((r) => r[0] ?? null)
    )
  );

  const data = rows.map((task, i) => ({ ...task, run: runRows[i] }));
  return c.json({ ok: true, data });
});
