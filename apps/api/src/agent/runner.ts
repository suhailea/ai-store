/**
 * runner.ts — entry point for all agent runs.
 *
 * Loads the task + employee + business, enforces budget, creates the run
 * record, then branches:
 *   - employee.isManager === true  → supervisor agent (Sonnet, spawn_task tools)
 *   - employee.isManager === false → employee agent  (Haiku, badge-gated tools)
 */

import { eq, desc } from "drizzle-orm";
import { getDb, tasks, runs, employees, businesses } from "@staffroom/db";
import { newId } from "../lib/id";
import { DEFAULT_LLM_CONFIG } from "@staffroom/llm";
import type { LLMMessage } from "@staffroom/llm";
import { runAsEmployee } from "./employee";
import { runAsSupervisor } from "./supervisor";
import logger from "../lib/logger";

export async function startAgentRun(taskId: string): Promise<void> {
  const db = getDb();

  // ── Load entities ──────────────────────────────────────────────────────────
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new Error(`Task ${taskId} not found`);

  const [employee] = await db.select().from(employees).where(eq(employees.id, task.assignedToEmployeeId));
  if (!employee) throw new Error(`Employee ${task.assignedToEmployeeId} not found`);

  const [business] = await db.select().from(businesses).where(eq(businesses.id, employee.businessId));
  const demoMode = business?.demoMode ?? false;

  // Employee-level override takes precedence over the business default
  const llmConfig = {
    provider: (employee.llmProvider ?? business?.llmProvider ?? DEFAULT_LLM_CONFIG.provider) as "anthropic" | "deepseek" | "gemini" | "ollama" | "openrouter",
    model: employee.llmModel ?? business?.llmModel ?? DEFAULT_LLM_CONFIG.model,
    ollamaBaseUrl: business?.ollamaBaseUrl ?? null,
  };

  // ── Budget check ───────────────────────────────────────────────────────────
  if (employee.budgetUsedUsd >= employee.budgetMonthlyUsd) {
    await db.update(tasks).set({ status: "stopped" }).where(eq(tasks.id, taskId));
    throw new Error(`${employee.displayName} has exhausted their monthly budget`);
  }

  // ── Check for a saved checkpoint from a prior paused run ──────────────────
  // If the task was waiting_approval, the last run has messagesJson set.
  // Resume from that checkpoint instead of starting fresh.
  let resumeMessages: LLMMessage[] | undefined;

  const [lastRun] = await db
    .select({ messagesJson: runs.messagesJson })
    .from(runs)
    .where(eq(runs.taskId, taskId))
    .orderBy(desc(runs.createdAt))
    .limit(1);

  if (lastRun?.messagesJson) {
    resumeMessages = lastRun.messagesJson as LLMMessage[];
    logger.info("Resuming from checkpoint", { taskId, messageCount: resumeMessages.length });
  }

  // ── Mark running + create run record ──────────────────────────────────────
  await db.update(tasks).set({ status: "running", startedAt: new Date() }).where(eq(tasks.id, taskId));

  const runId = newId("run");
  await db.insert(runs).values({
    id: runId,
    taskId,
    steps: [],
    totalTokens: 0,
    costUsd: 0,
    durationMs: 0,
  });

  logger.info("Agent run started", {
    taskId,
    runId,
    employee: employee.displayName,
    isManager: employee.isManager,
    provider: llmConfig.provider,
    model: llmConfig.model,
    resume: !!resumeMessages,
  });

  // instructionsJson is stored as jsonb (unknown) — cast to the expected shape
  const employeeWithInstructions = {
    ...employee,
    instructionsJson: (employee.instructionsJson ?? {}) as Record<string, string>,
    integrations: (employee.integrations ?? []) as string[],
  };

  // ── Branch: supervisor or employee ─────────────────────────────────────────
  const resumeOpts = resumeMessages ? { resumeMessages } : {};

  if (employee.isManager) {
    await runAsSupervisor({ task, employee: employeeWithInstructions, business, llmConfig, demoMode, runId, ...resumeOpts });
  } else {
    await runAsEmployee({ task, employee: employeeWithInstructions, business, llmConfig, demoMode, runId, ...resumeOpts });
  }

  logger.info("Agent run finished", { taskId, runId });
}
