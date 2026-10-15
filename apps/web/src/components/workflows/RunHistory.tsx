import { useEffect, useState } from "react";
import type { WorkflowRun } from "@/lib/api";
import { workflowsApi } from "@/lib/api";
import { Zap, XCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { timeAgo } from "../../lib/emp";

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    task_created: { bg: "#e8f6ee", color: "#157f4f", label: "Task created" },
    triggered:    { bg: "#eaf0fc", color: "#2f62c9", label: "Triggered" },
    failed:       { bg: "#fdecea", color: "#c0362c", label: "Failed" },
  };
  const s = map[status] ?? map.task_created;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        height: "20px",
        padding: "0 7px",
        borderRadius: "5px",
        background: s.bg,
        color: s.color,
        fontSize: "12px",
        fontWeight: 500,
      }}
    >
      {status === "task_created" && <CheckCircle2 width={11} height={11} strokeWidth={1.75} />}
      {status === "failed" && <XCircle width={11} height={11} strokeWidth={1.75} />}
      {status === "triggered" && <AlertCircle width={11} height={11} strokeWidth={1.75} />}
      {s.label}
    </span>
  );
}

export function RunHistory({ workflowId, onClose }: { workflowId: string; onClose: () => void }) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    workflowsApi.runs(workflowId)
      .then(setRuns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workflowId]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(16,24,40,0.3)",
        zIndex: 40,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "480px",
          height: "100%",
          background: "#ffffff",
          borderLeft: "1px solid #e4e7ec",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e4e7ec",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#101828", margin: 0 }}>
            Run history
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#667085", padding: "4px" }}
          >
            <XCircle width={18} height={18} strokeWidth={1.75} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {loading && (
            <p style={{ fontSize: "14px", color: "#667085", textAlign: "center", marginTop: "32px" }}>
              Loading…
            </p>
          )}
          {!loading && runs.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px 24px",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "#f7f8fa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Zap width={22} height={22} strokeWidth={1.75} style={{ color: "#d0d5dd" }} />
              </div>
              <p style={{ fontSize: "14px", color: "#667085", margin: 0 }}>No runs yet</p>
            </div>
          )}
          {!loading && runs.map((run) => (
            <div
              key={run.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #f7f8fa",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <RunStatusBadge status={run.status} />
                  <span
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: "11px",
                      color: "#8a94a6",
                    }}
                  >
                    {run.id.slice(-8).toUpperCase()}
                  </span>
                </div>
                {run.error && (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#c0362c",
                      margin: "4px 0 0",
                      background: "#fdecea",
                      padding: "4px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    {run.error}
                  </p>
                )}
                {run.taskId && (
                  <p style={{ fontSize: "12px", color: "#667085", margin: "4px 0 0" }}>
                    Task:{" "}
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "11px" }}>
                      {run.taskId.slice(-8).toUpperCase()}
                    </span>
                  </p>
                )}
              </div>
              <span style={{ fontSize: "12px", color: "#8a94a6", flexShrink: 0 }}>
                {timeAgo(run.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
