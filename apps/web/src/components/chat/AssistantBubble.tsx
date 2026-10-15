import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { RunStep } from "@staffroom/types";
import {
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Square,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { EmpAvatar } from "../EmpAvatar";
import { timeAgo } from "../../lib/emp";
import { RunStepCard } from "./RunStepCard";
import type { ChatMessage } from "../../pages/Chat";

const C = {
  ink: "#101828",
  inkSecondary: "#475467",
  inkMuted: "#667085",
  surface: "#fff",
  surfaceSubtle: "#f7f8fa",
  surfaceSunken: "#eef1f4",
  line: "#e4e7ec",
  lineStrong: "#d0d5dd",
  brand: "#0f5b6c",
  warningFg: "#b45309",
  warningBg: "#fef4e4",
  dangerFg: "#c0362c",
  dangerBg: "#fdecea",
};

const FALLBACK_SUMMARIES = [
  "No completion summary was provided",
  "Run ended with status",
  "Run failed before completion",
];
function isFallbackSummary(text: string) {
  return FALLBACK_SUMMARIES.some((f) => text.startsWith(f));
}

export function extractReply(steps: RunStep[], msgText: string): string {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.type === "tool_call" && s.toolName === "finish" && s.toolArgs) {
      const summary = s.toolArgs?.summary;
      if (typeof summary === "string" && summary.trim().length > 0) {
        return summary.trim();
      }
    }
  }
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.type === "thought" && s.content && s.content.trim().length > 0) {
      return s.content.trim();
    }
  }
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.type === "final" && s.content && !isFallbackSummary(s.content.trim())) {
      return s.content.trim();
    }
  }
  return msgText;
}

function currentActivity(steps: RunStep[]): string {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.type === "tool_call" && s.toolName) {
      const name = s.toolName.replace(/_/g, " ");
      return `Using ${name}…`;
    }
  }
  return "Working…";
}

export function AssistantBubble({
  msg,
  onApprove,
  onReject,
  onStop,
}: {
  msg: ChatMessage;
  onApprove?: () => void;
  onReject?: () => void;
  onStop?: () => void;
}) {
  const [showTrace, setShowTrace] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const isActive = msg.status === "running" || msg.status === "sending";
  const isWaiting = msg.status === "waiting_approval";
  const isDone = msg.status === "done";
  const isFailed = msg.status === "stopped" || msg.status === "stale";

  const reply = isDone ? extractReply(msg.steps, msg.text) : null;

  const traceSteps = msg.steps.filter((s) => s.type !== "final");

  const activity = isActive ? (msg.status === "sending" ? "Starting…" : currentActivity(msg.steps)) : null;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", maxWidth: "84%" }}>
      <EmpAvatar name={msg.employeeName} size={32} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{msg.employeeName}</span>
          <span style={{ fontSize: 12, color: C.inkMuted }}>{timeAgo(msg.createdAt)}</span>
          {msg.costUsd > 0 && (
            <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono",monospace', color: C.inkMuted }}>
              ${msg.costUsd.toFixed(4)}
            </span>
          )}
        </div>

        {isActive && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px",
            background: C.surfaceSubtle, border: `1px solid ${C.line}`, borderRadius: 10,
            marginBottom: 8,
          }}>
            <Loader2 size={14} strokeWidth={1.75} color={C.brand}
              style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13, color: C.inkMuted }}>{activity}</span>
          </div>
        )}

        {isWaiting && (
          <div style={{
            padding: "12px 14px",
            background: C.warningBg, border: `1px solid #f2d98a`,
            borderRadius: 10, marginBottom: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <ShieldAlert size={14} strokeWidth={1.75} color={C.warningFg} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.warningFg }}>
                Waiting for your approval
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={async () => { setApproving(true); await onApprove?.(); setApproving(false); }}
                disabled={approving || rejecting}
                style={{
                  height: 34, padding: "0 14px",
                  background: C.brand, border: "none", borderRadius: 8,
                  fontSize: 13, fontWeight: 600, color: "#fff",
                  cursor: approving ? "not-allowed" : "pointer",
                  opacity: approving ? 0.7 : 1,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                {approving
                  ? <><Loader2 size={13} strokeWidth={1.75} style={{ animation: "spin 1s linear infinite" }} /> Approving…</>
                  : <><ShieldCheck size={13} strokeWidth={1.75} /> Approve</>}
              </button>
              <button
                onClick={async () => { setRejecting(true); await onReject?.(); setRejecting(false); }}
                disabled={approving || rejecting}
                style={{
                  height: 34, padding: "0 14px",
                  background: "transparent", border: `1px solid ${C.lineStrong}`,
                  borderRadius: 8, fontSize: 13, fontWeight: 500,
                  color: C.inkSecondary,
                  cursor: rejecting ? "not-allowed" : "pointer",
                  opacity: rejecting ? 0.7 : 1,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                {rejecting
                  ? <><Loader2 size={13} strokeWidth={1.75} style={{ animation: "spin 1s linear infinite" }} /> Rejecting…</>
                  : <><ShieldX size={13} strokeWidth={1.75} /> Reject</>}
              </button>
            </div>
          </div>
        )}

        {isDone && (
          <div style={{
            padding: "12px 16px",
            background: C.surface, border: `1px solid ${C.line}`,
            borderRadius: 12,
            fontSize: 14, color: C.ink, lineHeight: "22px",
            wordBreak: "break-word",
          }}>
            {reply ? (
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p style={{ margin: "0 0 8px", lineHeight: "22px" }}>{children}</p>,
                  ul: ({ children }) => <ul style={{ margin: "4px 0 8px", paddingLeft: 20 }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ margin: "4px 0 8px", paddingLeft: 20 }}>{children}</ol>,
                  li: ({ children }) => <li style={{ margin: "2px 0", lineHeight: "22px" }}>{children}</li>,
                  strong: ({ children }) => <strong style={{ fontWeight: 600, color: C.ink }}>{children}</strong>,
                  em: ({ children }) => <em>{children}</em>,
                  code: ({ children }) => <code style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, background: C.surfaceSunken, padding: "1px 5px", borderRadius: 4 }}>{children}</code>,
                  pre: ({ children }) => <pre style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, background: C.surfaceSunken, padding: "8px 12px", borderRadius: 6, overflowX: "auto", margin: "6px 0" }}>{children}</pre>,
                }}
              >
                {reply}
              </ReactMarkdown>
            ) : (
              <span style={{ color: C.inkMuted, fontSize: 13 }}>Action approved and completed.</span>
            )}
          </div>
        )}

        {isFailed && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
            background: C.dangerBg, border: `1px solid #f3b3b0`,
            borderRadius: 10, fontSize: 13, color: C.dangerFg,
          }}>
            <Square size={13} strokeWidth={1.75} />
            Run stopped
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          {isActive && (
            <button onClick={onStop} style={{
              height: 26, padding: "0 10px",
              background: "transparent", border: `1px solid ${C.lineStrong}`,
              borderRadius: 6, fontSize: 12, fontWeight: 500,
              color: C.dangerFg, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <Square size={11} strokeWidth={1.75} /> Stop
            </button>
          )}
          {traceSteps.length > 0 && (
            <button onClick={() => setShowTrace((v) => !v)} style={{
              height: 26, padding: "0 10px",
              background: "transparent", border: `1px solid ${C.line}`,
              borderRadius: 6, fontSize: 12, color: C.inkMuted, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              {showTrace ? <ChevronDown size={11} strokeWidth={1.75} /> : <ChevronRight size={11} strokeWidth={1.75} />}
              {traceSteps.length} step{traceSteps.length !== 1 ? "s" : ""}
            </button>
          )}
          {msg.taskId && (
            <a href={`/tasks/${msg.taskId}`} style={{
              height: 26, padding: "0 10px",
              background: "transparent", border: `1px solid ${C.line}`,
              borderRadius: 6, fontSize: 12, fontWeight: 500,
              color: C.inkMuted, cursor: "pointer", textDecoration: "none",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <ExternalLink size={11} strokeWidth={1.75} /> Full trace
            </a>
          )}
        </div>

        {showTrace && traceSteps.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {traceSteps.map((step, i) => (
              <RunStepCard key={i} step={step} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
