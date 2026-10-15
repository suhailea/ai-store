import { useState } from "react";
import { approvalsApi } from "@/lib/api";
import type { Approval, Employee, Task } from "@staffroom/types";
import {
  Mail,
  Database,
  Calendar,
  FileText,
  Clock,
  Check,
  Pencil,
  CircleX,
  Link2,
  FileSearch,
} from "lucide-react";
import { empColor } from "../../lib/emp";

export type ApprovalRow = { approval: Approval; employee: Employee; task: Task };

function timeUntil(d: string) {
  const diff = new Date(d).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return `${Math.floor(diff / 60000)}m left`;
  if (hrs < 24) return `${hrs}h left`;
  return `${Math.floor(hrs / 24)}d left`;
}

function actionLabel(actionType: string): string {
  const map: Record<string, string> = {
    send_email: "Send email",
    update_crm: "Update CRM",
    update_crm_deal: "Update CRM",
    create_event: "Create event",
    write_file: "Write file",
  };
  return map[actionType] ?? actionType.replace(/_/g, " ");
}

function ActionIcon({ actionType, size = 16 }: { actionType: string; size?: number }) {
  const props = { width: size, height: size, strokeWidth: 1.75 };
  if (actionType === "send_email") return <Mail {...props} />;
  if (actionType.startsWith("update_crm")) return <Database {...props} />;
  if (actionType === "create_event") return <Calendar {...props} />;
  if (actionType === "write_file") return <FileText {...props} />;
  return <FileSearch {...props} />;
}

function EmpAvatar({ name, size = 30 }: { name: string; size?: number }) {
  const c = empColor(name);
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "9999px",
        background: c.bg,
        color: c.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontSize: size * 0.38,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials}
    </div>
  );
}

function EmailPreview({ payload }: { payload: Record<string, unknown> }) {
  const to = payload.to != null ? String(payload.to) : null;
  const subject = payload.subject != null ? String(payload.subject) : null;
  const body = payload.body != null ? String(payload.body) : null;

  return (
    <div
      style={{
        border: "1px solid #e4e7ec",
        borderRadius: "8px",
        overflow: "hidden",
        fontSize: "14px",
      }}
    >
      {to && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "8px 16px",
            borderBottom: "1px solid #e4e7ec",
            background: "#f7f8fa",
          }}
        >
          <span style={{ color: "#8a94a6", fontWeight: 500, width: "52px", flexShrink: 0 }}>To</span>
          <span style={{ color: "#101828" }}>{to}</span>
        </div>
      )}
      {subject && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "8px 16px",
            borderBottom: "1px solid #e4e7ec",
            background: "#f7f8fa",
          }}
        >
          <span style={{ color: "#8a94a6", fontWeight: 500, width: "52px", flexShrink: 0 }}>Subject</span>
          <span style={{ color: "#101828", fontWeight: 500 }}>{subject}</span>
        </div>
      )}
      {body && (
        <div
          style={{
            padding: "12px 16px",
            color: "#101828",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            background: "#ffffff",
          }}
        >
          {body}
        </div>
      )}
    </div>
  );
}

function CrmPreview({ payload }: { payload: Record<string, unknown> }) {
  const fields = payload.fields as Record<string, { old?: unknown; new?: unknown }> | null;
  const dealId = payload.dealId != null ? String(payload.dealId) : null;

  if (!fields) {
    return (
      <pre
        style={{
          background: "#f7f8fa",
          border: "1px solid #e4e7ec",
          borderRadius: "8px",
          padding: "12px 16px",
          fontSize: "12px",
          fontFamily: "monospace",
          overflowX: "auto",
          whiteSpace: "pre-wrap",
        }}
      >
        {JSON.stringify(payload, null, 2)}
      </pre>
    );
  }

  return (
    <div style={{ border: "1px solid #e4e7ec", borderRadius: "8px", overflow: "hidden", fontSize: "13px" }}>
      {dealId && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            padding: "8px 16px",
            borderBottom: "1px solid #e4e7ec",
            background: "#f7f8fa",
          }}
        >
          <span style={{ color: "#8a94a6", fontWeight: 500, width: "80px", flexShrink: 0 }}>Deal</span>
          <span style={{ color: "#101828", fontFamily: "monospace" }}>{dealId}</span>
        </div>
      )}
      {Object.entries(fields).map(([key, val]) => {
        const oldVal = val && typeof val === "object" && "old" in val ? String((val as { old: unknown }).old ?? "—") : "—";
        const newVal = val && typeof val === "object" && "new" in val ? String((val as { new: unknown }).new ?? String(val)) : String(val ?? "—");
        return (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 16px",
              borderBottom: "1px solid #e4e7ec",
            }}
          >
            <span style={{ color: "#8a94a6", width: "80px", flexShrink: 0, textTransform: "capitalize" }}>
              {key.replace(/_/g, " ")}
            </span>
            <span
              style={{
                background: "#fdecea",
                color: "#c0362c",
                padding: "2px 6px",
                borderRadius: "4px",
                textDecoration: "line-through",
                fontSize: "12px",
              }}
            >
              {oldVal}
            </span>
            <span style={{ color: "#8a94a6" }}>→</span>
            <span
              style={{
                background: "#e8f6ee",
                color: "#157f4f",
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              {newVal}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PayloadPreview({
  actionType,
  payload,
}: {
  actionType: string;
  payload: Record<string, unknown>;
}) {
  if (actionType === "send_email") return <EmailPreview payload={payload} />;
  if (actionType.startsWith("update_crm")) return <CrmPreview payload={payload} />;

  return (
    <pre
      style={{
        background: "#f7f8fa",
        border: "1px solid #e4e7ec",
        borderRadius: "8px",
        padding: "12px 16px",
        fontSize: "12px",
        fontFamily: "monospace",
        overflowX: "auto",
        whiteSpace: "pre-wrap",
        color: "#101828",
      }}
    >
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending:  { bg: "#fef4e4", color: "#b45309", label: "Pending" },
    approved: { bg: "#e8f6ee", color: "#157f4f", label: "Approved" },
    rejected: { bg: "#fdecea", color: "#c0362c", label: "Rejected" },
    expired:  { bg: "#eef1f4", color: "#667085", label: "Expired" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: "22px",
        padding: "0 8px",
        borderRadius: "6px",
        background: s.bg,
        color: s.color,
        fontSize: "12px",
        fontWeight: 500,
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  );
}

export function DetailPanel({
  row,
  onApproved,
  onRejected,
}: {
  row: ApprovalRow;
  onApproved: () => void;
  onRejected: () => void;
}) {
  const { approval, employee, task } = row;
  const c = empColor(employee.displayName);
  const [acting, setActing] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [note, setNote] = useState("");
  const [editedJson, setEditedJson] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [actionError, setActionError] = useState("");
  const remaining = timeUntil(approval.expiresAt);
  const isExpiring =
    approval.status === "pending" &&
    new Date(approval.expiresAt).getTime() - Date.now() < 4 * 3600000;

  async function handleApprove() {
    setActing(true);
    setActionError("");
    try {
      await approvalsApi.approve(approval.id);
      onApproved();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve. Please try again.");
    } finally {
      setActing(false);
    }
  }

  function openEditMode() {
    const args = (approval.payloadJson as Record<string, unknown>).arguments ?? approval.payloadJson;
    setEditedJson(JSON.stringify(args, null, 2));
    setJsonError("");
    setEditMode(true);
  }

  async function handleEditApprove() {
    setJsonError("");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(editedJson);
    } catch {
      setJsonError("Invalid JSON — fix the syntax before approving.");
      return;
    }
    setActing(true);
    setActionError("");
    try {
      const base = approval.payloadJson as Record<string, unknown>;
      const editedPayload = { ...base, arguments: parsed };
      await approvalsApi.approve(approval.id, editedPayload);
      onApproved();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve. Please try again.");
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    setActing(true);
    setActionError("");
    try {
      await approvalsApi.reject(approval.id, note || undefined);
      onRejected();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reject. Please try again.");
    } finally {
      setActing(false);
      setRejectMode(false);
      setNote("");
    }
  }

  const isPending = approval.status === "pending";

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#ffffff",
        border: "1px solid #e4e7ec",
        borderRadius: "12px",
        boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
      }}
    >
      {/* Header section */}
      <div
        style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid #e4e7ec",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
          {/* Action icon tile */}
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: c.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ color: c.text }}>
              <ActionIcon actionType={approval.actionType} size={16} />
            </span>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "#101828",
                margin: "0 0 4px",
                lineHeight: "26px",
              }}
            >
              {task.title}
            </h2>
            <p style={{ fontSize: "13px", color: "#667085", margin: 0, lineHeight: "18px" }}>
              {actionLabel(approval.actionType)} · requested by {employee.displayName} ·{" "}
              <span style={{ fontFamily: "monospace", fontSize: "12px" }}>
                AP-{approval.id.slice(-4).toUpperCase()}
              </span>
            </p>
          </div>

          {/* Expires badge */}
          {isPending && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                height: "22px",
                padding: "0 8px",
                borderRadius: "6px",
                background: isExpiring ? "#fef4e4" : "#f7f8fa",
                color: isExpiring ? "#b45309" : "#667085",
                fontSize: "12px",
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              <Clock width={12} height={12} strokeWidth={1.75} />
              Expires in {remaining}
            </div>
          )}

          {!isPending && (
            <StatusBadge status={approval.status} />
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {/* Why section */}
        <p
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#8a94a6",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          Why {employee.displayName} wants to do this
        </p>
        <div
          style={{
            background: "#f7f8fa",
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "20px",
            display: "flex",
            gap: "10px",
            alignItems: "flex-start",
          }}
        >
          <EmpAvatar name={employee.displayName} size={30} />
          <p style={{ fontSize: "14px", color: "#101828", lineHeight: 1.6, margin: 0 }}>
            {approval.reason}
          </p>
        </div>

        {/* Preview section */}
        <p
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#8a94a6",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          Exact preview — this is what will happen
        </p>
        <div style={{ marginBottom: "20px" }}>
          <PayloadPreview actionType={approval.actionType} payload={approval.payloadJson} />
        </div>

        {/* Sources row */}
        <p
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#8a94a6",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          Sources
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid #e4e7ec",
              background: "#f7f8fa",
              fontSize: "12px",
              color: "#475467",
            }}
          >
            <Link2 width={12} height={12} strokeWidth={1.75} />
            Task: {task.title.slice(0, 40)}{task.title.length > 40 ? "…" : ""}
          </div>
        </div>

        {/* Reviewer note if present */}
        {approval.reviewerNote && (
          <div
            style={{
              marginTop: "16px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "#fef4e4",
              border: "1px solid #f2a93b",
            }}
          >
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#b45309", margin: "0 0 4px" }}>
              Reviewer note
            </p>
            <p style={{ fontSize: "13px", color: "#101828", margin: 0 }}>
              {approval.reviewerNote}
            </p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {isPending && (
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid #e4e7ec",
            flexShrink: 0,
          }}
        >
          {actionError && (
            <p style={{ fontSize: 13, color: "#c0362c", margin: "0 0 10px", padding: "8px 12px", background: "#fdecea", borderRadius: 6 }}>
              {actionError}
            </p>
          )}
          {editMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <p style={{ fontSize: 12, color: "#475467", margin: 0 }}>
                Edit the arguments below, then approve.
              </p>
              <textarea
                autoFocus
                rows={8}
                value={editedJson}
                onChange={(e) => { setEditedJson(e.target.value); setJsonError(""); }}
                style={{
                  width: "100%",
                  border: `1px solid ${jsonError ? "#c0362c" : "#d0d5dd"}`,
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "13px",
                  fontFamily: "JetBrains Mono, monospace",
                  color: "#101828",
                  resize: "vertical",
                  outline: "none",
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                }}
              />
              {jsonError && (
                <p style={{ fontSize: 12, color: "#c0362c", margin: 0 }}>{jsonError}</p>
              )}
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => { setEditMode(false); setJsonError(""); }}
                  style={{
                    height: "38px", padding: "0 16px", background: "transparent",
                    border: "none", borderRadius: "8px", fontSize: "14px",
                    fontWeight: 500, color: "#475467", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditApprove}
                  disabled={acting}
                  style={{
                    height: "38px", padding: "0 16px", background: "#0f5b6c",
                    border: "none", borderRadius: "8px", fontSize: "14px",
                    fontWeight: 600, color: "#ffffff",
                    cursor: acting ? "not-allowed" : "pointer",
                    opacity: acting ? 0.6 : 1,
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  <Check width={14} height={14} strokeWidth={1.75} />
                  {acting ? "Approving…" : "Approve with edits"}
                </button>
              </div>
            </div>
          ) : rejectMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <textarea
                autoFocus
                rows={3}
                placeholder={`Optional note for ${employee.displayName}...`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{
                  width: "100%",
                  border: "1px solid #d0d5dd",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "14px",
                  color: "#101828",
                  resize: "none",
                  outline: "none",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => { setRejectMode(false); setNote(""); }}
                  style={{
                    height: "38px",
                    padding: "0 16px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#475467",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={acting}
                  style={{
                    height: "38px",
                    padding: "0 16px",
                    background: "#c0362c",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#ffffff",
                    cursor: acting ? "not-allowed" : "pointer",
                    opacity: acting ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <CircleX width={14} height={14} strokeWidth={1.75} />
                  {acting ? "Rejecting…" : "Confirm rejection"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {/* Left: Reject with note */}
              <button
                onClick={() => setRejectMode(true)}
                disabled={acting}
                style={{
                  height: "38px",
                  padding: "0 14px",
                  background: "transparent",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#475467",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <CircleX width={14} height={14} strokeWidth={1.75} />
                Reject with note
              </button>

              <div style={{ flex: 1 }} />

              {/* Edit, then approve */}
              <button
                onClick={openEditMode}
                disabled={acting}
                style={{
                  height: "38px",
                  padding: "0 16px",
                  background: "#ffffff",
                  border: "1px solid #d0d5dd",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#101828",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Pencil width={14} height={14} strokeWidth={1.75} />
                Edit, then approve
              </button>

              {/* Approve */}
              <button
                onClick={handleApprove}
                disabled={acting}
                style={{
                  height: "38px",
                  padding: "0 16px",
                  background: "#0f5b6c",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: acting ? "not-allowed" : "pointer",
                  opacity: acting ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Check width={14} height={14} strokeWidth={1.75} />
                {acting ? "Approving…" : "Approve"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
