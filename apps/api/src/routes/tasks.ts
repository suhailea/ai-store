import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { getDb, tasks, runs, employees, chatSessions } from "@staffroom/db";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/id";
import { startAgentRun } from "../agent/runner";
import logger from "../lib/logger";
import type { AppEnv } from "../lib/types";

export const taskRoutes = new Hono<AppEnv>();

taskRoutes.use("*", requireAuth);

const createTaskSchema = z.object({
  assignedToEmployeeId: z.string(),
  title: z.string().min(1),
  description: z.string().default(""),
  chatSessionId: z.string().optional(),
});

// List tasks for the business
taskRoutes.get("/", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();

  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.businessId, businessId))
    .orderBy(desc(tasks.createdAt));

  return c.json({ ok: true, data: rows });
});

// Create and enqueue a task
taskRoutes.post("/", zValidator("json", createTaskSchema), async (c) => {
  const { businessId, userId } = c.get("user");
  const body = c.req.valid("json");
  const db = getDb();

  // Verify employee belongs to this business
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, body.assignedToEmployeeId), eq(employees.businessId, businessId)));

  if (!employee) return c.json({ ok: false, error: "Employee not found" }, 404);
  if (employee.status !== "active") return c.json({ ok: false, error: "Employee is not active" }, 400);

  const id = newId("tsk");
  await db.insert(tasks).values({
    id,
    businessId,
    assignedToEmployeeId: body.assignedToEmployeeId,
    createdByHumanId: userId,
    title: body.title,
    description: body.description,
    status: "queued",
    chatSessionId: body.chatSessionId ?? null,
  });

  // Update session updatedAt if a chatSessionId was provided
  if (body.chatSessionId) {
    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, body.chatSessionId));
  }

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));

  // Start the agent run in the background (fire and forget)
  startAgentRun(id).catch((err) => {
    logger.error(`Agent run failed for task ${id}`, { error: (err as Error).message, taskId: id });
  });

  return c.json({ ok: true, data: task }, 201);
});

// Chat history: direct human-initiated tasks for an employee with their latest run
taskRoutes.get("/history", async (c) => {
  const { businessId } = c.get("user");
  const employeeId = c.req.query("employeeId");
  const chatSessionId = c.req.query("chatSessionId");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 100);
  if (!employeeId) return c.json({ ok: false, error: "employeeId required" }, 400);
  const db = getDb();

  // Only direct tasks (created by a human, not spawned by a supervisor)
  const conditions = [
    eq(tasks.businessId, businessId),
    eq(tasks.assignedToEmployeeId, employeeId),
    isNotNull(tasks.createdByHumanId),
  ];
  if (chatSessionId) {
    conditions.push(eq(tasks.chatSessionId, chatSessionId));
  }

  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt))
    .limit(limit);

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

// Get a single task with its latest run
taskRoutes.get("/:id", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, c.req.param("id")), eq(tasks.businessId, businessId)));

  if (!task) return c.json({ ok: false, error: "Not found" }, 404);

  const [latestRun] = await db
    .select()
    .from(runs)
    .where(eq(runs.taskId, task.id))
    .orderBy(desc(runs.createdAt))
    .limit(1);

  return c.json({ ok: true, data: { ...task, run: latestRun ?? null } });
});

// Stop a running task
taskRoutes.post("/:id/stop", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, c.req.param("id")), eq(tasks.businessId, businessId)));

  if (!task) return c.json({ ok: false, error: "Not found" }, 404);
  if (!["queued", "running", "waiting_approval"].includes(task.status)) {
    return c.json({ ok: false, error: "Task is not stoppable" }, 400);
  }

  await db
    .update(tasks)
    .set({ status: "stopped", finishedAt: new Date() })
    .where(eq(tasks.id, task.id));

  return c.json({ ok: true, data: null });
});

// Get run steps for a task (run view)
taskRoutes.get("/:id/run", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, c.req.param("id")), eq(tasks.businessId, businessId)));

  if (!task) return c.json({ ok: false, error: "Not found" }, 404);

  const runRows = await db
    .select()
    .from(runs)
    .where(eq(runs.taskId, task.id))
    .orderBy(desc(runs.createdAt));

  return c.json({ ok: true, data: runRows });
});
