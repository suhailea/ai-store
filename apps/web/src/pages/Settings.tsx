import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { settingsApi } from "@/lib/api";
import {
  Settings as SettingsIcon,
  Bot,
  Cpu,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
// ─── Model lists (mirrored from packages/llm/src/types.ts) ───────────────────

const ANTHROPIC_MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast, cheap)" },
  { id: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6 (balanced)" },
  { id: "claude-opus-4-6",           label: "Claude Opus 4.6 (most capable)" },
];

const DEEPSEEK_MODELS = [
  { id: "deepseek-chat",     label: "DeepSeek Chat (V3)" },
  { id: "deepseek-reasoner", label: "DeepSeek Reasoner (R1)" },
];

const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (fast, cheap)" },
  { id: "gemini-2.5-pro",   label: "Gemini 2.5 Pro (most capable)" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { id: "gemini-1.5-pro",   label: "Gemini 1.5 Pro" },
];

const OLLAMA_MODELS = [
  { id: "qwen3:8b",        label: "Qwen 3 8B (recommended)" },
  { id: "qwen2.5:7b",      label: "Qwen 2.5 7B" },
  { id: "qwen2.5:3b",      label: "Qwen 2.5 3B (fast)" },
  { id: "deepseek-r1:7b",  label: "DeepSeek R1 7B" },
  { id: "deepseek-r1:14b", label: "DeepSeek R1 14B" },
  { id: "deepseek-r1:32b", label: "DeepSeek R1 32B" },
  { id: "llama3.2:3b",     label: "Llama 3.2 3B" },
  { id: "llama3.1:8b",     label: "Llama 3.1 8B" },
  { id: "mistral:7b",      label: "Mistral 7B" },
];

// ─── Tokens (inline, matches CSS vars) ────────────────────────────────────────

const C = {
  ink: "#101828",
  inkSecondary: "#475467",
  inkMuted: "#667085",
  icon: "#8a94a6",
  surface: "#fff",
  surfaceSubtle: "#f7f8fa",
  surfaceSunken: "#eef1f4",
  line: "#e4e7ec",
  lineStrong: "#d0d5dd",
  controlBorder: "#8a94a6",
  brand: "#0f5b6c",
  brandSoft: "#e6f2f4",
  brandHover: "#0b4a58",
  successFg: "#157f4f",
  successBg: "#e8f6ee",
  warningFg: "#b45309",
  warningBg: "#fef4e4",
  dangerFg: "#c0362c",
  dangerBg: "#fdecea",
};

const OPENROUTER_MODELS = [
  { id: "google/gemma-4-31b-it:free",                         label: "Gemma 4 31B (free)" },
  { id: "google/gemma-4-26b-a4b-it:free",                     label: "Gemma 4 26B A4B (free)" },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free",             label: "Nemotron 3 Ultra 550B (free)" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free",             label: "Nemotron 3 Super 120B (free)" },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", label: "Nemotron 3 Nano Omni 30B (free)" },
  { id: "nvidia/nemotron-3.5-lightning:free",                 label: "Nemotron 3.5 Lightning (free)" },
  { id: "poolside/laguna-s-2.1:free",                         label: "Laguna S 2.1 (free)" },
  { id: "apodex/apodex-1.1-mini:free",                        label: "Apodex 1.1 Mini (free)" },
];

type LLMProvider = "anthropic" | "deepseek" | "gemini" | "ollama" | "openrouter";

const PROVIDERS: { id: LLMProvider; label: string; description: string }[] = [
  { id: "anthropic",   label: "Anthropic",   description: "Claude models — best reasoning and tool use" },
  { id: "deepseek",    label: "DeepSeek",    description: "DeepSeek Chat / Reasoner — cost-efficient" },
  { id: "gemini",      label: "Google Gemini", description: "Gemini 2.5 Flash/Pro — fast and multimodal" },
  { id: "openrouter",  label: "OpenRouter",  description: "Free & paid models — Llama, Gemma, Mistral, DeepSeek" },
  { id: "ollama",      label: "Ollama",      description: "Local models via Ollama — private, no API key" },
];

const MODEL_LISTS: Record<LLMProvider, { id: string; label: string }[]> = {
  anthropic:  ANTHROPIC_MODELS  as unknown as { id: string; label: string }[],
  deepseek:   DEEPSEEK_MODELS   as unknown as { id: string; label: string }[],
  gemini:     GEMINI_MODELS     as unknown as { id: string; label: string }[],
  openrouter: OPENROUTER_MODELS as unknown as { id: string; label: string }[],
  ollama:     OLLAMA_MODELS     as unknown as { id: string; label: string }[],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.line}`,
      borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
      overflow: "hidden",
    }}>
      {children}
    </div>
  );
}

function SCardHeader({ icon, title, subtitle }: {
  icon: React.ReactNode; title: string; subtitle?: string;
}) {
  return (
    <div style={{
      padding: "16px 20px", borderBottom: `1px solid ${C.line}`,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: C.brandSoft, color: C.brand,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.ink, margin: 0, lineHeight: "22px" }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 13, color: C.inkMuted, margin: 0, lineHeight: "18px" }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function FormRow({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "280px 1fr",
      gap: 24, padding: "20px 24px", alignItems: "start",
      borderBottom: `1px solid ${C.line}`,
    }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 4px" }}>{label}</p>
        {hint && <p style={{ fontSize: 13, color: C.inkMuted, margin: 0, lineHeight: "18px" }}>{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function StyledSelect({
  value, onChange, children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", height: 38, padding: "0 36px 0 12px",
          border: `1px solid ${C.controlBorder}`, borderRadius: 8,
          background: C.surface, color: C.ink, fontSize: 14,
          appearance: "none", cursor: "pointer", outline: "none",
          boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
        }}
      >
        {children}
      </select>
      <ChevronDown
        size={16} strokeWidth={1.75}
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: C.icon, pointerEvents: "none" }}
      />
    </div>
  );
}

function StyledInput({
  value, onChange, placeholder, type = "text", disabled,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: "100%", height: 38, padding: "0 12px",
        border: `1px solid ${C.controlBorder}`, borderRadius: 8,
        background: disabled ? C.surfaceSubtle : C.surface,
        color: C.ink, fontSize: 14, outline: "none",
        boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
        boxSizing: "border-box",
      }}
    />
  );
}

function ProviderCard({
  provider, selected, onSelect,
}: {
  provider: typeof PROVIDERS[0]; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        flex: 1, minWidth: 140, padding: "14px 16px", borderRadius: 10, cursor: "pointer",
        border: selected ? `2px solid ${C.brand}` : `1px solid ${C.line}`,
        background: selected ? C.brandSoft : C.surface,
        textAlign: "left", outline: "none",
        boxShadow: selected ? "none" : "0 1px 2px rgba(16,24,40,0.05)",
        transition: "border-color 0.12s, background 0.12s",
      }}
    >
      <p style={{ fontSize: 14, fontWeight: 600, color: selected ? C.brand : C.ink, margin: "0 0 4px" }}>
        {provider.label}
      </p>
      <p style={{ fontSize: 12, color: C.inkMuted, margin: 0, lineHeight: "16px" }}>
        {provider.description}
      </p>
    </button>
  );
}

// ─── Test result banner ────────────────────────────────────────────────────────

type TestState = "idle" | "loading" | "success" | "error";

function TestBanner({ state, error }: { state: TestState; error?: string }) {
  if (state === "idle") return null;
  if (state === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 14px", borderRadius: 8, background: C.surfaceSubtle, border: `1px solid ${C.line}` }}>
        <Loader2 size={16} strokeWidth={1.75} style={{ color: C.brand, animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, color: C.inkMuted }}>Sending test message…</span>
      </div>
    );
  }
  if (state === "success") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 14px", borderRadius: 8, background: C.successBg, border: `1px solid ${C.successFg}20` }}>
        <CheckCircle size={16} strokeWidth={1.75} style={{ color: C.successFg, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: C.successFg, fontWeight: 500 }}>Connection successful — model responded correctly.</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, padding: "10px 14px", borderRadius: 8, background: C.dangerBg, border: `1px solid ${C.dangerFg}20` }}>
      <XCircle size={16} strokeWidth={1.75} style={{ color: C.dangerFg, flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 13, color: C.dangerFg }}>{error ?? "Connection failed."}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [provider, setProvider]     = useState<LLMProvider>("anthropic");
  const [model, setModel]           = useState("");
  const [ollamaUrl, setOllamaUrl]   = useState("");
  const [apiKey, setApiKey]         = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [testState, setTestState]   = useState<TestState>("idle");
  const [testError, setTestError]   = useState("");
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    settingsApi.get().then((data) => {
      setProvider((data.llmProvider as LLMProvider) ?? "anthropic");
      setModel(data.llmModel ?? "");
      setOllamaUrl(data.ollamaBaseUrl ?? "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // When provider changes, default the model to first in list
  function handleProviderChange(p: LLMProvider) {
    setProvider(p);
    setModel(MODEL_LISTS[p][0]?.id ?? "");
    setTestState("idle");
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await settingsApi.update({
        llmProvider: provider,
        llmModel: model,
        ollamaBaseUrl: provider === "ollama" ? ollamaUrl || null : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTestState("loading");
    setTestError("");
    try {
      const result = await settingsApi.testLlm({
        provider,
        model,
        ...((provider === "anthropic" || provider === "deepseek" || provider === "gemini" || provider === "openrouter") && apiKey ? { apiKey } : {}),
        ...(provider === "ollama" && ollamaUrl ? { baseUrl: ollamaUrl } : {}),
      });
      setTestState(result.success ? "success" : "error");
      if (!result.success) setTestError(result.error ?? "Connection failed.");
    } catch (err) {
      setTestState("error");
      setTestError(err instanceof Error ? err.message : "Connection failed.");
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader
          title="Settings"
          subtitle="Configure your AI workforce preferences"
          breadcrumbs={[{ label: "Settings" }]}
        />
        <div style={{ padding: "40px 32px", display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.inkMuted, fontSize: 14 }}>
            <Loader2 size={16} strokeWidth={1.75} style={{ animation: "spin 1s linear infinite" }} />
            Loading settings…
          </div>
        </div>
      </AppShell>
    );
  }

  const models = MODEL_LISTS[provider] ?? [];

  return (
    <AppShell>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <PageHeader
        title="Settings"
        subtitle="Configure your AI workforce preferences"
        breadcrumbs={[{ label: "Settings" }]}
      />

      <div style={{ padding: "24px 32px 48px", maxWidth: 900 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* LLM Configuration card */}
          <SCard>
            <SCardHeader
              icon={<Bot size={20} strokeWidth={1.75} />}
              title="AI model"
              subtitle="The model your employees use to think, plan, and work."
            />

            {/* Provider selector */}
            <FormRow
              label="Provider"
              hint="Choose where your AI runs. Anthropic is recommended for best results."
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {PROVIDERS.map((p) => (
                  <ProviderCard
                    key={p.id}
                    provider={p}
                    selected={provider === p.id}
                    onSelect={() => handleProviderChange(p.id)}
                  />
                ))}
              </div>
            </FormRow>

            {/* Model selector */}
            <FormRow
              label="Model"
              hint="Supervisors always use Sonnet. This sets the default for employee agents."
            >
              <StyledSelect value={model} onChange={setModel}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
                {models.length === 0 && <option value="">No models listed — type a model ID below</option>}
              </StyledSelect>
            </FormRow>

            {/* API Key — Anthropic, DeepSeek, Gemini, or OpenRouter */}
            {(provider === "anthropic" || provider === "deepseek" || provider === "gemini" || provider === "openrouter") && (
              <FormRow
                label="API key"
                hint="Stored securely server-side. Leave blank to keep the existing key."
              >
                <StyledInput
                  type="password"
                  value={apiKey}
                  onChange={setApiKey}
                  placeholder="sk-…  (leave blank to keep existing)"
                />
              </FormRow>
            )}

            {/* Ollama base URL */}
            {provider === "ollama" && (
              <FormRow
                label="Ollama base URL"
                hint="URL where Ollama is running. Default: http://localhost:11434"
              >
                <StyledInput
                  value={ollamaUrl}
                  onChange={setOllamaUrl}
                  placeholder="http://localhost:11434"
                />
              </FormRow>
            )}

            {/* Test + Save */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={testConnection}
                  disabled={testState === "loading"}
                  style={{
                    height: 38, padding: "0 16px", borderRadius: 8,
                    border: `1px solid ${C.lineStrong}`, background: C.surface,
                    color: C.ink, fontSize: 14, fontWeight: 600,
                    cursor: testState === "loading" ? "not-allowed" : "pointer",
                    opacity: testState === "loading" ? 0.6 : 1,
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  <Cpu size={16} strokeWidth={1.75} color={C.icon} />
                  {testState === "loading" ? "Testing…" : "Test connection"}
                </button>

                <button
                  onClick={save}
                  disabled={saving}
                  style={{
                    height: 38, padding: "0 20px", borderRadius: 8,
                    border: "none", background: saved ? C.successFg : C.brand,
                    color: "#fff", fontSize: 14, fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                    display: "flex", alignItems: "center", gap: 8,
                    transition: "background 0.15s",
                  }}
                >
                  {saving ? (
                    <><Loader2 size={16} strokeWidth={1.75} style={{ animation: "spin 1s linear infinite" }} /> Saving…</>
                  ) : saved ? (
                    <><CheckCircle size={16} strokeWidth={1.75} /> Saved</>
                  ) : (
                    "Save settings"
                  )}
                </button>
              </div>

              <TestBanner state={testState} error={testError} />
            </div>
          </SCard>

          {/* Workspace card (read-only info) */}
          <SCard>
            <SCardHeader
              icon={<SettingsIcon size={20} strokeWidth={1.75} />}
              title="Workspace"
              subtitle="Your business and account details."
            />
            <div style={{ padding: "20px 24px" }}>
              <p style={{ fontSize: 13, color: C.inkMuted, margin: 0, lineHeight: "18px" }}>
                To update your business name, industry, billing, or team members, contact support.
                More workspace settings are coming soon.
              </p>
            </div>
          </SCard>

        </div>
      </div>
    </AppShell>
  );
}
