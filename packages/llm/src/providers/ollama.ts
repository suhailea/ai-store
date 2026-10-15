/**
 * Ollama provider — local models via Ollama's OpenAI-compatible API.
 * Ollama exposes http://localhost:11434/v1 which is OpenAI-compatible.
 * No API key needed for local use.
 */

import OpenAI from "openai";
import type { LLMRequest, LLMResponse, LLMContentBlock } from "../types";

export async function callOllama(req: LLMRequest): Promise<LLMResponse> {
  const baseURL = `${req.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/v1`;

  const client = new OpenAI({
    apiKey: "ollama", // Ollama ignores the key but the SDK requires a non-empty value
    baseURL,
  });

  // Same message conversion as DeepSeek (OpenAI-compatible)
  // Combine static + dynamic system parts — Ollama has no native caching
  const systemContent = req.system + (req.systemDynamic ? `\n\n${req.systemDynamic}` : "");
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...req.messages.map((m) => {
      if (typeof m.content === "string") {
        return { role: m.role, content: m.content } as OpenAI.Chat.ChatCompletionMessageParam;
      }

      const parts = m.content;

      // User message with tool results → OpenAI "tool" role messages
      const toolResultParts = parts.filter((p) => p.type === "tool_result");
      if (toolResultParts.length > 0) {
        return toolResultParts.map((p) => ({
          role: "tool" as const,
          tool_call_id: (p as { tool_use_id: string }).tool_use_id,
          content: (p as { content: string }).content,
        }));
      }

      // Assistant message with tool_use blocks → OpenAI assistant with tool_calls
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
              function: { name: block.name, arguments: JSON.stringify(block.input) },
            };
          }),
        } as OpenAI.Chat.ChatCompletionMessageParam;
      }

      const textParts = parts.filter((p) => p.type === "text");
      return {
        role: m.role,
        content: textParts.map((p) => (p as { text: string }).text).join("\n"),
      } as OpenAI.Chat.ChatCompletionMessageParam;
    }).flat(),
  ];

  const tools: OpenAI.Chat.ChatCompletionTool[] | undefined = req.tools?.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));

  const response = await client.chat.completions.create({
    model: req.model,
    max_tokens: req.maxTokens ?? 2048,
    messages,
    ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" as const } : {}),
  });

  const choice = response.choices[0];
  const msg = choice.message;
  const content: LLMContentBlock[] = [];

  if (msg.content) {
    content.push({ type: "text", text: msg.content });
  }

  for (const toolCall of msg.tool_calls ?? []) {
    content.push({
      type: "tool_use",
      id: toolCall.id,
      name: toolCall.function.name,
      input: JSON.parse(toolCall.function.arguments || "{}"),
    });
  }

  const stopReason = choice.finish_reason === "tool_calls"
    ? "tool_use"
    : choice.finish_reason === "length"
    ? "max_tokens"
    : "end_turn";

  return {
    content,
    stopReason,
    usage: {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}
