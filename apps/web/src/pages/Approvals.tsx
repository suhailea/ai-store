import { useEffect, useRef, useState } from "react";
import { approvalsApi } from "@/lib/api";
import type { Approval, Employee, Task } from "@staffroom/types";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  CheckCheck,
  Filter,
  SlidersHorizontal,
} from "lucide-react";
import { DetailPanel } from "@/components/approvals/DetailPanel";
import { ApprovalListRow } from "@/components/approvals/ApprovalListRow";
import { empColor, timeAgo } from "@/lib/emp";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalRow = { approval: Approval; employee: Employee; task: Task };
type TabId = "pending" | "approved" | "rejected" | "expired";

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

function EmpAvatar({ name, size = 30 }: { name: string; size?: number }) {
  const c = empColor(name);
  const inits = name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
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
      {inits}
    </div>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────

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

// ─── Past approvals table ──────────────────────────────────────────────────────

function PastTable({ rows }: { rows: ApprovalRow[] }) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 24px",
          gap: "12px",
          color: "#667085",
          fontSize: "14px",
        }}
      >
        <CheckCheck width={32} height={32} strokeWidth={1.75} style={{ color: "#d0d5dd" }} />
        Nothing here yet
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 24px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e4e7ec" }}>
            {["Title", "Employee", "Action", "Status", "Date", "Cost"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "10px 16px",
                  textAlign: "left",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#8a94a6",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.approval.id}
              style={{ borderBottom: "1px solid #f7f8fa" }}
            >
              <td style={{ padding: "12px 16px", color: "#101828", fontWeight: 500 }}>
                <span
                  style={{
                    display: "block",
                    maxWidth: "260px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.task.title}
                </span>
              </td>
              <td style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <EmpAvatar name={row.employee.displayName} size={24} />
                  <span style={{ color: "#475467" }}>{row.employee.displayName}</span>
                </div>
              </td>
              <td style={{ padding: "12px 16px", color: "#667085" }}>
                {actionLabel(row.approval.actionType)}
              </td>
              <td style={{ padding: "12px 16px" }}>
                <StatusBadge status={row.approval.status} />
              </td>
              <td style={{ padding: "12px 16px", color: "#667085" }}>
                {timeAgo(row.approval.createdAt)}
              </td>
              <td style={{ padding: "12px 16px", color: "#667085", fontFamily: "monospace", fontSize: "13px" }}>
                ${row.task.costUsd.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Approvals() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    try {
      const data = await approvalsApi.list();
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 8000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const byStatus: Record<TabId, ApprovalRow[]> = {
    pending: rows.filter((r) => r.approval.status === "pending").sort(
      (a, b) => new Date(a.approval.expiresAt).getTime() - new Date(b.approval.expiresAt).getTime()
    ),
    approved: rows.filter((r) => r.approval.status === "approved"),
    rejected: rows.filter((r) => r.approval.status === "rejected"),
    expired:  rows.filter((r) => r.approval.status === "expired"),
  };

  const tabList: { id: TabId; label: string }[] = [
    { id: "pending",  label: `Pending ${byStatus.pending.length}` },
    { id: "approved", label: `Approved ${byStatus.approved.length}` },
    { id: "rejected", label: `Rejected ${byStatus.rejected.length}` },
    { id: "expired",  label: `Expired ${byStatus.expired.length}` },
  ];

  const pendingRows = byStatus.pending;
  const selectedRow = pendingRows.find((r) => r.approval.id === selectedId) ?? pendingRows[0] ?? null;

  function handleResolved() {
    load();
    // Auto-select next after brief delay
    setTimeout(() => {
      setSelectedId(null);
    }, 200);
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

  return (
    <AppShell>
      <PageHeader
        title="Approvals"
        subtitle="Review and approve actions requested by your AI employees"
        action={
          <button
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
            <SlidersHorizontal width={14} height={14} strokeWidth={1.75} />
            Approval rules
          </button>
        }
      />

      {/* Tabs bar */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e4e7ec",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          gap: "0",
          flexShrink: 0,
        }}
      >
        {tabList.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              height: "44px",
              padding: "0 16px",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #0f5b6c" : "2px solid transparent",
              fontSize: "14px",
              fontWeight: 500,
              color: activeTab === tab.id ? "#0f5b6c" : "#667085",
              cursor: "pointer",
              transition: "color 100ms",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
        }}
      >
        {/* Pending tab — split layout */}
        {activeTab === "pending" && (
          <>
            {/* Left list */}
            <div
              style={{
                width: "380px",
                flexShrink: 0,
                borderRight: "1px solid #e4e7ec",
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* List header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e4e7ec",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "13px", color: "#667085" }}>
                  {pendingRows.length} waiting · Oldest first
                </span>
                <button
                  style={{
                    width: "30px",
                    height: "30px",
                    background: "none",
                    border: "1px solid #e4e7ec",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#667085",
                  }}
                >
                  <Filter width={13} height={13} strokeWidth={1.75} />
                </button>
              </div>

              {/* List items */}
              <div style={{ flex: 1, overflowY: "auto" }}>
                {pendingRows.length === 0 ? (
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
                        background: "#e8f6ee",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CheckCheck width={22} height={22} strokeWidth={1.75} style={{ color: "#157f4f" }} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "#101828", margin: "0 0 4px" }}>
                        All clear
                      </p>
                      <p style={{ fontSize: "13px", color: "#667085", margin: 0 }}>
                        No pending approvals
                      </p>
                    </div>
                  </div>
                ) : (
                  pendingRows.map((row) => (
                    <ApprovalListRow
                      key={row.approval.id}
                      row={row}
                      selected={
                        selectedRow ? row.approval.id === selectedRow.approval.id : false
                      }
                      onClick={() => setSelectedId(row.approval.id)}
                    />
                  ))
                )}
              </div>

              {/* Tip box */}
              {pendingRows.length > 0 && pendingRows.length < 4 && (
                <div
                  style={{
                    margin: "12px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "#eaf1fc",
                    color: "#1d63c8",
                    fontSize: "12px",
                    lineHeight: 1.5,
                    flexShrink: 0,
                  }}
                >
                  Tip: Approvals expire automatically if not reviewed in time. Check back regularly.
                </div>
              )}
            </div>

            {/* Right detail */}
            <div
              style={{
                flex: 1,
                padding: "20px",
                overflowY: "auto",
                background: "#f7f8fa",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {selectedRow ? (
                <DetailPanel
                  key={selectedRow.approval.id}
                  row={selectedRow}
                  onApproved={handleResolved}
                  onRejected={handleResolved}
                />
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    color: "#8a94a6",
                  }}
                >
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "12px",
                      background: "#eef1f4",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CheckCheck width={26} height={26} strokeWidth={1.75} />
                  </div>
                  <p style={{ fontSize: "14px", color: "#667085", margin: 0 }}>
                    Select an approval to review
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Other tabs */}
        {activeTab !== "pending" && (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              background: "#ffffff",
            }}
          >
            <PastTable rows={byStatus[activeTab]} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
