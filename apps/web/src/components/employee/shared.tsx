import React from "react";
import {
  Mail, Calendar, HardDrive, BarChart2, Upload, Network,
} from "lucide-react";

// ─── Design tokens ─────────────────────────────────────────────────────────────

export const C = {
  ink: "#101828",
  inkSecondary: "#475467",
  inkMuted: "#667085",
  icon: "#8a94a6",
  surface: "#fff",
  surfaceSubtle: "#f7f8fa",
  surfaceSunken: "#eef1f4",
  line: "#e4e7ec",
  lineStrong: "#d0d5dd",
  controlBorder: "#8a94a6",
  brand: "#0f5b6c",
  brandSoft: "#e6f2f4",
  brandHover: "#0b4a58",
  successFg: "#157f4f",
  successBg: "#e8f6ee",
  warningFg: "#b45309",
  warningBg: "#fef4e4",
  dangerFg: "#c0362c",
  dangerBg: "#fdecea",
  infoFg: "#1d63c8",
  infoBg: "#eaf1fc",
};

// ─── Integration icons / labels ────────────────────────────────────────────────

export const INTG_ICONS: Record<string, React.ReactNode> = {
  gmail:    <Mail    size={14} strokeWidth={1.75} />,
  gcal:     <Calendar size={14} strokeWidth={1.75} />,
  drive:    <HardDrive size={14} strokeWidth={1.75} />,
  crm:      <BarChart2 size={14} strokeWidth={1.75} />,
  upload:   <Upload size={14} strokeWidth={1.75} />,
  internal: <Network size={14} strokeWidth={1.75} />,
};

export const INTG_LABELS: Record<string, string> = {
  gmail: "Gmail", gcal: "Calendar", drive: "Drive",
  crm: "CRM", upload: "Uploads", internal: "Internal",
};

// ─── Provider / tool metadata ──────────────────────────────────────────────────

export const PROVIDER_META: Record<string, { label: string; intgKey: string }> = {
  gmail:           { label: "Gmail",           intgKey: "gmail"         },
  google_calendar: { label: "Google Calendar", intgKey: "gcal"          },
  google_drive:    { label: "Google Drive",    intgKey: "google_drive"  },
  google_sheets:   { label: "Google Sheets",   intgKey: "google_sheets" },
  slack:           { label: "Slack",           intgKey: "slack"         },
  excel:           { label: "Excel",           intgKey: "excel"         },
};

export const NATIVE_TOOLS: Record<string, { toolName: string; description: string; readOnly: boolean }[]> = {
  gmail: [
    { toolName: "list_emails",    description: "List recent emails from the inbox",                   readOnly: true  },
    { toolName: "get_email",      description: "Read a specific email by ID",                         readOnly: true  },
    { toolName: "draft_email",    description: "Draft an email (requires approval to send)",          readOnly: false },
    { toolName: "send_email",     description: "Send an approved email",                              readOnly: false },
  ],
  google_calendar: [
    { toolName: "list_events",    description: "List events within a date range",                     readOnly: true  },
    { toolName: "get_event",      description: "Fetch full details of a single event",                readOnly: true  },
    { toolName: "create_event",   description: "Create a new calendar event (needs approval)",        readOnly: false },
    { toolName: "update_event",   description: "Update an existing event (needs approval)",           readOnly: false },
    { toolName: "delete_event",   description: "Delete a calendar event (needs approval)",            readOnly: false },
  ],
  google_drive: [
    { toolName: "drive_list_files",  description: "List files and folders in Google Drive",           readOnly: true  },
    { toolName: "drive_get_file",    description: "Get metadata and content of a Drive file",         readOnly: true  },
    { toolName: "drive_create_file", description: "Create a new file in Google Drive (needs approval)", readOnly: false },
    { toolName: "drive_update_file", description: "Update an existing Drive file (needs approval)",   readOnly: false },
  ],
  google_sheets: [
    { toolName: "sheets_list",       description: "List all sheets in a spreadsheet",                   readOnly: true  },
    { toolName: "sheets_read",       description: "Read cell values from a spreadsheet range",          readOnly: true  },
    { toolName: "sheets_write",      description: "Write rows to a spreadsheet range (needs approval)", readOnly: false },
  ],
  excel: [
    { toolName: "excel_list_sheets", description: "List all sheets in the connected Excel file",              readOnly: true  },
    { toolName: "excel_read_sheet",  description: "Read rows from a sheet in the Excel file",                 readOnly: true  },
    { toolName: "excel_write_sheet", description: "Append or update rows in the Excel file (needs approval)", readOnly: false },
  ],
};

// ─── Memory kind styles ────────────────────────────────────────────────────────

export const MEMORY_KIND_STYLES: Record<string, { bg: string; fg: string }> = {
  instruction: { bg: "#e6f2f4", fg: "#0f5b6c" },
  preference:  { bg: "#eaf0fc", fg: "#2f62c9" },
  correction:  { bg: "#fdecea", fg: "#c0362c" },
  episodic:    { bg: "#eef1f4", fg: "#475467" },
  learned:     { bg: "#eaf1fc", fg: "#1d63c8" },
};

// ─── Task status badge styles ──────────────────────────────────────────────────

export const TASK_ST: Record<string, { bg: string; fg: string; label: string }> = {
  running:          { bg: C.infoBg,    fg: C.infoFg,    label: "Working"         },
  waiting_approval: { bg: C.warningBg, fg: C.warningFg, label: "Waiting for you" },
  done:             { bg: C.successBg, fg: C.successFg, label: "Done"            },
  queued:           { bg: C.surfaceSunken, fg: C.inkMuted, label: "Queued"       },
  stopped:          { bg: C.dangerBg,  fg: C.dangerFg,  label: "Stopped"        },
  stale:            { bg: C.dangerBg,  fg: C.dangerFg,  label: "Stale"          },
};

// ─── Tiny reusable UI atoms ────────────────────────────────────────────────────

export function IconTile({ icon, bg, color }: { icon: React.ReactNode; bg: string; color: string }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: bg, color,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {icon}
    </div>
  );
}

export function SCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.line}`,
      borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
      overflow: "hidden", ...style,
    }}>
      {children}
    </div>
  );
}

export function SCardHeader({
  icon, title, subtitle, action,
}: { icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div style={{
      padding: "16px 20px", borderBottom: `1px solid ${C.line}`,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: 0, lineHeight: "20px" }}>
          {title}
        </h3>
        {subtitle && (
          <p style={{ fontSize: 12, color: C.inkMuted, margin: 0, lineHeight: "18px" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

export function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: "none", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 4,
      height: 30, padding: "0 8px", borderRadius: 6,
      fontSize: 13, fontWeight: 500, color: C.inkSecondary,
    }}>
      {children}
    </button>
  );
}

export function SecBtn({
  children, onClick, disabled,
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", gap: 6,
      height: 38, padding: "0 16px", borderRadius: 8,
      border: `1px solid ${C.lineStrong}`, background: C.surface,
      color: C.ink, fontSize: 14, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
    }}>
      {children}
    </button>
  );
}

export function TBadge({ status }: { status: string }) {
  const s = TASK_ST[status] ?? { bg: C.surfaceSunken, fg: C.inkMuted, label: status };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      height: 22, padding: "0 8px", borderRadius: 6,
      background: s.bg, color: s.fg,
      fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}

export function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12,
      boxShadow: "0 1px 2px rgba(16,24,40,0.05)", padding: "16px 20px",
    }}>
      <p style={{ fontSize: 12, color: C.inkMuted, marginBottom: 6, fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: C.ink, letterSpacing: "-0.01em", margin: 0 }}>
        {value}
      </p>
    </div>
  );
}

export function BudgetSection({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, total > 0 ? (used / total) * 100 : 0);
  const fill = pct >= 90 ? C.dangerFg : pct >= 75 ? C.warningFg : C.brand;
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  return (
    <div style={{ padding: "16px 20px" }}>
      <p style={{ fontSize: 24, fontWeight: 600, color: C.ink, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
        ${used.toFixed(2)}{" "}
        <span style={{ fontSize: 14, fontWeight: 400, color: C.inkMuted }}>of ${total} / month</span>
      </p>
      <div style={{ height: 6, borderRadius: 9999, background: C.surfaceSunken, marginBottom: 8, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 9999, background: fill, transition: "width .3s" }} />
      </div>
      <p style={{ fontSize: 12, color: C.inkMuted, margin: 0 }}>
        Resets in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
