// ─── Provider identifiers ─────────────────────────────────────────────────────
// ─── Model lists ──────────────────────────────────────────────────────────────
export const ANTHROPIC_MODELS = [
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast, cheap)" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanced)" },
    { id: "claude-opus-4-6", label: "Claude Opus 4.6 (most capable)" },
];
export const DEEPSEEK_MODELS = [
    { id: "deepseek-chat", label: "DeepSeek Chat (V3)" },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner (R1)" },
];
export const OPENROUTER_FREE_MODELS = [
    { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (free)" },
    { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B A4B (free)" },
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra 550B (free)" },
    { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super 120B (free)" },
    { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", label: "Nemotron 3 Nano Omni 30B (free)" },
    { id: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning (free)" },
    { id: "poolside/laguna-s-2.1:free", label: "Laguna S 2.1 (free)" },
    { id: "apodex/apodex-1.1-mini:free", label: "Apodex 1.1 Mini (free)" },
];
export const GEMINI_MODELS = [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (fast, cheap)" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (most capable)" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
];
export const OLLAMA_MODELS = [
    { id: "deepseek-r1:7b", label: "DeepSeek R1 7B" },
    { id: "deepseek-r1:14b", label: "DeepSeek R1 14B" },
    { id: "deepseek-r1:32b", label: "DeepSeek R1 32B" },
    { id: "llama3.2:3b", label: "Llama 3.2 3B" },
    { id: "llama3.1:8b", label: "Llama 3.1 8B" },
    { id: "mistral:7b", label: "Mistral 7B" },
    { id: "qwen2.5:7b", label: "Qwen 2.5 7B" },
];
// ─── Default config ───────────────────────────────────────────────────────────
export const DEFAULT_LLM_CONFIG = {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
};
