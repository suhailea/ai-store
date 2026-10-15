import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { employeesApi, tasksApi, auth } from "@/lib/api";
import type { Employee, Task } from "@staffroom/types";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  Plus,
  Mail,
  Calendar,
  Folder,
  Database,
  Upload,
  Network,
  MessageSquare,
  ChevronRight,
  MoreHorizontal,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import { empColor, initials, timeAgo, EMP_COLORS } from "@/lib/emp";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "ai" | "people";

interface MeData {
  user: { id: string; name: string; email: string; role: string };
  business: { id: string; name: string; industry: string; demoMode: boolean };
}

// ─── Integration badge data ───────────────────────────────────────────────────

function IntegrationIcon({ intg, size = 14 }: { intg: string; size?: number }) {
  const props = { width: size, height: size, strokeWidth: 1.75 };
  if (intg === "gmail")    return <Mail {...props} />;
  if (intg === "gcal")     return <Calendar {...props} />;
  if (intg === "drive")    return <Folder {...props} />;
  if (intg === "crm")      return <Database {...props} />;
  if (intg === "upload")   return <Upload {...props} />;
  if (intg === "internal") return <Network {...props} />;
  return <Network {...props} />;
}

const INTEGRATION_LABELS: Record<string, string> = {
  gmail:    "Gmail",
  gcal:     "Calendar",
  drive:    "Drive",
  crm:      "CRM",
  upload:   "Uploads",
  internal: "Internal",
};

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDotOverlay({ empStatus, tasks }: { empStatus: string; tasks: Task[] }) {
  const isRunning  = tasks.some((t) => t.status === "running");
  const isWaiting  = tasks.some((t) => t.status === "waiting_approval");
  const isPaused   = empStatus === "paused";

  let color = "#98a2b3"; // idle
  if (isPaused)  color = "#667085";
  else if (isRunning) color = "#22a06b";
  else if (isWaiting) color = "#f2a93b";

  return (
    <span
      style={{
        position: "absolute",
        bottom: "0px",
        right: "0px",
        width: "12px",
        height: "12px",
        borderRadius: "9999px",
        background: color,
        border: "2px solid #ffffff",
        display: "block",
      }}
    />
  );
}

// ─── Status label ─────────────────────────────────────────────────────────────

function StatusLabel({ empStatus, tasks }: { empStatus: string; tasks: Task[] }) {
  const isRunning  = tasks.some((t) => t.status === "running");
  const isWaiting  = tasks.some((t) => t.status === "waiting_approval");
  const isPaused   = empStatus === "paused";

  if (isPaused) {
    return (
      <span style={{ fontSize: "14px", color: "#667085" }}>
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "9999px",
            border: "2px solid #667085",
            marginRight: "6px",
            verticalAlign: "middle",
          }}
        />
        Paused
      </span>
    );
  }

  if (isRunning) {
    return (
      <span style={{ fontSize: "14px", color: "#22a06b" }}>
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "9999px",
            background: "#22a06b",
            marginRight: "6px",
            verticalAlign: "middle",
          }}
        />
        Working
      </span>
    );
  }

  if (isWaiting) {
    return (
      <span style={{ fontSize: "14px", color: "#f2a93b" }}>
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "9999px",
            background: "#f2a93b",
            marginRight: "6px",
            verticalAlign: "middle",
          }}
        />
        Waiting for you
      </span>
    );
  }

  return (
    <span style={{ fontSize: "14px", color: "#98a2b3" }}>
      <span
        style={{
          display: "inline-block",
          width: "8px",
          height: "8px",
          borderRadius: "9999px",
          background: "#98a2b3",
          marginRight: "6px",
          verticalAlign: "middle",
        }}
      />
      Idle
    </span>
  );
}

// ─── Employee card ────────────────────────────────────────────────────────────

function EmployeeCard({
  employee,
  tasks,
  onClick,
}: {
  employee: Employee;
  tasks: Task[];
  onClick: () => void;
}) {
  const c = empColor(employee.displayName);
  const isPaused = employee.status === "paused";
  const pct = Math.min(100, (employee.budgetUsedUsd / (employee.budgetMonthlyUsd || 1)) * 100);

  const budgetBarColor =
    pct >= 90 ? "#c0362c" : pct >= 75 ? "#b45309" : "#0f5b6c";

  const nearLimit = pct >= 90;
  const approvedCount = tasks.filter((t) => t.status === "done").length;
  const weekTasks = tasks.filter((t) => {
    const d = new Date(t.createdAt);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600000);
    return d >= weekAgo;
  });
  const approvedPct =
    weekTasks.length > 0
      ? Math.round((weekTasks.filter((t) => t.status === "done").length / weekTasks.length) * 100)
      : 0;

  const rolePrimary = employee.roleDescription.split(/[,—]/)[0].trim();

  return (
    <div
      style={{
        background: isPaused ? "#f7f8fa" : "#ffffff",
        border: "1px solid #e4e7ec",
        borderRadius: "12px",
        boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "6px" }}>
        {/* Avatar with status dot */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "9999px",
              background: c.bg,
              color: c.text,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "18px",
              userSelect: "none",
            }}
          >
            {initials(employee.displayName)}
          </div>
          <StatusDotOverlay empStatus={employee.status} tasks={tasks} />
        </div>

        {/* Name + role */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "#101828",
              margin: "0 0 2px",
              lineHeight: "22px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {employee.displayName}
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "#667085",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {rolePrimary}
          </p>
        </div>

        {/* Menu button */}
        <button
          style={{
            width: "28px",
            height: "28px",
            background: "none",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#8a94a6",
            flexShrink: 0,
          }}
        >
          <MoreHorizontal width={16} height={16} strokeWidth={1.75} />
        </button>
      </div>

      {/* Status label */}
      <div style={{ marginBottom: "8px" }}>
        <StatusLabel empStatus={employee.status} tasks={tasks} />
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: "14px",
          color: "#475467",
          lineHeight: "20px",
          marginBottom: "12px",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        } as React.CSSProperties}
      >
        {employee.roleDescription}
      </p>

      {/* Tool badges */}
      {employee.integrations.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
            marginBottom: "12px",
          }}
        >
          {employee.integrations.map((intg) => (
            <span
              key={intg}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 8px",
                borderRadius: "6px",
                background: "#f7f8fa",
                color: "#475467",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              <IntegrationIcon intg={intg} size={12} />
              {INTEGRATION_LABELS[intg] ?? intg}
            </span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "12px",
        }}
      >
        <div>
          <span style={{ fontSize: "13px", color: "#667085" }}>Tasks this week: </span>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#101828" }}>
            {weekTasks.length}
          </span>
        </div>
        <div>
          <span style={{ fontSize: "13px", color: "#667085" }}>Approved as-is: </span>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#101828" }}>
            {approvedPct}%
          </span>
        </div>
      </div>

      {/* Budget row */}
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "6px",
          }}
        >
          <span style={{ fontSize: "14px", color: "#101828" }}>
            <span style={{ fontWeight: 600 }}>
              ${employee.budgetUsedUsd.toFixed(2)}
            </span>
            <span style={{ color: "#667085" }}> of ${employee.budgetMonthlyUsd} this month</span>
          </span>
          {nearLimit && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                height: "22px",
                padding: "0 8px",
                borderRadius: "6px",
                background: "#fef4e4",
                color: "#b45309",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              <AlertTriangle width={12} height={12} strokeWidth={1.75} />
              Near limit
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: "6px",
            borderRadius: "9999px",
            background: "#eef1f4",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: "9999px",
              background: budgetBarColor,
              transition: "width 300ms ease",
            }}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          style={{
            flex: 1,
            height: "38px",
            background: "#ffffff",
            border: "1px solid #d0d5dd",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            color: "#101828",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <MessageSquare width={14} height={14} strokeWidth={1.75} />
          Message
        </button>
        <button
          onClick={onClick}
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
            gap: "4px",
          }}
        >
          Profile
          <ChevronRight width={14} height={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

// ─── Hire card ────────────────────────────────────────────────────────────────

function HireCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: "220px",
        background: "transparent",
        border: "1.5px dashed #d0d5dd",
        borderRadius: "12px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        transition: "border-color 120ms, background 120ms",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#0f5b6c";
        (e.currentTarget as HTMLButtonElement).style.background = "#e6f2f4";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#d0d5dd";
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "9999px",
          background: "#eef1f4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Plus width={18} height={18} strokeWidth={1.75} style={{ color: "#8a94a6" }} />
      </div>
      <span style={{ fontSize: "14px", fontWeight: 600, color: "#101828" }}>Hire employee</span>
    </button>
  );
}

// ─── People table ──────────────────────────────────────────────────────────────

function PeopleTable({ me }: { me: MeData | null }) {
  const c = me ? empColor(me.user.name) : EMP_COLORS[0];

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e4e7ec",
        borderRadius: "12px",
        boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid #e4e7ec",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#101828", margin: 0 }}>
          Staff members
        </h3>
        <button
          style={{
            height: "32px",
            padding: "0 12px",
            background: "#ffffff",
            border: "1px solid #d0d5dd",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 500,
            color: "#101828",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <UserPlus width={13} height={13} strokeWidth={1.75} />
          + Invite
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e4e7ec" }}>
            {["Name", "Role", "Last active"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "10px 20px",
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
          {me && (
            <tr style={{ borderBottom: "1px solid #f7f8fa" }}>
              <td style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "9999px",
                      background: c.bg,
                      color: c.text,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: "12px",
                      flexShrink: 0,
                    }}
                  >
                    {initials(me.user.name)}
                  </div>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "#101828", margin: 0, lineHeight: "20px" }}>
                      {me.user.name}
                    </p>
                    <p style={{ fontSize: "12px", color: "#667085", margin: 0, lineHeight: "16px" }}>
                      {me.user.email}
                    </p>
                  </div>
                </div>
              </td>
              <td style={{ padding: "14px 20px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: "22px",
                    padding: "0 8px",
                    borderRadius: "6px",
                    background: "#e6f2f4",
                    color: "#0f5b6c",
                    fontSize: "12px",
                    fontWeight: 500,
                    textTransform: "capitalize",
                  }}
                >
                  {me.user.role}
                </span>
              </td>
              <td style={{ padding: "14px 20px", color: "#667085", fontSize: "13px" }}>
                Just now
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!me && (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            color: "#667085",
            fontSize: "14px",
          }}
        >
          Loading…
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Team() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("ai");

  useEffect(() => {
    Promise.all([employeesApi.list(), tasksApi.list(), auth.me()])
      .then(([emps, tsks, meData]) => {
        setEmployees(emps);
        setTasks(tsks);
        setMe(meData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const aiEmployees = employees.filter((e) => e.status !== "fired");
  const allEmployees = employees;

  const tabList: { id: TabId; label: string }[] = [
    { id: "ai",     label: `AI employees ${aiEmployees.length}` },
    { id: "people", label: `People ${me ? 1 : 0}` },
  ];

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
        title="Team"
        subtitle={`${aiEmployees.length} AI employee${aiEmployees.length !== 1 ? "s" : ""}`}
        action={
          <div style={{ display: "flex", gap: "8px" }}>
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
              <UserPlus width={14} height={14} strokeWidth={1.75} />
              Invite staff
            </button>
            <button
              onClick={() => navigate("/hire")}
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
                gap: "6px",
              }}
            >
              <Plus width={14} height={14} strokeWidth={1.75} />
              Hire employee
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e4e7ec",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
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

      {/* AI employees tab */}
      {activeTab === "ai" && (
        <div style={{ padding: "24px 32px", overflowY: "auto" }}>
          {aiEmployees.length === 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "16px",
              }}
            >
              <HireCard onClick={() => navigate("/hire")} />
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "16px",
              }}
            >
              {aiEmployees.map((emp) => (
                <EmployeeCard
                  key={emp.id}
                  employee={emp}
                  tasks={tasks.filter((t) => t.assignedToEmployeeId === emp.id)}
                  onClick={() => navigate(`/team/${emp.id}`)}
                />
              ))}
              <HireCard onClick={() => navigate("/hire")} />
            </div>
          )}

          {/* Paused / fired section */}
          {employees.filter((e) => e.status === "paused").length > 0 && (
            <div style={{ marginTop: "32px" }}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#8a94a6",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: "12px",
                }}
              >
                Paused — {employees.filter((e) => e.status === "paused").length}
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "16px",
                }}
              >
                {employees
                  .filter((e) => e.status === "paused")
                  .map((emp) => (
                    <EmployeeCard
                      key={emp.id}
                      employee={emp}
                      tasks={tasks.filter((t) => t.assignedToEmployeeId === emp.id)}
                      onClick={() => navigate(`/team/${emp.id}`)}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* People tab */}
      {activeTab === "people" && (
        <div style={{ padding: "24px 32px", overflowY: "auto" }}>
          <PeopleTable me={me} />
        </div>
      )}
    </AppShell>
  );
}
