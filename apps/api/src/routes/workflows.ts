import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { getDb, workflows, workflowRuns, employees } from "@staffroom/db";
import { newId } from "../lib/id";
import { requireAuth } from "../middleware/auth";
import { fireWorkflow, scheduleWorkflow, unscheduleWorkflow } from "../workflows/engine";
import type { AppEnv } from "../lib/types";

const app = new Hono<AppEnv>();

app.use("*", requireAuth);

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  triggerType: z.enum(["schedule", "webhook", "email_received", "slack_message"]),
  triggerConfig: z.record(z.unknown()),
  assignedToEmployeeId: z.string(),
  taskTitleTemplate: z.string().min(1),
  taskDescriptionTemplate: z.string().min(1),
  enabled: z.boolean().optional().default(true),
});

const updateSchema = createSchema.partial();

// GET /api/workflows
app.get("/", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();
  const rows = await db.select().from(workflows).where(eq(workflows.businessId, businessId)).orderBy(desc(workflows.createdAt));
  return c.json({ ok: true, data: rows });
});

// POST /api/workflows
app.post("/", zValidator("json", createSchema), async (c) => {
  const { businessId } = c.get("user");
  const body = c.req.valid("json");
  const db = getDb();

  // Resolve "__manager__" sentinel to the actual manager employee ID
  let assignedToEmployeeId = body.assignedToEmployeeId;
  if (assignedToEmployeeId === "__manager__") {
    const [manager] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.businessId, businessId), eq(employees.isManager, true), eq(employees.status, "active")))
      .limit(1);
    if (!manager) return c.json({ ok: false, error: "No active manager found for this business" }, 400);
    assignedToEmployeeId = manager.id;
  }

  const id = newId("wfl");
  await db.insert(workflows).values({
    id,
    businessId,
    name: body.name,
    description: body.description ?? null,
    triggerType: body.triggerType,
    triggerConfig: body.triggerConfig,
    assignedToEmployeeId,
    taskTitleTemplate: body.taskTitleTemplate,
    taskDescriptionTemplate: body.taskDescriptionTemplate,
    enabled: body.enabled ?? true,
  });

  const [created] = await db.select().from(workflows).where(eq(workflows.id, id));
  if (created.enabled && created.triggerType === "schedule") {
    scheduleWorkflow(created);
  }
  return c.json({ ok: true, data: created }, 201);
});

// GET /api/workflows/:id
app.get("/:id", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();
  const [wfl] = await db.select().from(workflows).where(and(eq(workflows.id, c.req.param("id")), eq(workflows.businessId, businessId)));
  if (!wfl) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true, data: wfl });
});

// PATCH /api/workflows/:id
app.patch("/:id", zValidator("json", updateSchema), async (c) => {
  const { businessId } = c.get("user");
  const body = c.req.valid("json");
  const db = getDb();

  const [existing] = await db.select().from(workflows).where(and(eq(workflows.id, c.req.param("id")), eq(workflows.businessId, businessId)));
  if (!existing) return c.json({ ok: false, error: "Not found" }, 404);

  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) setFields.name = body.name;
  if (body.description !== undefined) setFields.description = body.description;
  if (body.triggerType !== undefined) setFields.triggerType = body.triggerType;
  if (body.triggerConfig !== undefined) setFields.triggerConfig = body.triggerConfig;
  if (body.assignedToEmployeeId !== undefined) {
    let empId = body.assignedToEmployeeId;
    if (empId === "__manager__") {
      const [manager] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.businessId, businessId), eq(employees.isManager, true), eq(employees.status, "active")))
        .limit(1);
      if (!manager) return c.json({ ok: false, error: "No active manager found for this business" }, 400);
      empId = manager.id;
    }
    setFields.assignedToEmployeeId = empId;
  }
  if (body.taskTitleTemplate !== undefined) setFields.taskTitleTemplate = body.taskTitleTemplate;
  if (body.taskDescriptionTemplate !== undefined) setFields.taskDescriptionTemplate = body.taskDescriptionTemplate;
  if (body.enabled !== undefined) setFields.enabled = body.enabled;
  await db.update(workflows).set(setFields).where(eq(workflows.id, c.req.param("id")));
  const [updated] = await db.select().from(workflows).where(eq(workflows.id, c.req.param("id")));

  // Re-schedule if schedule config changed
  unscheduleWorkflow(updated.id);
  if (updated.enabled && updated.triggerType === "schedule") {
    scheduleWorkflow(updated);
  }

  return c.json({ ok: true, data: updated });
});

// DELETE /api/workflows/:id
app.delete("/:id", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();
  const [existing] = await db.select().from(workflows).where(and(eq(workflows.id, c.req.param("id")), eq(workflows.businessId, businessId)));
  if (!existing) return c.json({ ok: false, error: "Not found" }, 404);

  unscheduleWorkflow(existing.id);
  await db.delete(workflows).where(eq(workflows.id, c.req.param("id")));
  return c.json({ ok: true, data: null });
});

// GET /api/workflows/:id/runs
app.get("/:id/runs", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();
  const [wfl] = await db.select().from(workflows).where(and(eq(workflows.id, c.req.param("id")), eq(workflows.businessId, businessId)));
  if (!wfl) return c.json({ ok: false, error: "Not found" }, 404);

  const runs = await db.select().from(workflowRuns).where(eq(workflowRuns.workflowId, c.req.param("id"))).orderBy(desc(workflowRuns.createdAt)).limit(20);
  return c.json({ ok: true, data: runs });
});

// POST /api/workflows/:id/fire — manually trigger a workflow
app.post("/:id/fire", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();
  const [wfl] = await db.select().from(workflows).where(and(eq(workflows.id, c.req.param("id")), eq(workflows.businessId, businessId)));
  if (!wfl) return c.json({ ok: false, error: "Not found" }, 404);

  fireWorkflow(wfl.id, { manual: true }).catch(() => {});
  return c.json({ ok: true, data: null });
});

export const workflowRoutes = app;
