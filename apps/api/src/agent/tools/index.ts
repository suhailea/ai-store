/**
 * Native tool central registry.
 *
 * Aggregates all provider tool arrays into a single flat Map keyed by
 * "provider/toolName". Exposes three public functions used by the rest
 * of the app:
 *
 *   getNativeToolDefs(provider)              — LLMTool schemas for a provider
 *   executeNativeTool(provider, name, args, ctx) — run a tool by coordinates
 *   isNativeToolReadOnly(provider, name)     — check readOnly for approval gate
 *
 * To add a new provider: import its tool array and spread it into ALL_TOOLS.
 */

import type { LLMTool } from "@staffroom/llm";
import type { NativeTool, ToolContext } from "./types";
import { gmailTools } from "./gmail/index";
import { gcalTools } from "./gcal/index";
import { gdriveTools } from "./google_drive/index";
import { gsheetsTools } from "./google_sheets/index";
import { postgresTools } from "./postgres/index";
import { excelTools } from "./excel/index";

/** Providers handled natively (not via MCP). Add new providers here. */
const NATIVE_PROVIDERS = new Set(["gmail", "google_calendar", "google_drive", "google_sheets", "postgres", "excel"]);

// ─── Registry build ───────────────────────────────────────────────────────────

const ALL_TOOLS: NativeTool[] = [
  ...gmailTools,
  ...gcalTools,
  ...gdriveTools,
  ...gsheetsTools,
  ...postgresTools,
  ...excelTools,
];

/** Flat map: "provider/toolName" → NativeTool */
const REGISTRY = new Map<string, NativeTool>(
  ALL_TOOLS.map((tool) => [`${tool.provider}/${tool.toolName}`, tool])
);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return LLMTool schemas for all tools belonging to a provider.
 * Used to surface tool definitions to the LLM.
 */
export function getNativeToolDefs(provider: string): LLMTool[] {
  return ALL_TOOLS
    .filter((tool) => tool.provider === provider)
    .map((tool) => tool.schema);
}

/**
 * Execute a native tool by provider + toolName.
 * Throws if the tool is not registered.
 */
export async function executeNativeTool(
  provider: string,
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const key = `${provider}/${toolName}`;
  const tool = REGISTRY.get(key);

  if (!tool) {
    throw new Error(`Native tool not found: ${key}`);
  }

  return tool.execute(args, ctx);
}

/** True if this provider is handled natively (not via MCP). */
export function isNativeProvider(provider: string): boolean {
  return NATIVE_PROVIDERS.has(provider);
}

/**
 * Return whether a native tool is read-only.
 * Used by the approval gate — false means the tool requires owner approval.
 * Returns true (safe default) if the tool is not registered.
 */
export function isNativeToolReadOnly(provider: string, toolName: string): boolean {
  const tool = REGISTRY.get(`${provider}/${toolName}`);
  return tool?.readOnly ?? true;
}

/**
 * Validate that all required fields for a native tool are present in args.
 * Returns a string error message if invalid, undefined if valid.
 */
export function validateNativeToolArgs(provider: string, toolName: string, args: Record<string, unknown>): string | undefined {
  const tool = REGISTRY.get(`${provider}/${toolName}`);
  if (!tool) return undefined;
  const required = (tool.schema.input_schema as { required?: string[] }).required ?? [];
  const missing = required.filter((key) => args[key] === undefined || args[key] === null || args[key] === "");
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(", ")}`;
  }
  return undefined;
}
