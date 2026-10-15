import * as nodeCron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { CronExpressionParser } from "cron-parser";
import { eq, and } from "drizzle-orm";
import { getDb, workflows, workflowRuns, tasks, employees } from "@staffroom/db";
import { newId } from "../lib/id";
import { startAgentRun } from "../agent/runner";
import logger from "../lib/logger";

/**
 * Find the manager employee for a business, falling back to the given employeeId.
 * Workflows always route through the manager so multi-employee coordination works
 * automatically — the manager decides whether to handle it alone or delegate.
 */
async function resolveExecutor(businessId: string, fallbackEmployeeId: string): Promise<string> {
  const db = getDb();
  const [manager] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.businessId, businessId), eq(employees.isManager, true), eq(employees.status, "active")))
    .limit(1);
  return manager?.id ?? fallbackEmployeeId;
}

const scheduledJobs = new Map<string, ScheduledTask>();

export function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = context[key];
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

function buildContext(extra?: Record<string, unknown>): Record<string, unknown> {
  const now = new Date();
  return {
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().slice(0, 5),
    day: now.toLocaleDateString("en-US", { weekday: "long" }),
    ...extra,
  };
}

export async function fireWorkflow(
  workflowId: string,
  contextData?: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  const [wfl] = await db.select().from(workflows).where(eq(workflows.id, workflowId));
  if (!wfl || !wfl.enabled) return;

  // Always route through the manager — resolve regardless of what's stored
  const executorId = await resolveExecutor(wfl.businessId, wfl.assignedToEmployeeId);

  // Load employee for template context (use executor if sentinel was stored)
  const empId = wfl.assignedToEmployeeId === "__manager__" ? executorId : wfl.assignedToEmployeeId;
  const [emp] = await db.select().from(employees).where(eq(employees.id, empId));
  if (!emp) {
    await db.insert(workflowRuns).values({
      id: newId("wfr"),
      workflowId,
      status: "failed",
      contextData: contextData ?? null,
      error: "No active manager or employee found for this workflow",
    });
    return;
  }

  const ctx = buildContext({
    employee_name: emp.displayName ?? emp.roleDescription,
    trigger_data: contextData ? JSON.stringify(contextData) : undefined,
    ...contextData,
  });

  const title = renderTemplate(wfl.taskTitleTemplate, ctx);
  const description = renderTemplate(wfl.taskDescriptionTemplate, ctx);

  const wfrId = newId("wfr");
  let taskId: string | undefined;

  try {
    taskId = newId("tsk");
    await db.insert(tasks).values({
      id: taskId,
      businessId: wfl.businessId,
      assignedToEmployeeId: executorId,
      title,
      description,
      status: "queued",
      createdByWorkflowId: workflowId,
    });

    await db.insert(workflowRuns).values({
      id: wfrId,
      workflowId,
      taskId,
      status: "task_created",
      contextData: contextData ?? null,
    });

    await db.update(workflows).set({ lastFiredAt: new Date(), updatedAt: new Date() }).where(eq(workflows.id, workflowId));

    // Fire and forget
    startAgentRun(taskId).catch((err) =>
      logger.error("Workflow-triggered task failed to start", { workflowId, taskId, error: (err as Error).message })
    );

    logger.info("Workflow fired", { workflowId, taskId, title });
  } catch (err) {
    await db.insert(workflowRuns).values({
      id: wfrId,
      workflowId,
      taskId: taskId ?? null,
      status: "failed",
      contextData: contextData ?? null,
      error: (err as Error).message,
    });
    logger.error("Failed to fire workflow", { workflowId, error: (err as Error).message });
  }
}

export async function scheduleWorkflows(): Promise<void> {
  const db = getDb();
  const all = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.enabled, true)));

  const scheduleOnes = all.filter((w) => w.triggerType === "schedule");
  let caught = 0;

  for (const wfl of scheduleOnes) {
    // Register the ongoing cron job
    scheduleWorkflow(wfl);

    // Check for missed runs while server was down
    const cron = (wfl.triggerConfig as { cron?: string }).cron;
    if (!cron) continue;

    try {
      // Only catch up if the workflow has fired before — new workflows should not
      // fire immediately just because their first scheduled time already passed today.
      if (!wfl.lastFiredAt) continue;

      const interval = CronExpressionParser.parse(cron, { tz: "UTC" });
      const since = wfl.lastFiredAt;
      const now = new Date();

      // Walk forward from last fired time — if there was a tick before now, we missed it
      interval.reset(since);
      const nextAfterLast = interval.next().toDate();

      if (nextAfterLast < now) {
        // At least one tick was missed — fire once to catch up
        logger.info("Catching up missed workflow run", {
          workflowId: wfl.id,
          name: wfl.name,
          missedAt: nextAfterLast.toISOString(),
        });
        fireWorkflow(wfl.id, { catchup: true, missedAt: nextAfterLast.toISOString() }).catch((err) =>
          logger.error("Catchup fire failed", { workflowId: wfl.id, error: (err as Error).message })
        );
        caught++;
      }
    } catch {
      // Invalid cron or parse error — skip catchup, normal scheduling still runs
    }
  }

  logger.info(`Scheduled ${scheduleOnes.length} workflow(s), caught up ${caught} missed run(s)`);
}

export function scheduleWorkflow(wfl: { id: string; triggerConfig: Record<string, unknown> }): void {
  const cron = (wfl.triggerConfig as { cron?: string }).cron;
  if (!cron) return;

  // Cancel existing job if re-registering
  const existing = scheduledJobs.get(wfl.id);
  if (existing) existing.stop();

  if (!nodeCron.validate(cron)) {
    logger.warn("Invalid cron expression for workflow", { workflowId: wfl.id, cron });
    return;
  }

  const job = nodeCron.schedule(cron, () => {
    fireWorkflow(wfl.id).catch((err) =>
      logger.error("Cron-triggered workflow failed", { workflowId: wfl.id, error: (err as Error).message })
    );
  });
  scheduledJobs.set(wfl.id, job);
}

export function unscheduleWorkflow(workflowId: string): void {
  const job = scheduledJobs.get(workflowId);
  if (job) {
    job.stop();
    scheduledJobs.delete(workflowId);
  }
}
