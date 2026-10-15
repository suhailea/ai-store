import { useNavigate } from "react-router-dom";
import type { Task } from "@staffroom/types";
import { timeAgo } from "../../lib/emp";
import { C, TBadge } from "./shared";

export function WorkTable({ tasks, limit }: { tasks: Task[]; limit?: number }) {
  const navigate = useNavigate();
  const rows = limit ? tasks.slice(0, limit) : tasks;
  if (rows.length === 0) {
    return (
      <div style={{ padding: "32px 20px", textAlign: "center", color: C.inkMuted, fontSize: 14 }}>
        No tasks yet
      </div>
    );
  }
  const TH: React.CSSProperties = {
    padding: "8px 12px", fontSize: 11, fontWeight: 600, color: C.inkMuted,
    textAlign: "left", borderBottom: `1px solid ${C.line}`,
    letterSpacing: "0.04em", textTransform: "uppercase",
    background: C.surfaceSubtle,
  };
  const TD: React.CSSProperties = {
    padding: "10px 12px", borderBottom: `1px solid #f2f4f7`,
  };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 90 }} /><col /><col style={{ width: 145 }} />
          <col style={{ width: 80 }} /><col style={{ width: 80 }} />
        </colgroup>
        <thead>
          <tr>
            {["ID", "TASK", "STATUS", "COST", "WHEN"].map((h) => (
              <th key={h} style={TH}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} onClick={() => navigate(`/tasks/${t.id}`)} style={{ cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.surfaceSubtle)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <td style={{ ...TD, fontFamily: '"JetBrains Mono",monospace', fontSize: 12, color: C.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.id.slice(0, 8)}
              </td>
              <td style={{ ...TD, fontSize: 14, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.title}
              </td>
              <td style={TD}><TBadge status={t.status} /></td>
              <td style={{ ...TD, fontFamily: '"JetBrains Mono",monospace', fontSize: 12, color: C.inkMuted }}>
                ${t.costUsd.toFixed(4)}
              </td>
              <td style={{ ...TD, fontSize: 12, color: C.inkMuted, whiteSpace: "nowrap" }}>
                {timeAgo(t.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
