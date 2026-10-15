import type { Approval, Employee, Task } from "@staffroom/types";
import { Mail, Database, Calendar, FileText, FileSearch } from "lucide-react";
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

export function ApprovalListRow({
  row,
  selected,
  onClick,
}: {
  row: ApprovalRow;
  selected: boolean;
  onClick: () => void;
}) {
  const { approval, employee } = row;
  const remaining = timeUntil(approval.expiresAt);
  const isExpiring =
    approval.status === "pending" &&
    new Date(approval.expiresAt).getTime() - Date.now() < 4 * 3600000;

  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        padding: "12px 16px",
        minHeight: "72px",
        background: selected ? "#e6f2f4" : "transparent",
        borderLeft: selected ? "3px solid #0f5b6c" : "3px solid transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 100ms",
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "#f7f8fa";
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <EmpAvatar name={employee.displayName} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#101828",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: "20px",
          }}
        >
          {row.task.title}
        </p>
        <p
          style={{
            fontSize: "12px",
            color: "#667085",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: "18px",
          }}
        >
          {actionLabel(approval.actionType)} · {employee.displayName}
        </p>
      </div>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 500,
          color: isExpiring ? "#b45309" : "#667085",
          flexShrink: 0,
        }}
      >
        {remaining}
      </span>
    </button>
  );
}
