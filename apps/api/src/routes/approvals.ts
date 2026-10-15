import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { getDb, approvals, tasks, employees, auditLogs } from "@staffroom/db";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/id";
import { executeApprovedAction } from "../agent/actions";
import { startAgentRun } from "../agent/runner";
import type { AppEnv } from "../lib/types";

export const approvalRoutes = new Hono<AppEnv>();

approvalRoutes.use("*", requireAuth);

// List pending approvals for the business
approvalRoutes.get("/", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();

  const rows = await db
    .select({
      approval: approvals,
      employee: employees,
      task: tasks,
    })
    .from(approvals)
    .innerJoin(tasks, eq(approvals.taskId, tasks.id))
    .innerJoin(employees, eq(approvals.employeeId, employees.id))
    .where(and(eq(tasks.businessId, businessId), eq(approvals.status, "pending")))
    .orderBy(desc(approvals.createdAt));

  return c.json({ ok: true, data: rows });
});

// Approve an action
approvalRoutes.post("/:id/approve", async (c) => {
  const { businessId, userId } = c.get("user");
  const db = getDb();
  const body = await c.req.json().catch(() => ({}));

  // Load and lock the approval row
  const [approval] = await db
    .select({ approval: approvals, task: tasks })
    .from(approvals)
    .innerJoin(tasks, eq(approvals.taskId, tasks.id))
    .where(and(eq(approvals.id, c.req.param("id")), eq(tasks.businessId, businessId)));

  if (!approval) return c.json({ ok: false, error: "Not found" }, 404);
  if (approval.approval.status !== "pending") {
    return c.json({ ok: false, error: "Approval is no longer pending" }, 409);
  }
  if (new Date() > approval.approval.expiresAt) {
    await db.update(approvals).set({ status: "expired" }).where(eq(approvals.id, approval.approval.id));
    return c.json({ ok: false, error: "Approval has expired" }, 410);
  }

  // Optionally accept an edited payload
  const finalPayload = body.editedPayload ?? approval.approval.payloadJson;

  // Execute the approved action first, then mark as approved
  try {
    await executeApprovedAction({
      approvalId: approval.approval.id,
      idempotencyKey: approval.approval.idempotencyKey,
      actionType: approval.approval.actionType,
      payload: finalPayload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Approved action execution failed", { approvalId: approval.approval.id, err });
    return c.json({ ok: false, error: `Action failed: ${message}` }, 500);
  }

  // Mark approved after successful execution
  await db
    .update(approvals)
    .set({ status: "approved", executedAt: new Date(), payloadJson: finalPayload })
    .where(eq(approvals.id, approval.approval.id));

  await db.insert(auditLogs).values({
    id: newId("aud"),
    businessId,
    actorType: "human",
    actorId: userId,
    action: "approval.approved",
    targetType: "approval",
    targetId: approval.approval.id,
  });

  // Resume the agent loop from checkpoint — fire-and-forget (runs async)
  startAgentRun(approval.task.id).catch((err) => {
    console.error("Failed to resume agent after approval", { taskId: approval.task.id, err });
  });

  return c.json({ ok: true, data: null });
});

// Reject an action
approvalRoutes.post("/:id/reject", async (c) => {
  const { businessId, userId } = c.get("user");
  const db = getDb();
  const body = await c.req.json().catch(() => ({}));

  const [approval] = await db
    .select({ approval: approvals, task: tasks })
    .from(approvals)
    .innerJoin(tasks, eq(approvals.taskId, tasks.id))
    .where(and(eq(approvals.id, c.req.param("id")), eq(tasks.businessId, businessId)));

  if (!approval) return c.json({ ok: false, error: "Not found" }, 404);
  if (approval.approval.status !== "pending") {
    return c.json({ ok: false, error: "Approval is no longer pending" }, 409);
  }

  await db
    .update(approvals)
    .set({ status: "rejected", reviewerNote: body.note ?? null })
    .where(eq(approvals.id, approval.approval.id));

  await db
    .update(tasks)
    .set({ status: "stopped" })
    .where(eq(tasks.id, approval.task.id));

  await db.insert(auditLogs).values({
    id: newId("aud"),
    businessId,
    actorType: "human",
    actorId: userId,
    action: "approval.rejected",
    targetType: "approval",
    targetId: approval.approval.id,
  });

  return c.json({ ok: true, data: null });
});
