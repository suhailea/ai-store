/**
 * Native tool interface — tools implemented directly via provider REST APIs
 * rather than through MCP servers.
 *
 * Each tool file exports a single NativeTool object. The central registry
 * (index.ts) aggregates them and exposes the unified execution interface.
 */

import type { LLMTool } from "@staffroom/llm";

export interface NativeTool {
  /** Provider identifier, e.g. "gmail" */
  provider: string;
  /** Tool name shown to the LLM, e.g. "list_emails" */
  toolName: string;
  /** false = write action, requires owner approval before execution */
  readOnly: boolean;
  /** Tool definition passed to the LLM */
  schema: LLMTool;
  /** Execute the tool and return its result */
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  businessId: string;
  employeeId: string;
}
