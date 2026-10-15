export type {
  LLMProvider,
  LLMConfig,
  LLMRequest,
  LLMResponse,
  LLMMessage,
  LLMContentBlock,
  LLMTextBlock,
  LLMToolUseBlock,
  LLMToolResultBlock,
  LLMTool,
} from "./types";

export {
  ANTHROPIC_MODELS,
  DEEPSEEK_MODELS,
  GEMINI_MODELS,
  OLLAMA_MODELS,
  OPENROUTER_FREE_MODELS,
  DEFAULT_LLM_CONFIG,
} from "./types";

import { callViaOpenRouter } from "./providers/openrouter";
import { callOllama } from "./providers/ollama";
import type { LLMRequest, LLMResponse } from "./types";

const RETRY_DELAYS_MS = [2000, 5000, 15000]; // 3 attempts after initial failure

function is429(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("Rate limit");
}

/**
 * Unified LLM gateway.
 *
 * Two dispatch paths:
 *   - "ollama"  → local Ollama instance (direct OpenAI-compat call)
 *   - everything else → OpenRouter universal gateway
 *     (handles anthropic, gemini, deepseek, openrouter — model ID mapping,
 *      per-provider API key routing, and Anthropic prompt caching passthrough)
 *
 * Automatically retries on 429 rate-limit errors with exponential backoff.
 */
export async function llm(req: LLMRequest): Promise<LLMResponse> {
  const call = () =>
    req.provider === "ollama"
      ? callOllama(req)
      : callViaOpenRouter(req, req.provider);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await call();
    } catch (err) {
      lastErr = err;
      if (!is429(err) || attempt === RETRY_DELAYS_MS.length) break;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastErr;
}

/**
 * Test connectivity to a provider — returns true if reachable.
 * Used by the Settings page "Test connection" button.
 */
export async function testLLMConnection(
  provider: LLMRequest["provider"],
  model: string,
  options: { apiKey?: string; baseUrl?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
  try {
    await llm({
      provider,
      model,
      system: "You are a helpful assistant.",
      messages: [{ role: "user", content: "Say OK" }],
      maxTokens: 10,
      ...options,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
