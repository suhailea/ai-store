/**
 * Unified cloud LLM gateway.
 *
 * Routes to the correct provider endpoint based on sourceProvider:
 *   - anthropic  → api.anthropic.com (via Anthropic SDK compatible OpenAI wrapper)
 *   - gemini     → generativelanguage.googleapis.com/v1beta/openai
 *   - deepseek   → api.deepseek.com
 *   - openrouter → openrouter.ai/api/v1  (for free/paid OR models)
 *
 * All providers use the same OpenAI-compatible message format and tool schema.
 * Anthropic prompt caching is handled natively by the Anthropic SDK when
 * sourceProvider === "anthropic".
 *
 * Ollama is NOT handled here — it goes through providers/ollama.ts (local-only).
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { LLMProvider, LLMRequest, LLMResponse, LLMContentBlock } from "../types";

// ─── Provider endpoint config ─────────────────────────────────────────────────

const PROVIDER_CONFIG: Record<
  Exclude<LLMProvider, "ollama">,
  { baseURL: string; envKey: string; defaultHeaders?: Record<string, string> }
> = {
  anthropic: {
    baseURL: "https://api.anthropic.com/v1",
    envKey: "ANTHROPIC_API_KEY",
  },
  gemini: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    envKey: "GEMINI_API_KEY",
  },
  deepseek: {
    baseURL: "https://api.deepseek.com",
    envKey: "DEEPSEEK_API_KEY",
  },
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    defaultHeaders: {
      "HTTP-Referer": "https://staffroom.app",
      "X-Title": "Staffroom",
    },
  },
};

// ─── Anthropic native path (supports prompt caching) ─────────────────────────

async function callAnthropic(req: LLMRequest): Promise<LLMResponse> {
  const client = new Anthropic({ apiKey: req.apiKey ?? process.env.ANTHROPIC_API_KEY });

  // Build system param — array form enables cache_control
  type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
  let system: string | SystemBlock[];

  if (req.cacheSystemPrompt) {
    const blocks: SystemBlock[] = [
      { type: "text", text: req.system, cache_control: { type: "ephemeral" } },
    ];
    if (req.systemDynamic) blocks.push({ type: "text", text: req.systemDynamic });
    system = blocks;
  } else {
    system = req.system + (req.systemDynamic ? `\n\n${req.systemDynamic}` : "");
  }

  const tools: Anthropic.Tool[] | undefined = req.tools?.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool["input_schema"],
  }));

  const response = await client.messages.create({
    model: req.model,
    max_tokens: req.maxTokens ?? 2048,
    system: system as string, // SDK accepts string or array
    messages: req.messages as Anthropic.MessageParam[],
    ...(tools && tools.length > 0 ? { tools } : {}),
  });

  const content: LLMContentBlock[] = response.content.map((block) => {
    if (block.type === "text") return { type: "text", text: block.text };
    return {
      type: "tool_use",
      id: block.id,
      name: block.name,
      input: block.input as Record<string, unknown>,
    };
  });

  const stopReason =
    response.stop_reason === "tool_use"  ? "tool_use"
    : response.stop_reason === "max_tokens" ? "max_tokens"
    : "end_turn";

  return {
    content,
    stopReason,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

// ─── OpenAI-compatible path (Gemini, DeepSeek, OpenRouter) ───────────────────

function buildOpenAIMessages(req: LLMRequest): OpenAI.Chat.ChatCompletionMessageParam[] {
  const systemContent = req.system + (req.systemDynamic ? `\n\n${req.systemDynamic}` : "");
  return [
    { role: "system", content: systemContent },
    ...req.messages.map((m) => {
      // String content — pass through directly
      if (typeof m.content === "string") {
        return { role: m.role, content: m.content } as OpenAI.Chat.ChatCompletionMessageParam;
      }

      const parts = m.content;

      // User message containing tool_result blocks → OpenAI "tool" role messages
      const toolResultParts = parts.filter((p) => p.type === "tool_result");
      if (toolResultParts.length > 0) {
        return toolResultParts.map((p) => ({
          role: "tool" as const,
          tool_call_id: (p as { tool_use_id: string }).tool_use_id,
          content: (p as { content: string }).content,
        }));
      }

      // Assistant message containing tool_use blocks → OpenAI assistant with tool_calls
      const toolUseParts = parts.filter((p) => p.type === "tool_use");
      if (m.role === "assistant" && toolUseParts.length > 0) {
        const textParts = parts.filter((p) => p.type === "text");
        return {
          role: "assistant" as const,
          content: textParts.length > 0
            ? textParts.map((p) => (p as { text: string }).text).join("\n")
            : null,
          tool_calls: toolUseParts.map((p) => {
            const block = p as { id: string; name: string; input: Record<string, unknown> };
            return {
              id: block.id,
              type: "function" as const,
              function: {
                name: block.name,
                // Serialize args — JSON.stringify ensures no raw control characters
                arguments: JSON.stringify(block.input),
              },
            };
          }),
        } as OpenAI.Chat.ChatCompletionMessageParam;
      }

      // Regular text-only message
      const text = parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { text: string }).text)
        .join("\n");
      return { role: m.role, content: text } as OpenAI.Chat.ChatCompletionMessageParam;
    }).flat(),
  ];
}

async function callOpenAICompat(
  req: LLMRequest,
  sourceProvider: Exclude<LLMProvider, "ollama" | "anthropic">
): Promise<LLMResponse> {
  const cfg = PROVIDER_CONFIG[sourceProvider];
  const client = new OpenAI({
    apiKey: req.apiKey ?? process.env[cfg.envKey] ?? "no-key",
    baseURL: cfg.baseURL,
    defaultHeaders: cfg.defaultHeaders,
  });

  const messages = buildOpenAIMessages(req);
  const tools: OpenAI.Chat.ChatCompletionTool[] | undefined = req.tools?.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));

  let response: OpenAI.Chat.ChatCompletion;
  try {
    response = await client.chat.completions.create({
      model: req.model,
      max_tokens: req.maxTokens ?? 2048,
      messages,
      ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" as const } : {}),
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; error?: unknown };
    throw new Error(
      `[${sourceProvider}] API error ${e.status ?? "?"}: ${e.message ?? String(err)}` +
      (e.error ? ` — ${JSON.stringify(e.error)}` : "")
    );
  }

  const choice = response.choices[0];
  const msg = choice.message;
  const content: LLMContentBlock[] = [];

  if (msg.content) content.push({ type: "text", text: msg.content });

  for (const toolCall of msg.tool_calls ?? []) {
    content.push({
      type: "tool_use",
      id: toolCall.id,
      name: toolCall.function.name,
      input: JSON.parse(toolCall.function.arguments || "{}"),
    });
  }

  const stopReason =
    choice.finish_reason === "tool_calls" ? "tool_use"
    : choice.finish_reason === "length"   ? "max_tokens"
    : "end_turn";

  return {
    content,
    stopReason,
    usage: {
      inputTokens:  response.usage?.prompt_tokens     ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function callViaOpenRouter(req: LLMRequest, sourceProvider: LLMProvider): Promise<LLMResponse> {
  if (sourceProvider === "anthropic") return callAnthropic(req);
  return callOpenAICompat(req, sourceProvider as Exclude<LLMProvider, "ollama" | "anthropic">);
}
