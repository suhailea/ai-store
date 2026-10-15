import { useState } from "react";
import type { Employee } from "@staffroom/types";
import type { CreateWorkflowInput } from "@/lib/api";
import { XCircle, Zap } from "lucide-react";

const TRIGGER_LABELS: Record<string, string> = {
  schedule: "Schedule",
  webhook: "Webhook",
  email_received: "Email received",
  slack_message: "Slack message",
};

const CRON_PRESETS = [
  { label: "Every day at 9am", value: "0 9 * * *" },
  { label: "Every Monday at 9am", value: "0 9 * * 1" },
  { label: "Every weekday at 8am", value: "0 8 * * 1-5" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "1st of month at 9am", value: "0 9 1 * *" },
];

const TEMPLATE_VARS = ["{{date}}", "{{day}}", "{{time}}", "{{employee_name}}", "{{trigger_data}}"];

export const EMPTY_FORM: CreateWorkflowInput = {
  name: "",
  description: "",
  triggerType: "schedule",
  triggerConfig: { cron: "0 9 * * *" },
  assignedToEmployeeId: "__manager__",
  taskTitleTemplate: "{{name}} — {{date}}",
  taskDescriptionTemplate: "",
  enabled: true,
};

export function WorkflowEditor({
  initial,
  employees,
  onSave,
  onClose,
  saving,
}: {
  initial: CreateWorkflowInput;
  employees: Employee[];
  onSave: (data: CreateWorkflowInput) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<CreateWorkflowInput>(initial);
  const [customCron, setCustomCron] = useState(false);

  function set<K extends keyof CreateWorkflowInput>(key: K, val: CreateWorkflowInput[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function handlePreset(cronVal: string) {
    setCustomCron(false);
    setForm((prev) => ({ ...prev, triggerConfig: { ...prev.triggerConfig, cron: cronVal } }));
  }

  const currentCron = (form.triggerConfig as { cron?: string }).cron ?? "";
  const isPreset = CRON_PRESETS.some((p) => p.value === currentCron);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: "36px",
    padding: "0 10px",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    fontSize: "14px",
    color: "#101828",
    background: "#ffffff",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 500,
    color: "#344054",
    marginBottom: "6px",
    display: "block",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(16,24,40,0.4)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "600px",
          maxHeight: "90vh",
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e4e7ec",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #e4e7ec",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#101828", margin: 0 }}>
            {initial.name ? "Edit workflow" : "Create workflow"}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#667085", padding: "4px" }}
          >
            <XCircle width={18} height={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* How it works banner */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 14px",
                background: "#f0f7ff",
                border: "1px solid #cce0ff",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#2f62c9",
              }}
            >
              {["Trigger fires", "Employee gets your instructions", "Runs the task", "Result on Board"].map((step, i, arr) => (
                <span key={step} style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <span style={{ fontWeight: 600 }}>{step}</span>
                  {i < arr.length - 1 && <span style={{ color: "#94b4e8" }}>→</span>}
                </span>
              ))}
            </div>

            {/* Name */}
            <div>
              <label style={labelStyle}>Workflow name *</label>
              <input
                style={inputStyle}
                placeholder="e.g. Daily standup report"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description</label>
              <input
                style={inputStyle}
                placeholder="Optional description"
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>

            {/* Trigger type */}
            <div>
              <label style={labelStyle}>Trigger type *</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {(["schedule", "webhook", "email_received", "slack_message"] as const).map((t) => {
                  const disabled = t === "email_received" || t === "slack_message";
                  const active = form.triggerType === t;
                  return (
                    <button
                      key={t}
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) return;
                        set("triggerType", t);
                        if (t === "schedule") {
                          set("triggerConfig", { cron: "0 9 * * *" });
                        } else {
                          set("triggerConfig", {});
                        }
                      }}
                      style={{
                        height: "34px",
                        padding: "0 14px",
                        borderRadius: "8px",
                        border: `1px solid ${active ? "#0f5b6c" : "#d0d5dd"}`,
                        background: active ? "#e6f2f4" : "#ffffff",
                        color: active ? "#0f5b6c" : disabled ? "#d0d5dd" : "#344054",
                        fontSize: "13px",
                        fontWeight: 500,
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.5 : 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {TRIGGER_LABELS[t]}
                      {disabled && (
                        <span style={{ fontSize: "10px", color: "#8a94a6", fontWeight: 400 }}>
                          Phase 2
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Schedule config */}
            {form.triggerType === "schedule" && (
              <div>
                <label style={labelStyle}>Schedule</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                  {CRON_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => handlePreset(p.value)}
                      style={{
                        height: "30px",
                        padding: "0 12px",
                        borderRadius: "6px",
                        border: `1px solid ${!customCron && currentCron === p.value ? "#0f5b6c" : "#e4e7ec"}`,
                        background: !customCron && currentCron === p.value ? "#e6f2f4" : "#f7f8fa",
                        color: !customCron && currentCron === p.value ? "#0f5b6c" : "#475467",
                        fontSize: "12px",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setCustomCron(true)}
                    style={{
                      height: "30px",
                      padding: "0 12px",
                      borderRadius: "6px",
                      border: `1px solid ${customCron || (!isPreset && currentCron) ? "#0f5b6c" : "#e4e7ec"}`,
                      background: customCron || (!isPreset && currentCron) ? "#e6f2f4" : "#f7f8fa",
                      color: customCron || (!isPreset && currentCron) ? "#0f5b6c" : "#475467",
                      fontSize: "12px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Custom
                  </button>
                </div>
                {(customCron || (!isPreset && currentCron)) && (
                  <input
                    style={{ ...inputStyle, fontFamily: '"JetBrains Mono", monospace', fontSize: "13px" }}
                    placeholder="e.g. 0 9 * * 1-5"
                    value={currentCron}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, triggerConfig: { ...prev.triggerConfig, cron: e.target.value } }))
                    }
                  />
                )}
              </div>
            )}

            {/* Executor — always the manager, no selection needed */}
            <div
              style={{
                padding: "10px 14px",
                background: "#f7f8fa",
                border: "1px solid #e4e7ec",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "#e6f2f4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Zap width={16} height={16} strokeWidth={1.75} style={{ color: "#0f5b6c" }} />
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#101828", margin: 0 }}>
                  Handled by your Manager
                </p>
                <p style={{ fontSize: "12px", color: "#667085", margin: "2px 0 0" }}>
                  The manager receives the instructions and decides whether to act directly or delegate to the right employees.
                </p>
              </div>
            </div>

            {/* Instructions — the core of the workflow */}
            <div>
              <label style={labelStyle}>
                What should the employee do? *
              </label>
              <p style={{ fontSize: "12px", color: "#667085", margin: "0 0 8px", lineHeight: 1.5 }}>
                These instructions are sent to the employee every time this workflow fires. Be specific — the employee will follow them exactly, use their tools, and post the result to the Board.
              </p>
              <textarea
                rows={6}
                placeholder={
                  form.triggerType === "schedule"
                    ? "e.g. Check my Gmail for any unread emails received since yesterday. Summarise each one in a bullet list — sender, subject, and a one-sentence summary. If any require a reply, draft a reply and ask me for approval before sending."
                    : "e.g. A webhook was fired. The data is: {{trigger_data}}. Parse the data and create a summary of what happened, then send me a Slack message with the key details."
                }
                value={form.taskDescriptionTemplate}
                onChange={(e) => set("taskDescriptionTemplate", e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d0d5dd",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "#101828",
                  background: "#ffffff",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                  lineHeight: 1.6,
                  boxSizing: "border-box",
                }}
              />
              <div style={{ marginTop: "8px" }}>
                <p style={{ fontSize: "11px", color: "#8a94a6", margin: "0 0 4px" }}>
                  Insert a variable:
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {TEMPLATE_VARS.map((v) => (
                    <button
                      key={v}
                      onClick={() => set("taskDescriptionTemplate", form.taskDescriptionTemplate + " " + v)}
                      style={{
                        height: "22px",
                        padding: "0 8px",
                        borderRadius: "4px",
                        border: "1px solid #e4e7ec",
                        background: "#f7f8fa",
                        color: "#475467",
                        fontSize: "11px",
                        fontFamily: '"JetBrains Mono", monospace',
                        cursor: "pointer",
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Task title template — collapsed into a smaller section */}
            <div>
              <label style={{ ...labelStyle, color: "#667085" }}>Task title (optional)</label>
              <input
                style={{ ...inputStyle, fontSize: "13px", color: "#475467" }}
                placeholder={`e.g. ${form.name || "My workflow"} — {{date}}`}
                value={form.taskTitleTemplate}
                onChange={(e) => set("taskTitleTemplate", e.target.value)}
              />
              <p style={{ fontSize: "11px", color: "#8a94a6", margin: "4px 0 0" }}>
                Shown on the Board when this workflow creates a task. Defaults to the workflow name + date.
              </p>
            </div>

            {/* Enabled */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 500, color: "#344054", margin: "0 0 2px" }}>
                  Enabled
                </p>
                <p style={{ fontSize: "12px", color: "#667085", margin: 0 }}>
                  Workflow will trigger when conditions are met
                </p>
              </div>
              <button
                onClick={() => set("enabled", !(form.enabled ?? true))}
                style={{
                  width: "36px",
                  height: "20px",
                  borderRadius: "10px",
                  border: "none",
                  background: (form.enabled ?? true) ? "#0f5b6c" : "#d0d5dd",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 120ms",
                  flexShrink: 0,
                }}
                aria-checked={form.enabled ?? true}
                role="switch"
              >
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: (form.enabled ?? true) ? "19px" : "3px",
                    width: "14px",
                    height: "14px",
                    borderRadius: "9999px",
                    background: "#ffffff",
                    transition: "left 120ms",
                  }}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e4e7ec",
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: "38px",
              padding: "0 16px",
              background: "#ffffff",
              border: "1px solid #d0d5dd",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#344054",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name || !form.taskDescriptionTemplate.trim()}
            style={{
              height: "38px",
              padding: "0 16px",
              background: "#0f5b6c",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: (saving || !form.name || !form.taskDescriptionTemplate.trim()) ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Save workflow"}
          </button>
        </div>
      </div>
    </div>
  );
}
