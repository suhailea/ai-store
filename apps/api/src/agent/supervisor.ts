/**
 * Supervisor agent — activated when employee.isManager === true.
 *
 * Responsibilities:
 *   1. Understand the high-level task
 *   2. Break it into sub-tasks
 *   3. Assign each sub-task to the best-fit employee (by role)
 *   4. Spawn sub-tasks (they run as employee agents)
 *   5. Poll status and finish when all sub-tasks are done
 *
 * Model: Sonnet (needs stronger reasoning than Haiku for decomposition).
 * Tools: spawn_task, check_task_status, list_employees, finish.
 *        No external tools (email, calendar) — that's the employees' job.
 */

import { eq, and, desc, inArray } from "drizzle-orm";
import { getDb, tasks, employees, memories, runs } from "@staffroom/db";
import { newId } from "../lib/id";
import { runAgentLoop } from "./loop";
import { buildSupervisorSystemPrompt } from "./prompts";
import { startAgentRun } from "./runner";
import { SUPERVISOR_TOOLS } from "./tools";
import type { LoopContext } from "./loop";
import type { LLMConfig, LLMMessage } from "@staffroom/llm";
import logger from "../lib/logger";
import { loadMemoryContext, writeAgentMemory, writeSupervisorTeamMemory, writeSupervisorCorrection, promoteEmployeeMemory } from "./memory";

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeSupervisorTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: LoopContext
): Promise<unknown> {
  const db = getDb();

  switch (toolName) {
    case "write_memory": return writeAgentMemory(ctx, toolInput);
    case "write_team_memory": return writeSupervisorTeamMemory(ctx, toolInput);
    case "write_correction_memory": return writeSupervisorCorrection(ctx, toolInput);
    case "promote_employee_memory": return promoteEmployeeMemory(ctx, toolInput);
    case "think_and_plan": {
      // Reasoning step — just echo back the plan so it appears in the run trace
      logger.debug("Supervisor planning", { taskId: ctx.taskId, plan: toolInput });
      return {
        acknowledged: true,
        task_analysis: toolInput.task_analysis,
        sub_tasks: toolInput.sub_tasks,
        open_questions: toolInput.open_questions ?? null,
        message: "Plan recorded. Call list_employees next to match sub-tasks to available employees.",
      };
    }

    case "list_employees": {
      const activeEmployees = await db
        .select({
          id: employees.id,
          displayName: employees.displayName,
          roleDescription: employees.roleDescription,
          integrations: employees.integrations,
          isManager: employees.isManager,
        })
        .from(employees)
        .where(
          and(
            eq(employees.businessId, ctx.businessId),
            eq(employees.status, "active")
          )
        );

      return activeEmployees.map((e) => ({
        id: e.id,
        name: e.displayName,
        role: e.roleDescription,
        integrations: e.integrations,
        isManager: e.isManager,
      }));
    }

    case "spawn_task": {
      const [target] = await db.select({ id: employees.id }).from(employees).where(and(
        eq(employees.id, toolInput.employee_id as string), eq(employees.businessId, ctx.businessId),
        eq(employees.status, "active")
      )).limit(1);
      if (!target || target.id === ctx.employeeId) return { error: "Choose another active employee in your business." };
      const subTaskId = newId("tsk");

      await db.insert(tasks).values({
        id: subTaskId,
        businessId: ctx.businessId,
        assignedToEmployeeId: toolInput.employee_id as string,
        createdByTaskId: ctx.taskId,      // supervisor is the creator
        parentTaskId: ctx.taskId,         // links to parent for UI tree
        title: toolInput.title as string,
        description: toolInput.description as string,
        status: "queued",
      });

      // Fire sub-task asynchronously — supervisor continues polling
      startAgentRun(subTaskId).catch((err) => {
        logger.error("Sub-task failed", { subTaskId, parentTaskId: ctx.taskId, error: (err as Error).message });
      });

      logger.info("Supervisor spawned sub-task", {
        parentTaskId: ctx.taskId,
        subTaskId,
        assignedTo: toolInput.employee_id,
        title: toolInput.title,
      });

      return {
        sub_task_id: subTaskId,
        status: "queued",
        message: `Sub-task created and assigned. Use check_task_status("${subTaskId}") to monitor progress.`,
      };
    }

    case "check_task_status": {
      const [subTask] = await db
        .select({ id: tasks.id, status: tasks.status, title: tasks.title, finishedAt: tasks.finishedAt, employeeId: tasks.assignedToEmployeeId })
        .from(tasks)
        .where(and(eq(tasks.id, toolInput.task_id as string), eq(tasks.businessId, ctx.businessId), eq(tasks.parentTaskId, ctx.taskId)));

      if (!subTask) return { error: "Sub-task not found" };

      const [observations, recentRuns] = await Promise.all([
        db.select({ id: memories.id, kind: memories.kind, content: memories.content }).from(memories)
          .where(and(eq(memories.employeeId, subTask.employeeId), inArray(memories.kind, ["episodic", "learned"])))
          .orderBy(desc(memories.createdAt)).limit(5),
        db.select({ steps: runs.steps }).from(runs).where(eq(runs.taskId, subTask.id)).orderBy(desc(runs.createdAt)).limit(1),
      ]);

      return {
        task_id: subTask.id,
        title: subTask.title,
        status: subTask.status,
        finished_at: subTask.finishedAt ?? null,
        done: ["done", "stopped", "stale"].includes(subTask.status),
        recent_memories: observations,
        recent_steps: Array.isArray(recentRuns[0]?.steps) ? recentRuns[0].steps.slice(-5) : [],
      };
    }

    case "finish": {
      await db
        .update(tasks)
        .set({ status: "done", finishedAt: new Date() })
        .where(eq(tasks.id, ctx.taskId));
      return { finished: true, summary: toolInput.summary };
    }

    default:
      return { error: `Unknown supervisor tool: ${toolName}` };
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const MAX_STEPS = 30; // supervisors need more steps for polling

export interface RunSupervisorOptions {
  task: { id: string; title: string; description: string };
  employee: {
    id: string;
    displayName: string;
    roleDescription: string;
    businessId: string;
    instructionsJson: Record<string, string>;
  };
  business: { id: string; name: string };
  llmConfig: LLMConfig & { ollamaBaseUrl?: string | null };
  demoMode: boolean;
  runId: string;
  /** Serialized message history from a paused run — present when resuming after approval */
  resumeMessages?: LLMMessage[];
  /** Prior chat session turns — prepended so the agent can follow up on the conversation */
  chatHistory?: LLMMessage[];
}

export async function runAsSupervisor(opts: RunSupervisorOptions): Promise<void> {
  const { task, employee, business, llmConfig, runId, resumeMessages, chatHistory } = opts;

  const memoryContext = await loadMemoryContext({ employeeId: employee.id, businessId: employee.businessId, taskId: task.id });

  const systemPrompt = buildSupervisorSystemPrompt({
    displayName: employee.displayName,
    roleDescription: employee.roleDescription,
    instructionsJson: employee.instructionsJson,
    ...memoryContext,
    businessName: business.name,
    maxSteps: MAX_STEPS,
  });

  const ctx: LoopContext = {
    taskId: task.id,
    employeeId: employee.id,
    runId,
    businessId: employee.businessId,
    demoMode: opts.demoMode,
  };

  const currentTaskMsg: LLMMessage = { role: "user", content: task.description
    ? `Task: ${task.title}\n\n${task.description}`
    : `Task: ${task.title}` };
  const initialMessages: LLMMessage[] = resumeMessages ??
    [...(chatHistory ?? []), currentTaskMsg];

  await runAgentLoop({
    ctx,
    llmConfig,
    systemPrompt,
    tools: SUPERVISOR_TOOLS,
    initialMessages,
    maxSteps: MAX_STEPS,
    executeTool: executeSupervisorTool,
  });
}
