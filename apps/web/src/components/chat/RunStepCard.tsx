import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { RunStep } from "@staffroom/types";
import {
  Brain,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const C = {
  ink: "#101828",
  inkSecondary: "#475467",
  icon: "#8a94a6",
  surface: "#fff",
  surfaceSubtle: "#f7f8fa",
  surfaceSunken: "#eef1f4",
  line: "#e4e7ec",
  brand: "#0f5b6c",
  brandSoft: "#e6f2f4",
};

function StepIcon({ type }: { type: string }) {
  const size = 14;
  const sw = 1.75;
  if (type === "thought")     return <Brain size={size} strokeWidth={sw} />;
  if (type === "tool_call")   return <ArrowRight size={size} strokeWidth={sw} />;
  if (type === "tool_result") return <CheckCircle size={size} strokeWidth={sw} />;
  if (type === "final")       return <CheckCircle2 size={size} strokeWidth={sw} />;
  return <Brain size={size} strokeWidth={sw} />;
}

const STEP_COLORS: Record<string, { bg: string; fg: string }> = {
  thought:     { bg: "#efedfb", fg: "#5e4bc4" },
  tool_call:   { bg: "#e0f2fe", fg: "#0284c7" },
  tool_result: { bg: "#e6f5ee", fg: "#17774f" },
  final:       { bg: C.brandSoft, fg: C.brand },
};

export function RunStepCard({ step, index }: { step: RunStep; index: number }) {
  const [open, setOpen] = useState(index < 2);
  const colors = STEP_COLORS[step.type] ?? STEP_COLORS.thought;

  const label =
    step.type === "thought"     ? "Reasoning"  :
    step.type === "tool_call"   ? (step.toolName ?? "Tool call") :
    step.type === "tool_result" ? (step.toolName ? `${step.toolName} result` : "Result") :
    "Final";

  const hasBody = !!(step.content || (step.toolArgs && Object.keys(step.toolArgs).length > 0));

  return (
    <div style={{
      border: `1px solid ${C.line}`, borderRadius: 8,
      overflow: "hidden", marginBottom: 6,
    }}>
      <button
        onClick={() => hasBody && setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "8px 10px",
          background: open ? colors.bg : C.surfaceSubtle,
          border: "none", cursor: hasBody ? "pointer" : "default",
          textAlign: "left", transition: "background 120ms",
        }}
      >
        <span style={{
          width: 22, height: 22, borderRadius: "9999px",
          background: colors.bg, color: colors.fg, border: `1px solid ${C.line}`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <StepIcon type={step.type} />
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: C.inkSecondary }}>
          {label}
        </span>
        {hasBody && (
          open
            ? <ChevronDown size={13} strokeWidth={1.75} color={C.icon} />
            : <ChevronRight size={13} strokeWidth={1.75} color={C.icon} />
        )}
      </button>

      {open && hasBody && (
        <div style={{ padding: "8px 10px", background: C.surface, borderTop: `1px solid ${C.line}` }}>
          {step.content && (
            <div style={{ fontSize: 13, color: C.inkSecondary, lineHeight: "20px", wordBreak: "break-word" }}>
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p style={{ margin: "0 0 6px" }}>{children}</p>,
                  ul: ({ children }) => <ul style={{ margin: "2px 0 6px", paddingLeft: 18 }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ margin: "2px 0 6px", paddingLeft: 18 }}>{children}</ol>,
                  li: ({ children }) => <li style={{ margin: "1px 0" }}>{children}</li>,
                  strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                  code: ({ children }) => <code style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 11, background: C.surfaceSunken, padding: "1px 4px", borderRadius: 3 }}>{children}</code>,
                }}
              >
                {step.content}
              </ReactMarkdown>
            </div>
          )}
          {step.toolArgs && Object.keys(step.toolArgs).length > 0 && step.type === "tool_call" && (
            <pre style={{
              marginTop: step.content ? 6 : 0,
              fontSize: 12, fontFamily: '"JetBrains Mono",monospace',
              background: C.surfaceSunken, borderRadius: 6,
              padding: "6px 10px", overflowX: "auto",
              color: C.inkSecondary, whiteSpace: "pre-wrap",
              border: `1px solid ${C.line}`, margin: 0,
            }}>
              {JSON.stringify(step.toolArgs, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
