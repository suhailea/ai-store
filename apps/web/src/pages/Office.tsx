import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, approvalsApi, tasksApi, employeesApi } from "@/lib/api";
import type { Employee, Task, Approval } from "@staffroom/types";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  Clock,
  Zap,
  CheckCircle,
  Wallet,
  CircleCheck,
  List,
  Users,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import { empColor, initials, timeAgo } from "@/lib/emp";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalRow = { approval: Approval; employee: Employee; task: Task };

// ─── EmpAvatar ────────────────────────────────────────────────────────────────

function EmpAvatar({ name, size = 30 }: { name: string; size?: number }) {
  const { bg, text } = empColor(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "9999px",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: size <= 26 ? "10px" : "11px",
        fontWeight: 700,
        color: text,
        lineHeight: 1,
      }}
    >
      {initials(name)}
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    queued:           { bg: "#eef1f4", color: "#475467", label: "Assigned" },
    running:          { bg: "#eaf1fc", color: "#1d63c8", label: "Working"  },
    waiting_approval: { bg: "#fef4e4", color: "#b45309", label: "Waiting"  },
    done:             { bg: "#e8f6ee", color: "#157f4f", label: "Done"     },
    stopped:          { bg: "#fdecea", color: "#c0362c", label: "Stopped"  },
    stale:            { bg: "#fdecea", color: "#c0362c", label: "Stale"    },
  };
  const s = map[status] ?? { bg: "#eef1f4", color: "#475467", label: status };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: "22px",
        padding: "0 8px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 500,
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  );
}

// ─── IconTile ─────────────────────────────────────────────────────────────────

function IconTile({ icon, bg, color, size = 36 }: { icon: React.ReactNode; bg: string; color: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "8px",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color,
      }}
    >
      {icon}
    </div>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  footer,
  iconBg,
  iconColor,
  icon,
  mono,
}: {
  label: string;
  value: string;
  footer?: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e4e7ec",
        borderRadius: "12px",
        boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <p style={{ fontSize: "13px", fontWeight: 400, color: "#475467", lineHeight: "18px", margin: 0 }}>
          {label}
        </p>
        <IconTile icon={icon} bg={iconBg} color={iconColor} size={36} />
      </div>
      <div>
        <p
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: "#101828",
            lineHeight: "36px",
            margin: 0,
            fontFamily: mono ? '"JetBrains Mono", "Fira Mono", monospace' : "inherit",
          }}
        >
          {value}
        </p>
        {footer && (
          <p style={{ fontSize: "12px", color: "#667085", marginTop: "4px", marginBottom: 0 }}>
            {footer}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── NewTaskModal ─────────────────────────────────────────────────────────────

function NewTaskModal({
  employees,
  onClose,
  onCreated,
}: {
  employees: Employee[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const activeEmps = employees.filter((e) => e.status === "active");
  const [empId, setEmpId] = useState(activeEmps[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !empId) return;
    setSaving(true);
    try {
      await tasksApi.create({ assignedToEmployeeId: empId, title, ...(desc ? { description: desc } : {}) });
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(16,24,40,0.48)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(16,24,40,0.18), 0 2px 8px rgba(16,24,40,0.08)",
          width: "480px",
          maxWidth: "90vw",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #e4e7ec",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#101828", margin: 0 }}>New task</h2>
          <button
            onClick={onClose}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "none",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#667085",
            }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#344054", marginBottom: "6px" }}>
                Assign to
              </label>
              <select
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                style={{
                  width: "100%",
                  height: "38px",
                  border: "1px solid #d0d5dd",
                  borderRadius: "8px",
                  padding: "0 12px",
                  fontSize: "14px",
                  color: "#101828",
                  background: "#fff",
                  outline: "none",
                }}
              >
                {activeEmps.map((e) => (
                  <option key={e.id} value={e.id}>{e.displayName}</option>
                ))}
                {activeEmps.length === 0 && <option disabled>No active employees</option>}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#344054", marginBottom: "6px" }}>
                Task
              </label>
              <input
                ref={inputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What should they do?"
                style={{
                  width: "100%",
                  height: "38px",
                  border: "1px solid #d0d5dd",
                  borderRadius: "8px",
                  padding: "0 12px",
                  fontSize: "14px",
                  color: "#101828",
                  background: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#344054", marginBottom: "6px" }}>
                Details <span style={{ fontWeight: 400, color: "#667085" }}>(optional)</span>
              </label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                placeholder="Any context or instructions…"
                style={{
                  width: "100%",
                  border: "1px solid #d0d5dd",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "14px",
                  color: "#101828",
                  background: "#fff",
                  outline: "none",
                  resize: "none",
                  lineHeight: "20px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          <div
            style={{
              background: "#f7f8fa",
              padding: "12px 20px",
              borderTop: "1px solid #e4e7ec",
              borderRadius: "0 0 12px 12px",
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                height: "38px",
                padding: "0 16px",
                border: "1px solid #d0d5dd",
                borderRadius: "8px",
                background: "#fff",
                color: "#101828",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !empId}
              style={{
                height: "38px",
                padding: "0 16px",
                border: "none",
                borderRadius: "8px",
                background: saving || !title.trim() ? "#6eaab7" : "#0f5b6c",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                cursor: saving || !title.trim() ? "not-allowed" : "pointer",
                boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
              }}
            >
              {saving ? "Assigning…" : "Assign task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Runtime status for team panel ───────────────────────────────────────────

function employeeRuntimeStatus(emp: Employee, tasks: Task[]): { dot: string; label: string; labelColor: string } {
  const empTasks = tasks.filter((t) => t.assignedToEmployeeId === emp.id);
  if (empTasks.some((t) => t.status === "running"))
    return { dot: "#22a06b", label: "Working", labelColor: "#157f4f" };
  if (empTasks.some((t) => t.status === "waiting_approval"))
    return { dot: "#f2a93b", label: "Waiting for you", labelColor: "#b45309" };
  if (emp.status === "paused")
    return { dot: "#667085", label: "Paused", labelColor: "#667085" };
  return { dot: "#98a2b3", label: "Idle", labelColor: "#98a2b3" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Office() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("there");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(
    () => localStorage.getItem("aistore_onboarding_dismissed") === "1"
  );

  function dismissBanner() {
    localStorage.setItem("aistore_onboarding_dismissed", "1");
    setBannerDismissed(true);
  }

  async function load() {
    const [me, emps, tsks, apprs] = await Promise.all([
      auth.me(),
      employeesApi.list(),
      tasksApi.list(),
      approvalsApi.list(),
    ]);
    setFirstName(me.user.name.split(" ")[0]);
    setEmployees(emps);
    setTasks(tsks);
    setApprovals(apprs);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const pending = approvals.filter((r) => r.approval.status === "pending");
  const running = tasks.filter((t) => t.status === "running");

  const doneThisWeek = tasks.filter((t) => {
    if (t.status !== "done") return false;
    const d = new Date(t.finishedAt ?? t.createdAt);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return d >= weekStart;
  });

  const todaySpend = tasks.reduce((s, t) => {
    if (new Date(t.createdAt).toDateString() === new Date().toDateString()) return s + t.costUsd;
    return s;
  }, 0);

  const expiringIn24h = pending.filter(
    (r) => new Date(r.approval.expiresAt).getTime() - Date.now() < 86400000
  );

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "400px", color: "#667085", fontSize: "14px" }}>
          Loading…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={`Good morning, ${firstName}`}
        subtitle={`${todayLabel} · your team is on it.`}
        breadcrumbs={[{ label: "Office" }]}
        action={
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              height: "38px",
              padding: "0 16px",
              border: "none",
              borderRadius: "8px",
              background: "#0f5b6c",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#0b4a58")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#0f5b6c")}
          >
            <Plus size={16} strokeWidth={1.75} />
            New task
          </button>
        }
      />

      <div style={{ padding: "24px 32px", background: "#f7f8fa", display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* Onboarding banner — shown when < 2 employees and not dismissed */}
        {!bannerDismissed && employees.filter((e) => e.status === "active").length < 2 && (
          <div style={{
            background: "#fff",
            border: "1px solid #e4e7ec",
            borderRadius: "12px",
            padding: "20px 24px",
            display: "flex",
            alignItems: "flex-start",
            gap: "20px",
          }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#101828", margin: "0 0 4px" }}>
                Your AI workforce is ready
              </p>
              <p style={{ fontSize: "13px", color: "#667085", margin: "0 0 16px", lineHeight: "20px" }}>
                Hire AI employees, give them tools, and let them work — you approve before anything is sent or changed.
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {[
                  "1 · Hire an employee — give them a role and tools",
                  "2 · Assign a task or chat with them directly",
                  "3 · They work autonomously — you approve write actions",
                ].map((step) => (
                  <span key={step} style={{
                    fontSize: "12px",
                    color: "#344054",
                    background: "#f2f4f7",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    whiteSpace: "nowrap",
                  }}>{step}</span>
                ))}
              </div>
              <button
                onClick={() => navigate("/hire")}
                style={{
                  marginTop: "16px",
                  height: "34px",
                  padding: "0 14px",
                  background: "#0f5b6c",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#0b4a58")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#0f5b6c")}
              >
                Hire your first employee
              </button>
            </div>
            <button
              onClick={dismissBanner}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#98a2b3", padding: "2px", flexShrink: 0 }}
              aria-label="Dismiss"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        )}

        {/* ROW 1: 4 StatCards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "16px" }}>
          <StatCard
            label="Waiting for your approval"
            value={String(pending.length)}
            icon={<Clock size={18} strokeWidth={1.75} />}
            iconBg="#fef4e4"
            iconColor="#b45309"
            footer={expiringIn24h.length > 0 ? `${expiringIn24h.length} expiring in 24h` : ""}
          />
          <StatCard
            label="Tasks in progress"
            value={String(running.length)}
            icon={<Zap size={18} strokeWidth={1.75} />}
            iconBg="#eaf1fc"
            iconColor="#1d63c8"
            footer={running.length > 0 ? `${new Set(running.map((t) => t.assignedToEmployeeId)).size} employees working` : ""}
          />
          <StatCard
            label="Done this week"
            value={String(doneThisWeek.length)}
            icon={<CheckCircle size={18} strokeWidth={1.75} />}
            iconBg="#e8f6ee"
            iconColor="#157f4f"
          />
          <StatCard
            label="AI spend today"
            value={`$${todaySpend.toFixed(2)}`}
            icon={<Wallet size={18} strokeWidth={1.75} />}
            iconBg="#e6f2f4"
            iconColor="#0f5b6c"
            mono
            footer="across all employees"
          />
        </div>

        {/* ROW 2: 2-col grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,2fr) minmax(300px,1fr)",
            gap: "24px",
            alignItems: "start",
          }}
        >
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* Approvals card */}
            <div style={{ background: "#fff", border: "1px solid #e4e7ec", borderRadius: "12px", boxShadow: "0 1px 2px rgba(16,24,40,0.05)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e4e7ec", display: "flex", alignItems: "center", gap: "12px" }}>
                <IconTile icon={<CircleCheck size={18} strokeWidth={1.75} />} bg="#fef4e4" color="#f2a93b" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#101828" }}>Needs your approval</h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#667085" }}>{pending.length} pending</p>
                </div>
                <button
                  onClick={() => navigate("/approvals")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#475467", padding: "4px 8px", borderRadius: "6px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f7f8fa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  View all
                </button>
              </div>

              <div style={{ padding: "8px 0" }}>
                {pending.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center", padding: "24px 20px", color: "#667085", fontSize: "14px" }}>
                    <CheckCircle size={16} strokeWidth={1.75} color="#22a06b" />
                    All caught up
                  </div>
                ) : (
                  pending.slice(0, 3).map(({ approval, employee, task }) => {
                    const { bg, text } = empColor(employee.displayName);
                    const msLeft = Math.max(0, new Date(approval.expiresAt).getTime() - Date.now());
                    const hrsLeft = Math.floor(msLeft / 3600000);
                    const timeLeftStr = hrsLeft > 0 ? `${hrsLeft}h left` : "Expiring soon";
                    return (
                      <div
                        key={approval.id}
                        onClick={() => navigate("/approvals")}
                        style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 20px", cursor: "pointer", borderBottom: "1px solid #f7f8fa", transition: "background 100ms" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f7f8fa")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div style={{ width: "30px", height: "30px", borderRadius: "9999px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "10px", fontWeight: 700, color: text }}>
                          {initials(employee.displayName)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#101828", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {task.title}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#667085" }}>
                            {approval.actionType.replace(/_/g, " ")} · {employee.displayName}
                          </p>
                        </div>
                        <span style={{ fontSize: "12px", color: "#667085", flexShrink: 0 }}>{timeLeftStr}</span>
                        <ChevronRight size={14} strokeWidth={1.75} color="#98a2b3" />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Recent tasks card */}
            <div style={{ background: "#fff", border: "1px solid #e4e7ec", borderRadius: "12px", boxShadow: "0 1px 2px rgba(16,24,40,0.05)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e4e7ec", display: "flex", alignItems: "center", gap: "12px" }}>
                <IconTile icon={<List size={18} strokeWidth={1.75} />} bg="#eef1f4" color="#475467" />
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#101828", flex: 1 }}>Recent tasks</h3>
                <button
                  onClick={() => navigate("/board")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#475467", padding: "4px 8px", borderRadius: "6px" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f7f8fa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  Board →
                </button>
              </div>

              <div style={{ padding: "8px 0" }}>
                {recentTasks.length === 0 ? (
                  <div style={{ padding: "24px 20px", textAlign: "center", color: "#667085", fontSize: "14px" }}>No tasks yet.</div>
                ) : (
                  recentTasks.map((task) => {
                    const emp = employees.find((e) => e.id === task.assignedToEmployeeId);
                    return (
                      <div
                        key={task.id}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 20px", cursor: "pointer", borderBottom: "1px solid #f7f8fa", transition: "background 100ms" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f7f8fa")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {emp && <EmpAvatar name={emp.displayName} size={30} />}
                        <p style={{ flex: 1, margin: 0, fontSize: "14px", color: "#101828", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {task.title}
                        </p>
                        <StatusBadge status={task.status} />
                        {task.costUsd > 0 && (
                          <span style={{ fontSize: "12px", color: "#667085", fontFamily: '"JetBrains Mono", "Fira Mono", monospace', flexShrink: 0 }}>
                            ${task.costUsd.toFixed(4)}
                          </span>
                        )}
                        <span style={{ fontSize: "12px", color: "#667085", flexShrink: 0 }}>{timeAgo(task.createdAt)}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Team status */}
          <div>
            <div style={{ background: "#fff", border: "1px solid #e4e7ec", borderRadius: "12px", boxShadow: "0 1px 2px rgba(16,24,40,0.05)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e4e7ec", display: "flex", alignItems: "center", gap: "12px" }}>
                <IconTile icon={<Users size={18} strokeWidth={1.75} />} bg="#e6f2f4" color="#0f5b6c" />
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#101828" }}>Your team</h3>
              </div>

              <div style={{ padding: "8px 0" }}>
                {employees.filter((e) => e.status !== "fired").length === 0 ? (
                  <div style={{ padding: "24px 20px", textAlign: "center", color: "#667085", fontSize: "14px" }}>No employees yet.</div>
                ) : (
                  employees.filter((e) => e.status !== "fired").map((emp) => {
                    const rs = employeeRuntimeStatus(emp, tasks);
                    return (
                      <div
                        key={emp.id}
                        style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 20px", borderBottom: "1px solid #f7f8fa" }}
                      >
                        <EmpAvatar name={emp.displayName} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#101828", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {emp.displayName}
                          </p>
                          <p style={{ margin: "1px 0 0", fontSize: "12px", color: "#667085", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {emp.roleDescription.split(/[,—]/)[0].trim()}
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "9999px", background: rs.dot, flexShrink: 0, display: "inline-block" }} />
                          <span style={{ fontSize: "12px", color: rs.labelColor, fontWeight: 500, textDecoration: emp.status === "paused" ? "line-through" : "none" }}>
                            {rs.label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <NewTaskModal employees={employees} onClose={() => setShowModal(false)} onCreated={load} />
      )}
    </AppShell>
  );
}
