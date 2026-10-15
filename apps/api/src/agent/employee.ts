/**
 * Employee agent — executes a task using the employee's configured tool grants.
 * External schemas and dispatch bindings come from the discovered MCP catalog.
 */

import { eq, and } from "drizzle-orm";
import { getDb, approvals, tasks, employees } from "@staffroom/db";
import { newId } from "../lib/id";
import { buildEmployeeToolset, type EmployeeToolBinding } from "./tools";
import { executeGrantedMcpTool } from "./mcp/employee-tools";
import { executeNativeTool, isNativeProvider, isNativeToolReadOnly, validateNativeToolArgs } from "./tools/index";
import { runAgentLoop } from "./loop";
import { buildEmployeeSystemPrompt } from "./prompts";
import type { LoopContext } from "./loop";
import type { LLMConfig, LLMMessage } from "@staffroom/llm";
import { loadMemoryContext, writeAgentMemory } from "./memory";
import { guardInput } from "./guardrails";
import logger from "../lib/logger";

// ─── Tool executor ────────────────────────────────────────────────────────────

const APPROVAL_EXPIRY_HOURS = 48;

async function executeEmployeeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: LoopContext,
  bindings: Map<string, EmployeeToolBinding>
): Promise<unknown> {
  const db = getDb();

  // Guard tool inputs before any execution — catches injected instructions
  // that external content may have slipped into the agent's tool arguments.
  const inputGuard = guardInput(toolName, toolInput, { taskId: ctx.taskId, employeeId: ctx.employeeId });
  if (!inputGuard.safe) {
    return { error: inputGuard.reason };
  }

  const binding = bindings.get(toolName);
  if (binding) {
    const { provider, toolName: providerToolName } = binding;

    // ── Native tool (direct REST API) ────────────────────────────────────────
    if (isNativeProvider(provider)) {
      if (!isNativeToolReadOnly(provider, providerToolName)) {
        const validationError = validateNativeToolArgs(provider, providerToolName, toolInput);
        if (validationError) return { error: validationError };
        return executeEmployeeTool("create_approval_request", {
          action_type: toolName,
          preview: toolInput,
          reason: "This action sends or modifies data and requires your approval.",
        }, ctx, bindings);
      }
      const result = await executeNativeTool(provider, providerToolName, toolInput, {
        businessId: ctx.businessId,
        employeeId: ctx.employeeId,
      });
      return { content: `[UNTRUSTED CONTENT START]\n${JSON.stringify(result)}\n[UNTRUSTED CONTENT END]` };
    }

    // ── MCP tool ─────────────────────────────────────────────────────────────
    // Tools that execute directly without approval (low-risk comms actions)
    const APPROVAL_BYPASS = new Set(["slack_send_message", "slack_send_reply"]);
    const approved = APPROVAL_BYPASS.has(binding.toolName);
    const outcome = await executeGrantedMcpTool(binding, toolInput, { employeeId: ctx.employeeId, businessId: ctx.businessId }, approved);
    if (outcome.requiresApproval) {
      return executeEmployeeTool("create_approval_request", {
        action_type: toolName,
        preview: toolInput,
        reason: "This external tool changes data or does not declare itself read-only.",
      }, ctx, bindings);
    }
    return { content: `[UNTRUSTED CONTENT START]\n${JSON.stringify(outcome.result)}\n[UNTRUSTED CONTENT END]` };
  }

  switch (toolName) {
    case "write_memory": {
      return writeAgentMemory(ctx, toolInput);
    }

    case "create_approval_request": {
      const target = bindings.get(toolInput.action_type as string);
      if (!target) return { error: "Use an available external tool's exact name as action_type." };

      // Bypass approval for low-risk comms tools — execute directly and return result
      const APPROVAL_BYPASS = new Set(["slack_send_message", "slack_send_reply"]);
      if (APPROVAL_BYPASS.has(target.toolName)) {
        const preview = (toolInput.preview ?? {}) as Record<string, unknown>;
        const outcome = await executeGrantedMcpTool(target, preview, { employeeId: ctx.employeeId, businessId: ctx.businessId }, true);
        if (outcome.requiresApproval) return { error: "Tool execution failed." };
        return { sent: true, result: outcome.result };
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + APPROVAL_EXPIRY_HOURS);
      const approvalId = newId("apr");

      await db.insert(approvals).values({
        id: approvalId,
        taskId: ctx.taskId,
        runId: ctx.runId,
        employeeId: ctx.employeeId,
        actionType: isNativeProvider(target.provider) ? "native_tool" : "mcp_tool",
        payloadJson: { provider: target.provider, toolName: target.toolName, arguments: toolInput.preview },
        reason: toolInput.reason as string,
        status: "pending",
        idempotencyKey: newId("idem"),
        expiresAt,
      });

      await db.update(tasks).set({ status: "waiting_approval" }).where(eq(tasks.id, ctx.taskId));

      return {
        approval_id: approvalId,
        status: "waiting_for_owner_approval",
        message: "Approval request created. Task paused until owner approves.",
      };
    }

    case "escalate_to_manager": {
      const [manager] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(
          eq(employees.businessId, ctx.businessId),
          eq(employees.isManager, true),
          eq(employees.status, "active"),
        ))
        .limit(1);

      if (!manager) return { error: "No active manager found for this business." };

      const managerTaskId = newId("tsk");
      await db.insert(tasks).values({
        id: managerTaskId,
        businessId: ctx.businessId,
        assignedToEmployeeId: manager.id,
        createdByTaskId: ctx.taskId,
        parentTaskId: ctx.taskId,
        title: toolInput.title as string,
        description: toolInput.context as string,
        status: "queued",
      });

      // Dynamic import breaks the circular dependency: runner → employee → runner
      import("./runner").then(({ startAgentRun }) => {
        startAgentRun(managerTaskId).catch((err) => {
          logger.error("Escalated manager task failed", { managerTaskId, parentTaskId: ctx.taskId, error: (err as Error).message });
        });
      });

      return {
        escalated: true,
        manager_task_id: managerTaskId,
        message: `Escalated to manager. Task ${managerTaskId} created and queued.`,
      };
    }

    case "finish": {
      await db.update(tasks).set({ status: "done", finishedAt: new Date() }).where(eq(tasks.id, ctx.taskId));
      return { finished: true, summary: toolInput.summary };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const MAX_STEPS = 20;

export interface RunEmployeeOptions {
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

export async function runAsEmployee(opts: RunEmployeeOptions): Promise<void> {
  const { task, employee, business, llmConfig, demoMode, runId, resumeMessages, chatHistory } = opts;

  const memoryContext = await loadMemoryContext({ employeeId: employee.id, businessId: employee.businessId, taskId: task.id });

  const systemPrompt = buildEmployeeSystemPrompt({
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
    demoMode,
  };

  const toolset = await buildEmployeeToolset(employee.id, employee.businessId);

  // Use checkpoint messages if resuming after approval, otherwise start fresh.
  // Prepend chat session history so the agent can follow up on prior turns.
  const currentTaskMsg: LLMMessage = { role: "user", content: task.description
    ? `Task: ${task.title}\n\n${task.description}`
    : `Task: ${task.title}` };
  const initialMessages: LLMMessage[] = resumeMessages ??
    [...(chatHistory ?? []), currentTaskMsg];

  await runAgentLoop({
    ctx,
    llmConfig,
    systemPrompt,
    tools: toolset.tools,
    initialMessages,
    maxSteps: MAX_STEPS,
    executeTool: (name, input, context) => executeEmployeeTool(name, input, context, toolset.bindings),
  });
}
