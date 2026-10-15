import { useEffect, useState } from "react";
import { workflowsApi, employeesApi } from "@/lib/api";
import type { Workflow, CreateWorkflowInput } from "@/lib/api";
import type { Employee } from "@staffroom/types";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Play,
  Clock,
  Webhook,
  ChevronDown,
  ChevronRight,
  XCircle,
  Copy,
} from "lucide-react";
import { timeAgo } from "@/lib/emp";
import { WorkflowEditor, EMPTY_FORM } from "@/components/workflows/WorkflowEditor";
import { RunHistory } from "@/components/workflows/RunHistory";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  schedule: "Schedule",
  webhook: "Webhook",
  email_received: "Email received",
  slack_message: "Slack message",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TriggerBadge({ triggerType }: { triggerType: string }) {
  const isSchedule = triggerType === "schedule";
  const isWebhook = triggerType === "webhook";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        height: "22px",
        padding: "0 8px",
        borderRadius: "6px",
        background: isSchedule ? "#eaf0fc" : isWebhook ? "#e6f5ee" : "#f7f8fa",
        color: isSchedule ? "#2f62c9" : isWebhook ? "#17774f" : "#667085",
        fontSize: "12px",
        fontWeight: 500,
      }}
    >
      {isSchedule && <Clock width={11} height={11} strokeWidth={1.75} />}
      {isWebhook && <Webhook width={11} height={11} strokeWidth={1.75} />}
      {!isSchedule && !isWebhook && <Zap width={11} height={11} strokeWidth={1.75} />}
      {TRIGGER_LABELS[triggerType] ?? triggerType}
    </span>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      style={{
        width: "36px",
        height: "20px",
        borderRadius: "10px",
        border: "none",
        background: checked ? "#0f5b6c" : "#d0d5dd",
        cursor: "pointer",
        position: "relative",
        transition: "background 120ms",
        flexShrink: 0,
      }}
      aria-checked={checked}
      role="switch"
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: checked ? "19px" : "3px",
          width: "14px",
          height: "14px",
          borderRadius: "9999px",
          background: "#ffffff",
          transition: "left 120ms",
        }}
      />
    </button>
  );
}

// ─── Delete confirmation ──────────────────────────────────────────────────────

function DeleteConfirm({
  name,
  onConfirm,
  onCancel,
  deleting,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
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
      onClick={onCancel}
    >
      <div
        style={{
          width: "440px",
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e4e7ec",
          padding: "24px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: "#fdecea",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
          }}
        >
          <Trash2 width={22} height={22} strokeWidth={1.75} style={{ color: "#c0362c" }} />
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#101828", margin: "0 0 8px" }}>
          Delete workflow?
        </h3>
        <p style={{ fontSize: "14px", color: "#667085", margin: "0 0 24px", lineHeight: 1.6 }}>
          <strong style={{ color: "#101828" }}>{name}</strong> will be permanently deleted. This
          action cannot be undone.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
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
            onClick={onConfirm}
            disabled={deleting}
            style={{
              height: "38px",
              padding: "0 16px",
              background: "#c0362c",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              cursor: deleting ? "not-allowed" : "pointer",
              opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Webhook URL display ──────────────────────────────────────────────────────

function WebhookUrlDisplay({ workflowId }: { workflowId: string }) {
  const url = `${window.location.origin}/api/webhooks/${workflowId}`;
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 10px",
        background: "#f7f8fa",
        border: "1px solid #e4e7ec",
        borderRadius: "6px",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "11px",
          color: "#475467",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {url}
      </span>
      <button
        onClick={copy}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: copied ? "#157f4f" : "#667085",
          padding: "2px",
          flexShrink: 0,
        }}
        title="Copy webhook URL"
      >
        <Copy width={13} height={13} strokeWidth={1.75} />
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function Workflows() {
  const [wflows, setWflows] = useState<Workflow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Workflow | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [runsTarget, setRunsTarget] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    try {
      const [wf, emps] = await Promise.all([workflowsApi.list(), employeesApi.list()]);
      setWflows(wf);
      setEmployees(emps);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function empName(id: string) {
    return employees.find((e) => e.id === id)?.displayName ?? id;
  }

  async function handleSave(data: CreateWorkflowInput) {
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await workflowsApi.update(editTarget.id, data);
        setWflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      } else {
        const created = await workflowsApi.create(data);
        setWflows((prev) => [created, ...prev]);
      }
      setShowForm(false);
      setEditTarget(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(wfl: Workflow) {
    try {
      const updated = await workflowsApi.update(wfl.id, { enabled: !wfl.enabled });
      setWflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await workflowsApi.delete(deleteTarget.id);
      setWflows((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleFire(id: string) {
    try {
      await workflowsApi.fire(id);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "400px",
            color: "#667085",
            fontSize: "14px",
          }}
        >
          Loading…
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <PageHeader
          title="Workflows"
          breadcrumbs={[{ label: "Workflows" }]}
        />
        <div
          style={{
            margin: "32px",
            padding: "16px 20px",
            background: "#fdecea",
            borderRadius: "10px",
            color: "#c0362c",
            fontSize: "14px",
          }}
        >
          Failed to load workflows: {error}
        </div>
      </AppShell>
    );
  }

  const enabledCount = wflows.filter((w) => w.enabled).length;
  const scheduleCount = wflows.filter((w) => w.triggerType === "schedule").length;
  const webhookCount = wflows.filter((w) => w.triggerType === "webhook").length;

  return (
    <AppShell>
      <PageHeader
        title="Workflows"
        subtitle="Automate recurring tasks with scheduled or event-driven triggers"
        breadcrumbs={[{ label: "Workflows" }]}
        action={
          <button
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            style={{
              height: "38px",
              padding: "0 16px",
              background: "#0f5b6c",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "7px",
            }}
          >
            <Plus width={16} height={16} strokeWidth={1.75} />
            New workflow
          </button>
        }
      />

      {/* KPI stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          padding: "24px 32px 8px",
        }}
      >
        {[
          { label: "Total workflows", value: wflows.length },
          { label: "Enabled", value: enabledCount },
          { label: "Scheduled", value: scheduleCount },
          { label: "Webhook triggers", value: webhookCount },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: "#ffffff",
              border: "1px solid #e4e7ec",
              borderRadius: "10px",
              padding: "16px 20px",
            }}
          >
            <p style={{ fontSize: "12px", fontWeight: 500, color: "#8a94a6", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
              {label}
            </p>
            <p
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "#101828",
                margin: 0,
                fontFamily: '"JetBrains Mono", monospace',
                lineHeight: "34px",
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Workflow list */}
      <div style={{ padding: "16px 32px 32px" }}>
        {wflows.length === 0 ? (
          /* Empty state */
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e4e7ec",
              borderRadius: "12px",
              padding: "64px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background: "#e6f2f4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap width={26} height={26} strokeWidth={1.75} style={{ color: "#0f5b6c" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#101828", margin: "0 0 6px" }}>
                No workflows yet
              </p>
              <p style={{ fontSize: "14px", color: "#667085", margin: "0 0 20px" }}>
                Create your first workflow to automate recurring tasks
              </p>
              <button
                onClick={() => { setEditTarget(null); setShowForm(true); }}
                style={{
                  height: "38px",
                  padding: "0 20px",
                  background: "#0f5b6c",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                }}
              >
                <Plus width={16} height={16} strokeWidth={1.75} />
                New workflow
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e4e7ec",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 180px 100px 130px 120px",
                padding: "10px 20px",
                borderBottom: "1px solid #e4e7ec",
              }}
            >
              {["Workflow", "Trigger", "Assigned to", "Enabled", "Last fired", "Actions"].map((h) => (
                <span
                  key={h}
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#8a94a6",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            {wflows.map((wfl, idx) => (
              <div key={wfl.id}>
                {/* Row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px 180px 100px 130px 120px",
                    padding: "14px 20px",
                    borderBottom: idx < wflows.length - 1 || expandedId === wfl.id ? "1px solid #f7f8fa" : "none",
                    alignItems: "center",
                  }}
                >
                  {/* Name */}
                  <div style={{ minWidth: 0 }}>
                    <button
                      onClick={() => setExpandedId(expandedId === wfl.id ? null : wfl.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        textAlign: "left",
                      }}
                    >
                      {expandedId === wfl.id ? (
                        <ChevronDown width={14} height={14} strokeWidth={1.75} style={{ color: "#667085", flexShrink: 0 }} />
                      ) : (
                        <ChevronRight width={14} height={14} strokeWidth={1.75} style={{ color: "#667085", flexShrink: 0 }} />
                      )}
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "#101828",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {wfl.name}
                      </span>
                    </button>
                    {wfl.description && (
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#8a94a6",
                          margin: "2px 0 0 20px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {wfl.description}
                      </p>
                    )}
                  </div>

                  {/* Trigger */}
                  <div>
                    <TriggerBadge triggerType={wfl.triggerType} />
                  </div>

                  {/* Assigned to */}
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#475467",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {empName(wfl.assignedToEmployeeId)}
                  </div>

                  {/* Enabled toggle */}
                  <div>
                    <Toggle checked={wfl.enabled} onChange={() => handleToggle(wfl)} />
                  </div>

                  {/* Last fired */}
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#667085",
                      fontFamily: wfl.lastFiredAt ? '"JetBrains Mono", monospace' : "inherit",
                    }}
                  >
                    {wfl.lastFiredAt ? timeAgo(wfl.lastFiredAt) : "—"}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button
                      onClick={() => handleFire(wfl.id)}
                      title="Run now"
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        border: "1px solid #e4e7ec",
                        background: "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#667085",
                      }}
                    >
                      <Play width={13} height={13} strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => setRunsTarget(wfl.id)}
                      title="View runs"
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        border: "1px solid #e4e7ec",
                        background: "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#667085",
                      }}
                    >
                      <Clock width={13} height={13} strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => { setEditTarget(wfl); setShowForm(true); }}
                      title="Edit"
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        border: "1px solid #e4e7ec",
                        background: "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#667085",
                      }}
                    >
                      <Pencil width={13} height={13} strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(wfl)}
                      title="Delete"
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        border: "1px solid #e4e7ec",
                        background: "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#c0362c",
                      }}
                    >
                      <Trash2 width={13} height={13} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === wfl.id && (
                  <div
                    style={{
                      padding: "16px 20px 20px 40px",
                      background: "#fafbfc",
                      borderBottom: idx < wflows.length - 1 ? "1px solid #f7f8fa" : "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {/* Webhook URL */}
                    {wfl.triggerType === "webhook" && (
                      <div>
                        <p style={{ fontSize: "12px", fontWeight: 600, color: "#8a94a6", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                          Webhook URL
                        </p>
                        <WebhookUrlDisplay workflowId={wfl.id} />
                      </div>
                    )}

                    {/* Cron expression */}
                    {wfl.triggerType === "schedule" && (wfl.triggerConfig as { cron?: string }).cron && (
                      <div>
                        <p style={{ fontSize: "12px", fontWeight: 600, color: "#8a94a6", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                          Cron schedule
                        </p>
                        <span
                          style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: "13px",
                            color: "#475467",
                            background: "#f7f8fa",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "1px solid #e4e7ec",
                          }}
                        >
                          {(wfl.triggerConfig as { cron?: string }).cron}
                        </span>
                      </div>
                    )}

                    {/* Task templates */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div>
                        <p style={{ fontSize: "12px", fontWeight: 600, color: "#8a94a6", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                          Task title template
                        </p>
                        <p style={{ fontSize: "13px", color: "#101828", margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                          {wfl.taskTitleTemplate}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: "12px", fontWeight: 600, color: "#8a94a6", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                          Task description template
                        </p>
                        <p style={{ fontSize: "13px", color: "#475467", margin: 0, lineHeight: 1.5 }}>
                          {wfl.taskDescriptionTemplate}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <WorkflowEditor
          initial={editTarget
            ? {
                name: editTarget.name,
                description: editTarget.description ?? "",
                triggerType: editTarget.triggerType,
                triggerConfig: editTarget.triggerConfig,
                assignedToEmployeeId: editTarget.assignedToEmployeeId,
                taskTitleTemplate: editTarget.taskTitleTemplate,
                taskDescriptionTemplate: editTarget.taskDescriptionTemplate,
                enabled: editTarget.enabled,
              }
            : EMPTY_FORM
          }
          employees={employees}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
          saving={saving}
        />
      )}

      {runsTarget && (
        <RunHistory
          workflowId={runsTarget}
          onClose={() => setRunsTarget(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

    </AppShell>
  );
}

export default Workflows;
