/**
 * Core agentic loop — shared by both employee and supervisor agents.
 *
 * Handles: LLM calls, step recording, token accounting, tool dispatch,
 * run persistence, budget updates, and task finalisation.
 *
 * Callers (employee.ts, supervisor.ts) provide the system prompt, tools,
 * initial messages, and a tool executor function.
 */

import { eq } from "drizzle-orm";
import { getDb, tasks, runs, employees } from "@staffroom/db";
import { llm } from "@staffroom/llm";
import type { LLMMessage, LLMContentBlock, LLMTool, LLMConfig } from "@staffroom/llm";
import type { SystemPromptParts } from "./prompts";
import logger from "../lib/logger";

export interface LoopContext {
  taskId: string;
  employeeId: string;
  runId: string;
  businessId: string;
  demoMode: boolean;
}

export type ToolExecutor = (
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: LoopContext
) => Promise<unknown>;

export interface RunLoopOptions {
  ctx: LoopContext;
  llmConfig: LLMConfig & { ollamaBaseUrl?: string | null };
  /** Split prompt: static prefix (cached) + dynamic suffix (uncached). */
  systemPrompt: SystemPromptParts;
  tools: LLMTool[];
  initialMessages: LLMMessage[];
  maxSteps?: number;
  /** Sonnet for supervisor, Haiku for employee — caller decides */
  modelOverride?: string;
  executeTool: ToolExecutor;
}

const BREAK_STATUSES = ["stopped", "stale", "done", "waiting_approval"];

// ─── Model pricing table (USD per token) ─────────────────────────────────────
// Input / output rates for known models. Falls back to Haiku rates if unknown.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-haiku-4-5-20251001":  { input: 0.00000025,  output: 0.00000125 },
  "claude-haiku-3-5":           { input: 0.00000025,  output: 0.00000125 },
  "claude-haiku-3":             { input: 0.00000025,  output: 0.00000125 },
  "claude-sonnet-4-6":          { input: 0.000003,    output: 0.000015   },
  "claude-sonnet-3-7":          { input: 0.000003,    output: 0.000015   },
  "claude-sonnet-3-5":          { input: 0.000003,    output: 0.000015   },
  "claude-opus-4-6":            { input: 0.000015,    output: 0.000075   },
  "claude-opus-4":              { input: 0.000015,    output: 0.000075   },
  // DeepSeek
  "deepseek-chat":              { input: 0.00000027,  output: 0.0000011  },
  "deepseek-reasoner":          { input: 0.00000055,  output: 0.00000219 },
  // Google Gemini
  "gemini-2.5-flash":           { input: 0.00000015,  output: 0.0000006  },
  "gemini-2.5-pro":             { input: 0.00000125,  output: 0.000010   },
  "gemini-2.0-flash":           { input: 0.0000001,   output: 0.0000004  },
  "gemini-1.5-flash":           { input: 0.0000000375,output: 0.00000015 },
  "gemini-1.5-pro":             { input: 0.00000125,  output: 0.000005   },
  // Ollama — local models, no API cost
  "qwen3:8b":                   { input: 0,           output: 0          },
  "qwen2.5:7b":                 { input: 0,           output: 0          },
  "qwen2.5:3b":                 { input: 0,           output: 0          },
  "deepseek-r1:7b":             { input: 0,           output: 0          },
  "deepseek-r1:14b":            { input: 0,           output: 0          },
  "deepseek-r1:32b":            { input: 0,           output: 0          },
  "llama3.1:8b":                { input: 0,           output: 0          },
  "llama3.2:3b":                { input: 0,           output: 0          },
  "mistral:7b":                 { input: 0,           output: 0          },
};

const FALLBACK_PRICING = { input: 0.00000025, output: 0.00000125 };

function tokenCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = MODEL_PRICING[model] ?? FALLBACK_PRICING;
  return inputTokens * rates.input + outputTokens * rates.output;
}

export async function runAgentLoop(opts: RunLoopOptions): Promise<void> {
  const {
    ctx,
    llmConfig,
    systemPrompt,
    tools,
    initialMessages,
    maxSteps = 20,
    modelOverride,
    executeTool,
  } = opts;

  const db = getDb();
  const messages: LLMMessage[] = [...initialMessages];
  const steps: unknown[] = [];
  let totalTokens = 0;
  let totalCost = 0;
  let lastFlushedCost = 0; // tracks what we've already added to employees.budgetUsedUsd
  let stepCount = 0;

  // Load the employee's current budget baseline so we accumulate correctly
  const [empRow] = await db
    .select({ budgetUsedUsd: employees.budgetUsedUsd })
    .from(employees)
    .where(eq(employees.id, ctx.employeeId));
  const budgetBaseline = empRow?.budgetUsedUsd ?? 0;
  let outcomeSummary = "No completion summary was provided; consult the run trace for details.";
  const startedAt = Date.now();

  const model = modelOverride ?? llmConfig.model;

  try {
    for (let i = 0; i < maxSteps; i++) {
      // Re-check task status — owner may have stopped or approved
      const [currentTask] = await db.select().from(tasks).where(eq(tasks.id, ctx.taskId));
      if (!currentTask || BREAK_STATUSES.includes(currentTask.status)) break;

      stepCount++;

      // ── LLM call ──────────────────────────────────────────────────────────────
      const response = await llm({
        provider: llmConfig.provider,
        model,
        maxTokens: 2048,
        system: systemPrompt.static,
        ...(systemPrompt.dynamic ? { systemDynamic: systemPrompt.dynamic } : {}),
        cacheSystemPrompt: llmConfig.provider === "anthropic",
        tools,
        messages,
        ...(llmConfig.ollamaBaseUrl ? { baseUrl: llmConfig.ollamaBaseUrl } : {}),
      });

      totalTokens += response.usage.inputTokens + response.usage.outputTokens;
      totalCost += tokenCost(model, response.usage.inputTokens, response.usage.outputTokens);

      // ── Extract blocks ─────────────────────────────────────────────────────────
      const textBlocks = response.content.filter(
        (b): b is LLMContentBlock & { type: "text" } => b.type === "text"
      );
      const toolBlocks = response.content.filter(
        (b): b is LLMContentBlock & { type: "tool_use" } => b.type === "tool_use"
      );

      if (textBlocks.length > 0) {
        steps.push({
          type: "thought",
          content: textBlocks.map((b) => b.text).join("\n"),
          timestamp: new Date().toISOString(),
        });
      }

      await db.update(runs).set({ steps, totalTokens, costUsd: totalCost }).where(eq(runs.id, ctx.runId));

      // Natural end — no tool calls (e.g. simple chat reply).
      if (response.stopReason === "end_turn" && toolBlocks.length === 0) {
        await db.update(tasks).set({ status: "done", finishedAt: new Date() }).where(eq(tasks.id, ctx.taskId));
        break;
      }

      if (toolBlocks.length === 0) break;

      // ── Tool execution ─────────────────────────────────────────────────────────
      messages.push({ role: "assistant", content: response.content });

      const toolResults: LLMContentBlock[] = [];

      for (const toolCall of toolBlocks) {
        steps.push({
          type: "tool_call",
          toolName: toolCall.name,
          toolArgs: toolCall.input,
          timestamp: new Date().toISOString(),
        });

        const isFinish = toolCall.name === "finish";

        let result: unknown;
        try {
          if (isFinish) {
            // Capture summary and flush steps to DB BEFORE marking task done
            if (typeof toolCall.input.summary === "string") outcomeSummary = toolCall.input.summary;
            const finishResult = { finished: true, summary: toolCall.input.summary };
            steps.push({
              type: "tool_result",
              toolName: toolCall.name,
              content: JSON.stringify(finishResult),
              timestamp: new Date().toISOString(),
            });
            // Flush so polling sees steps before done status is set
            await db.update(runs).set({ steps, totalTokens, costUsd: totalCost }).where(eq(runs.id, ctx.runId));
            result = finishResult;
            // Now mark done
            await executeTool(toolCall.name, toolCall.input, ctx);
          } else {
            result = await executeTool(toolCall.name, toolCall.input, ctx);
          }
        } catch (err) {
          result = { error: (err as Error).message };
          logger.error(`Tool ${toolCall.name} threw`, { taskId: ctx.taskId, error: (err as Error).message });
        }

        if (!isFinish) {
          steps.push({
            type: "tool_result",
            toolName: toolCall.name,
            content: JSON.stringify(result),
            timestamp: new Date().toISOString(),
          });
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: JSON.stringify(result),
        });

        if (!isFinish) {
          await db.update(runs).set({ steps, totalTokens, costUsd: totalCost }).where(eq(runs.id, ctx.runId));
        }

        // Budget update: add this run's cost delta to the employee's rolling monthly total
        await db
          .update(employees)
          .set({ budgetUsedUsd: budgetBaseline + totalCost })
          .where(eq(employees.id, ctx.employeeId));
        lastFlushedCost = totalCost;

        // Break if task status changed (approval, finish, stop)
        const [refreshed] = await db.select().from(tasks).where(eq(tasks.id, ctx.taskId));
        if (refreshed && BREAK_STATUSES.includes(refreshed.status)) break;
      }

      messages.push({ role: "user", content: toolResults });

      // Post-tool check
      const [afterTools] = await db.select().from(tasks).where(eq(tasks.id, ctx.taskId));
      if (afterTools && BREAK_STATUSES.includes(afterTools.status)) break;
    }

  } catch (error) {
    const [failedTask] = await db.select().from(tasks).where(eq(tasks.id, ctx.taskId));
    if (failedTask && ["running", "queued"].includes(failedTask.status)) {
      await db.update(tasks).set({ status: "stopped", finishedAt: new Date() }).where(eq(tasks.id, ctx.taskId));
    }
    outcomeSummary = "Run failed before completion; consult the run trace and server logs for details.";
    throw error;
  } finally {
    // ── Finalise ──────────────────────────────────────────────────────────────
    const durationMs = Date.now() - startedAt;

    // Append a final step so the Chat UI can render the outcome summary
    const [checkTask] = await db.select().from(tasks).where(eq(tasks.id, ctx.taskId));
    const finalStatus = checkTask?.status ?? "stale";
    if (finalStatus === "done") {
      steps.push({ type: "final", content: outcomeSummary, timestamp: new Date().toISOString() });
    }

    // Save checkpoint when pausing for approval so the loop can resume
    const checkpoint = finalStatus === "waiting_approval" ? messages : null;

    await db
      .update(runs)
      .set({ steps, totalTokens, costUsd: totalCost, durationMs, messagesJson: checkpoint })
      .where(eq(runs.id, ctx.runId));

    // Flush any remaining cost not yet added (e.g. run ended without tool calls)
    if (totalCost > lastFlushedCost) {
      await db
        .update(employees)
        .set({ budgetUsedUsd: budgetBaseline + totalCost })
        .where(eq(employees.id, ctx.employeeId));
    }

    const [finalTask] = await db.select().from(tasks).where(eq(tasks.id, ctx.taskId));
    if (finalTask && ["running", "queued"].includes(finalTask.status)) {
      await db.update(tasks).set({ status: "stale", finishedAt: new Date() }).where(eq(tasks.id, ctx.taskId));
      logger.warn("Task hit step limit, marked stale", { taskId: ctx.taskId, steps: stepCount });
    }
  }
}
