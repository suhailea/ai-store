import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { employeesApi, tasksApi } from "@/lib/api";
import type { Employee, Task } from "@staffroom/types";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  Plus,
  X,
  Search,
  Wrench,
} from "lucide-react";

import { empColor, initials, timeAgo } from "@/lib/emp";

// ─── EmpAvatar ────────────────────────────────────────────────────────────────

function EmpAvatar({ name, size = 22 }: { name: string; size?: number }) {
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
        fontSize: "9px",
        fontWeight: 700,
        color: text,
        lineHeight: 1,
      }}
    >
      {initials(name)}
    </div>
  );
}

// ─── Column config ────────────────────────────────────────────────────────────

const COLUMNS: {
  key: string;
  statuses: string[];
  label: string;
  dot: string;
  pulse?: boolean;
}[] = [
  { key: "assigned",       statuses: ["queued"],            label: "Assigned",         dot: "#98a2b3" },
  { key: "working",        statuses: ["running"],           label: "Working",           dot: "#22a06b", pulse: true },
  { key: "waiting",        statuses: ["waiting_approval"],  label: "Waiting for you",  dot: "#f2a93b" },
  { key: "done",           statuses: ["done"],              label: "Done",              dot: "#22a06b" },
  { key: "stopped",        statuses: ["stopped", "failed"], label: "Stopped",           dot: "#c0362c" },
];

// ─── TaskCard ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  employee,
  onClick,
}: {
  task: Task;
  employee: Employee | undefined;
  onClick: () => void;
}) {
  const isRunning = task.status === "running";
  const isWaiting = task.status === "waiting_approval";

  // Stable random progress width per task id
  const progressPct = (() => {
    let h = 0;
    for (let i = 0; i < task.id.length; i++) h = (h * 31 + task.id.charCodeAt(i)) >>> 0;
    return 20 + (h % 61); // 20–80
  })();

  const shortId = task.id.slice(-6).toUpperCase();

  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        border: `1px solid ${isWaiting ? "#f2a93b" : "#e4e7ec"}`,
        borderRadius: "8px",
        boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
        padding: "12px 14px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        transition: "box-shadow 150ms",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.04)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 2px rgba(16,24,40,0.05)")}
    >
      {/* Top row: task id + badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span
          style={{
            fontSize: "11px",
            color: "#667085",
            fontFamily: '"JetBrains Mono", "Fira Mono", monospace',
          }}
        >
          #{shortId}
        </span>
        {isWaiting && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "20px",
              padding: "0 7px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 500,
              background: "#fef4e4",
              color: "#b45309",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Needs approval
          </span>
        )}
      </div>

      {/* Title */}
      <p
        style={{
          margin: 0,
          fontSize: "14px",
          fontWeight: 600,
          color: "#101828",
          lineHeight: "20px",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {task.title}
      </p>

      {/* Progress bar for running tasks */}
      {isRunning && (
        <div
          style={{
            height: "4px",
            background: "#eef1f4",
            borderRadius: "9999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: "#0f5b6c",
              borderRadius: "9999px",
              animation: "progressPulse 2s ease-in-out infinite",
            }}
          />
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0 }}>
          {employee && <EmpAvatar name={employee.displayName} size={22} />}
          <span
            style={{
              fontSize: "12px",
              color: "#475467",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {employee?.displayName ?? "—"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {task.costUsd > 0 && (
            <>
              <Wrench size={12} strokeWidth={1.75} color="#8a94a6" />
              <span
                style={{
                  fontSize: "12px",
                  color: "#667085",
                  fontFamily: '"JetBrains Mono", "Fira Mono", monospace',
                }}
              >
                ${task.costUsd.toFixed(2)}
              </span>
            </>
          )}
          {task.costUsd === 0 && (
            <span style={{ fontSize: "12px", color: "#98a2b3" }}>{timeAgo(task.createdAt)}</span>
          )}
        </div>
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
            style={{ width: "28px", height: "28px", borderRadius: "6px", border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#667085" }}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#344054", marginBottom: "6px" }}>Assign to</label>
              <select
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                style={{ width: "100%", height: "38px", border: "1px solid #d0d5dd", borderRadius: "8px", padding: "0 12px", fontSize: "14px", color: "#101828", background: "#fff", outline: "none" }}
              >
                {activeEmps.map((e) => (
                  <option key={e.id} value={e.id}>{e.displayName}</option>
                ))}
                {activeEmps.length === 0 && <option disabled>No active employees</option>}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "#344054", marginBottom: "6px" }}>Task</label>
              <input
                ref={inputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What should they do?"
                style={{ width: "100%", height: "38px", border: "1px solid #d0d5dd", borderRadius: "8px", padding: "0 12px", fontSize: "14px", color: "#101828", background: "#fff", outline: "none", boxSizing: "border-box" }}
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
                style={{ width: "100%", border: "1px solid #d0d5dd", borderRadius: "8px", padding: "8px 12px", fontSize: "14px", color: "#101828", background: "#fff", outline: "none", resize: "none", lineHeight: "20px", boxSizing: "border-box", fontFamily: "inherit" }}
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
              style={{ height: "38px", padding: "0 16px", border: "1px solid #d0d5dd", borderRadius: "8px", background: "#fff", color: "#101828", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Board() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterEmpId, setFilterEmpId] = useState<string | null>(null);

  async function load() {
    const [emps, tsks] = await Promise.all([employeesApi.list(), tasksApi.list()]);
    setEmployees(emps);
    setTasks(tsks);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);

  const activeEmps = employees.filter((e) => e.status === "active");

  const filteredTasks = tasks.filter((t) => {
    if (filterEmpId && t.assignedToEmployeeId !== filterEmpId) return false;
    if (search) {
      const q = search.toLowerCase();
      const emp = employees.find((e) => e.id === t.assignedToEmployeeId);
      if (!t.title.toLowerCase().includes(q) && !(emp?.displayName.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const hasStopped = filteredTasks.some((t) => t.status === "stopped" || t.status === "stale");

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
      {/* Inject progress bar animation */}
      <style>{`
        @keyframes progressPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>

      <PageHeader
        title="Team board"
        subtitle="Every task across your team."
        breadcrumbs={[{ label: "Team board" }]}
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

      <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Filter bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Search */}
          <div
            style={{
              width: "280px",
              height: "36px",
              border: "1px solid #e4e7ec",
              borderRadius: "8px",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "0 10px",
              flexShrink: 0,
            }}
          >
            <Search size={14} strokeWidth={1.75} color="#8a94a6" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: "13px",
                color: "#101828",
                background: "transparent",
              }}
            />
          </div>

          {/* Employee select */}
          <select
            value={filterEmpId ?? ""}
            onChange={(e) => setFilterEmpId(e.target.value || null)}
            style={{
              height: "36px",
              border: "1px solid #e4e7ec",
              borderRadius: "8px",
              padding: "0 10px",
              fontSize: "13px",
              color: filterEmpId ? "#101828" : "#667085",
              background: "#fff",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">All employees</option>
            {activeEmps.map((e) => (
              <option key={e.id} value={e.id}>{e.displayName}</option>
            ))}
          </select>

          {/* Avatar filter buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {activeEmps.map((emp) => {
              const { bg, text } = empColor(emp.displayName);
              const selected = filterEmpId === emp.id;
              return (
                <button
                  key={emp.id}
                  onClick={() => setFilterEmpId(selected ? null : emp.id)}
                  title={emp.displayName}
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "9999px",
                    background: bg,
                    border: selected ? "2px solid #0f5b6c" : "2px solid transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: text,
                    outline: "none",
                    boxShadow: selected ? "0 0 0 2px #e6f2f4" : "none",
                    transition: "border-color 100ms",
                  }}
                >
                  {initials(emp.displayName)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Kanban board */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "16px",
            overflowX: "auto",
            alignItems: "start",
            paddingBottom: "24px",
          }}
        >
          {COLUMNS.map(({ key, statuses, label, dot, pulse }) => {
            const col = filteredTasks.filter((t) => statuses.includes(t.status));
            return (
              <div
                key={key}
                style={{
                  background: "#f7f8fa",
                  borderRadius: "12px",
                  padding: "12px",
                  minHeight: "200px",
                  width: "272px",
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "9999px",
                      background: dot,
                      flexShrink: 0,
                      display: "inline-block",
                      animation: pulse ? "dotPulse 2s ease-in-out infinite" : "none",
                    }}
                  />
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#101828", flex: 1, lineHeight: "20px" }}>
                    {label}
                  </h3>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "#667085",
                      background: "#eef1f4",
                      borderRadius: "9999px",
                      padding: "1px 8px",
                      lineHeight: "18px",
                    }}
                  >
                    {col.length}
                  </span>
                  <button
                    onClick={() => setShowModal(true)}
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
                      color: "#475467",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#e4e7ec")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <Plus size={14} strokeWidth={1.75} />
                  </button>
                </div>

                {/* Task cards */}
                {col.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: "80px",
                      fontSize: "13px",
                      color: "#98a2b3",
                      border: "1.5px dashed #d0d5dd",
                      borderRadius: "8px",
                    }}
                  >
                    No tasks
                  </div>
                ) : (
                  col.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      employee={employees.find((e) => e.id === task.assignedToEmployeeId)}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    />
                  ))
                )}
              </div>
            );
          })}

          {/* Stopped column — only if stopped tasks exist */}
          {hasStopped && (() => {
            const col = filteredTasks.filter((t) => t.status === "stopped" || t.status === "stale");
            return (
              <div
                style={{
                  background: "#f7f8fa",
                  borderRadius: "12px",
                  padding: "12px",
                  minHeight: "200px",
                  width: "272px",
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "9999px",
                      background: "#c0362c",
                      flexShrink: 0,
                      display: "inline-block",
                    }}
                  />
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#101828", flex: 1, lineHeight: "20px" }}>
                    Stopped
                  </h3>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "#667085",
                      background: "#eef1f4",
                      borderRadius: "9999px",
                      padding: "1px 8px",
                      lineHeight: "18px",
                    }}
                  >
                    {col.length}
                  </span>
                </div>

                {col.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    employee={employees.find((e) => e.id === task.assignedToEmployeeId)}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {showModal && (
        <NewTaskModal employees={employees} onClose={() => setShowModal(false)} onCreated={load} />
      )}
    </AppShell>
  );
}
