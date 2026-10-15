import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell, PageHeader } from "@/components/AppShell";
import { CheckCircle2, AlertCircle, Search, Loader2, X } from "lucide-react";
import { connectorsApi } from "@/lib/api";

// ─── Connector registry ───────────────────────────────────────────────────────
// To add a new connector: add one entry to this array. Nothing else to change.

type ConnectorStatus = "connected" | "disconnected" | "error";
type ConnectorCategory = "Email" | "Calendar" | "Storage" | "Database" | "CRM" | "Communication" | "Other";
type ConnectType = "oauth" | "credentials" | "upload";

interface Connector {
  id: string;
  name: string;
  description: string;
  category: ConnectorCategory;
  logo: string;       // SVG string rendered inline
  connectType?: ConnectType;  // defaults to "oauth"
  docsUrl?: string;   // optional "Learn more" link
  comingSoon?: boolean;
}

const CONNECTORS: Connector[] = [
  // ── Email ──────────────────────────────────────────────────────────────────
  {
    id: "gmail",
    name: "Gmail",
    description: "Read, send and manage emails from Google Gmail accounts.",
    category: "Email",
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 40V8l18 14L42 8v32" fill="none"/>
      <path d="M6 8h36L24 22 6 8z" fill="#EA4335"/>
      <path d="M6 8v32h8V20l10 8 10-8v20h8V8" fill="none"/>
      <path d="M6 8v32h8V20l10 8 10-8v20h8V8H6z" fill="#4285F4" opacity="0"/>
      <rect x="0" y="0" width="48" height="48" fill="none"/>
      <path fill="#4285F4" d="M6 40h8V20l10 8 10-8v20h8V8H6v32z" opacity="0"/>
      <path fill="#34A853" d="M14 40h20V20L24 28 14 20v20z" opacity="0"/>
      <path d="M6 8l18 14L42 8H6z" fill="#EA4335"/>
      <path d="M6 8v32h8V20l10 8" fill="#4285F4"/>
      <path d="M42 8v32h-8V20l-10 8" fill="#FBBC05"/>
      <path d="M14 20l10 8 10-8v20H14V20z" fill="#34A853"/>
    </svg>`,
  },
  {
    id: "outlook",
    name: "Outlook",
    description: "Connect Microsoft Outlook to read and send emails via Microsoft 365.",
    category: "Email",
    comingSoon: true,
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="10" width="26" height="28" rx="2" fill="#0078D4"/>
      <rect x="20" y="14" width="22" height="20" rx="2" fill="#28A8E8"/>
      <ellipse cx="17" cy="24" rx="7" ry="8" fill="white"/>
      <ellipse cx="17" cy="24" rx="5" ry="6" fill="#0078D4"/>
      <rect x="20" y="14" width="22" height="20" rx="2" fill="#50D9FF" opacity="0.3"/>
      <path d="M20 14h22l-11 9-11-9z" fill="#28A8E8"/>
    </svg>`,
  },

  // ── Calendar ───────────────────────────────────────────────────────────────
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "View, create and manage events in Google Calendar.",
    category: "Calendar",
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="10" width="36" height="32" rx="3" fill="white" stroke="#E0E0E0" stroke-width="1"/>
      <rect x="6" y="10" width="36" height="10" rx="3" fill="#4285F4"/>
      <rect x="6" y="16" width="36" height="4" fill="#4285F4"/>
      <rect x="10" y="6" width="4" height="8" rx="2" fill="#1565C0"/>
      <rect x="34" y="6" width="4" height="8" rx="2" fill="#1565C0"/>
      <text x="24" y="36" text-anchor="middle" font-size="14" font-weight="700" fill="#4285F4" font-family="sans-serif">31</text>
    </svg>`,
  },
  {
    id: "outlook_calendar",
    name: "Outlook Calendar",
    description: "View, create and manage events in Microsoft Outlook Calendar.",
    category: "Calendar",
    comingSoon: true,
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="10" width="36" height="32" rx="3" fill="white" stroke="#E0E0E0" stroke-width="1"/>
      <rect x="6" y="10" width="36" height="10" rx="3" fill="#0078D4"/>
      <rect x="6" y="16" width="36" height="4" fill="#0078D4"/>
      <rect x="10" y="6" width="4" height="8" rx="2" fill="#005A9E"/>
      <rect x="34" y="6" width="4" height="8" rx="2" fill="#005A9E"/>
      <text x="24" y="36" text-anchor="middle" font-size="14" font-weight="700" fill="#0078D4" font-family="sans-serif">31</text>
    </svg>`,
  },

  // ── Storage ────────────────────────────────────────────────────────────────
  {
    id: "google_drive",
    name: "Google Drive",
    description: "Read, upload and manage files and folders in Google Drive.",
    category: "Storage",
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 38L6 22l10-18h16l10 18-10 16H16z" fill="none"/>
      <path d="M6 22L16 6h16L22 22H6z" fill="#4285F4"/>
      <path d="M32 6l10 16-10 16H16L26 22 32 6z" fill="#FBBC05"/>
      <path d="M6 22l10 16h16L22 22H6z" fill="#34A853"/>
    </svg>`,
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    description: "Read and write data in Google Sheets spreadsheets.",
    category: "Storage",
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="4" width="28" height="40" rx="2" fill="#34A853"/>
      <rect x="14" y="16" width="20" height="2" rx="1" fill="white" opacity="0.8"/>
      <rect x="14" y="21" width="20" height="2" rx="1" fill="white" opacity="0.8"/>
      <rect x="14" y="26" width="20" height="2" rx="1" fill="white" opacity="0.8"/>
      <rect x="14" y="31" width="12" height="2" rx="1" fill="white" opacity="0.8"/>
      <rect x="24" y="4" width="14" height="12" rx="2" fill="#0F9D58"/>
      <path d="M24 4l14 12H24V4z" fill="#27AA60"/>
    </svg>`,
  },
  {
    id: "excel",
    name: "Excel",
    description: "Upload an Excel (.xlsx) or CSV file for your AI employees to read and analyse.",
    category: "Storage",
    connectType: "upload",
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="4" width="36" height="40" rx="3" fill="#217346"/>
      <path d="M14 16l5 8-5 8h4l3-5 3 5h4l-5-8 5-8h-4l-3 5-3-5h-4z" fill="white"/>
      <rect x="24" y="16" width="14" height="2" rx="1" fill="white" opacity="0.6"/>
      <rect x="24" y="22" width="14" height="2" rx="1" fill="white" opacity="0.6"/>
      <rect x="24" y="28" width="14" height="2" rx="1" fill="white" opacity="0.6"/>
    </svg>`,
  },
  {
    id: "onedrive",
    name: "OneDrive",
    description: "Read, upload and manage files in Microsoft OneDrive.",
    category: "Storage",
    comingSoon: true,
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M28 34H10a8 8 0 010-16c.3 0 .6 0 .9.03A10 10 0 0130 14a10 10 0 019.9 8.6A8 8 0 0138 38H28" fill="#0078D4"/>
      <path d="M20 34h18a6 6 0 000-12c-.2 0-.4 0-.6.02A8 8 0 0022 16a8 8 0 00-7.9 7.1A6 6 0 0014 34h6z" fill="#28A8E8"/>
    </svg>`,
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Access and manage files stored in your Dropbox account.",
    category: "Storage",
    comingSoon: true,
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 8L4 14l10 8 10-8L14 8z" fill="#0061FF"/>
      <path d="M34 8l-10 6 10 8 10-8L34 8z" fill="#0061FF"/>
      <path d="M4 30l10 8 10-8-10-6L4 30z" fill="#0061FF"/>
      <path d="M44 30l-10 8-10-8 10-6 10 6z" fill="#0061FF"/>
      <path d="M24 40l-10-6 10-6 10 6-10 6z" fill="#0061FF"/>
    </svg>`,
  },

  // ── Database ───────────────────────────────────────────────────────────────
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Query tables, insert and update rows in any PostgreSQL database via connection string.",
    category: "Database",
    connectType: "credentials",
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="24" cy="14" rx="16" ry="6" fill="#336791"/>
      <rect x="8" y="14" width="32" height="20" fill="#336791"/>
      <ellipse cx="24" cy="34" rx="16" ry="6" fill="#2e5e85"/>
      <ellipse cx="24" cy="14" rx="16" ry="6" fill="#4a90c4"/>
      <ellipse cx="24" cy="22" rx="16" ry="6" fill="#2e5e85"/>
      <ellipse cx="24" cy="22" rx="16" ry="6" fill="#4a90c4" opacity="0.5"/>
      <rect x="8" y="22" width="32" height="12" fill="#336791"/>
      <ellipse cx="24" cy="34" rx="16" ry="6" fill="#4a90c4"/>
    </svg>`,
  },

  // ── CRM ────────────────────────────────────────────────────────────────────
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Read and update contacts, deals and companies in HubSpot CRM.",
    category: "CRM",
    comingSoon: true,
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="20" fill="#FF7A59"/>
      <path d="M20 16v8m8-8v8m-8 0h8m0 0v8a4 4 0 01-8 0v-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="32" cy="16" r="3" fill="white"/>
    </svg>`,
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Read and update leads, contacts and opportunities in Salesforce.",
    category: "CRM",
    comingSoon: true,
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 10a8 8 0 018 6 6 6 0 016 6 5 5 0 010 10H14a7 7 0 01-2-13.7A8 8 0 0120 10z" fill="#00A1E0"/>
      <path d="M18 26l4 4 8-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },

  // ── Communication ──────────────────────────────────────────────────────────
  {
    id: "slack",
    name: "Slack",
    description: "Send messages and notifications to Slack channels and users.",
    category: "Communication",
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 28a4 4 0 01-4-4 4 4 0 014-4h4v4a4 4 0 01-4 4z" fill="#E01E5A"/>
      <path d="M24 28h-4V16a4 4 0 014-4 4 4 0 014 4 4 4 0 01-4 4z" fill="#E01E5A"/>
      <path d="M20 12a4 4 0 014-4 4 4 0 014 4v4h-4a4 4 0 01-4-4z" fill="#36C5F0"/>
      <path d="M36 20a4 4 0 014 4 4 4 0 01-4 4h-4v-4a4 4 0 014-4z" fill="#36C5F0"/>
      <path d="M24 20h4v12a4 4 0 01-4 4 4 4 0 01-4-4 4 4 0 014-4z" fill="#2EB67D"/>
      <path d="M28 36a4 4 0 01-4 4 4 4 0 01-4-4v-4h4a4 4 0 014 4z" fill="#ECB22E"/>
      <path d="M12 28a4 4 0 01-4-4v-4h8a4 4 0 01-4 8z" fill="#ECB22E" opacity="0"/>
      <path d="M16 24h-4a4 4 0 010-8 4 4 0 014 4v4z" fill="#ECB22E"/>
    </svg>`,
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description: "Send messages and notifications to Microsoft Teams channels.",
    category: "Communication",
    comingSoon: true,
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M30 18h8a4 4 0 014 4v10a4 4 0 01-4 4h-8V18z" fill="#5059C9"/>
      <circle cx="34" cy="13" r="5" fill="#5059C9"/>
      <path d="M6 18h22a4 4 0 014 4v12a4 4 0 01-4 4H6V18z" fill="#7B83EB"/>
      <circle cx="17" cy="12" r="7" fill="#7B83EB"/>
      <circle cx="17" cy="12" r="5" fill="#7B83EB"/>
      <path d="M10 28l4 4 8-8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },

  // ── Other ──────────────────────────────────────────────────────────────────
  {
    id: "notion",
    name: "Notion",
    description: "Read and write pages, databases and notes in Notion workspaces.",
    category: "Other",
    comingSoon: true,
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="36" height="36" rx="6" fill="white" stroke="#E0E0E0" stroke-width="1.5"/>
      <path d="M14 14h14l8 8v12H14V14z" fill="#1A1A1A"/>
      <path d="M28 14l8 8h-8V14z" fill="#555"/>
      <path d="M18 22h12M18 26h10M18 30h8" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: "airtable",
    name: "Airtable",
    description: "Read and update records in Airtable bases and tables.",
    category: "Other",
    comingSoon: true,
    logo: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 8l18 7-18 7L6 15l18-7z" fill="#FCB400"/>
      <path d="M26 23v14l16-6V17L26 23z" fill="#18BFFF"/>
      <path d="M22 23v14L6 31V17l16 6z" fill="#F82B60"/>
    </svg>`,
  },
];

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ORDER: ConnectorCategory[] = [
  "Email", "Calendar", "Storage", "Database", "CRM", "Communication", "Other",
];

// ─── Connector card ───────────────────────────────────────────────────────────

function ConnectorCard({
  connector,
  status,
  accountEmail,
  disconnecting,
  onConnect,
  onDisconnect,
}: {
  connector: Connector;
  status: ConnectorStatus;
  accountEmail: string | null;
  disconnecting: boolean;
  onConnect: () => void;    // for oauth this navigates; for credentials this opens modal
  onDisconnect: () => void;
}) {
  const isConnected = status === "connected";
  const isError = status === "error";

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${isError ? "#fdecea" : "#e4e7ec"}`,
      borderRadius: 12,
      boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
      position: "relative",
      transition: "box-shadow 150ms",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(16,24,40,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 2px rgba(16,24,40,0.05)")}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Logo */}
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          border: "1px solid #e4e7ec", background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", padding: 6,
        }}
          dangerouslySetInnerHTML={{ __html: connector.logo }}
        />

        {/* Name + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#101828", margin: 0, lineHeight: "20px" }}>
            {connector.name}
          </p>
          <p style={{ fontSize: 13, color: "#667085", margin: "3px 0 0", lineHeight: "18px" }}>
            {connector.description}
          </p>
        </div>
      </div>

      {/* Status + action */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {/* Status badge */}
        {isConnected && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 12, fontWeight: 500, color: "#157f4f",
          }}>
            <CheckCircle2 size={13} strokeWidth={2} />
            {accountEmail ? accountEmail : "Connected"}
          </span>
        )}
        {isError && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 12, fontWeight: 500, color: "#c0362c",
          }}>
            <AlertCircle size={13} strokeWidth={2} />
            Auth error
          </span>
        )}
        {status === "disconnected" && (
          <span style={{ fontSize: 12, color: "#98a2b3" }}>Not connected</span>
        )}

        {/* Action button */}
        {connector.comingSoon ? (
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
            textTransform: "uppercase", color: "#8a94a6",
            background: "#f2f4f7", border: "1px solid #e4e7ec",
            borderRadius: 6, padding: "3px 8px",
          }}>
            Coming soon
          </span>
        ) : isConnected || isError ? (
          <button
            onClick={onDisconnect}
            disabled={disconnecting}
            style={{
              height: 30, padding: "0 12px",
              background: "transparent", border: "1px solid #d0d5dd",
              borderRadius: 8, fontSize: 13, fontWeight: 500,
              color: "#475467", cursor: disconnecting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 5,
              opacity: disconnecting ? 0.6 : 1,
            }}
          >
            {disconnecting && <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />}
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            style={{
              height: 30, padding: "0 14px",
              background: "#0f5b6c", border: "none",
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              color: "#fff", cursor: "pointer",
            }}
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FILTER_TABS: { id: ConnectorStatus | "all"; label: string }[] = [
  { id: "all",          label: "All"          },
  { id: "connected",    label: "Connected"    },
  { id: "disconnected", label: "Not connected" },
];

// Shape returned by GET /api/connectors
interface ConnectedAccount {
  id: string;
  provider: string;
  accountEmail: string | null;
  connectedAt: string;
}

export default function Connectors() {
  const [searchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ConnectorStatus | "all">("all");

  // Toast for post-OAuth redirect feedback
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Credentials modal (for non-OAuth connectors like postgres)
  const [credModal, setCredModal] = useState<{ providerId: string; label: string } | null>(null);
  const [connString, setConnString] = useState("");
  const [connecting, setConnecting] = useState(false);
  const connStringRef = useRef<HTMLInputElement>(null);

  // File upload modal (for upload-type connectors like excel)
  const [uploadModal, setUploadModal] = useState<{ providerId: string; label: string } | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await connectorsApi.list();
      setAccounts(data);
    } catch {
      // silently ignore — user not authed yet or API down
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Handle redirect back from OAuth with ?connected=provider or ?error=...
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      const label = CONNECTORS.find((c) => c.id === connected)?.name ?? connected;
      setToast({ msg: `${label} connected successfully`, ok: true });
      loadAccounts(); // refresh list
      window.history.replaceState({}, "", "/connectors");
    } else if (error) {
      setToast({ msg: `Connection failed: ${error.replace(/_/g, " ")}`, ok: false });
      window.history.replaceState({}, "", "/connectors");
    }
    if (connected || error) {
      setTimeout(() => setToast(null), 5000);
    }
  }, [searchParams, loadAccounts]);

  function connect(connector: Connector) {
    if (connector.connectType === "credentials") {
      setConnString("");
      setCredModal({ providerId: connector.id, label: connector.name });
      setTimeout(() => connStringRef.current?.focus(), 50);
    } else if (connector.connectType === "upload") {
      setUploadFile(null);
      setUploadModal({ providerId: connector.id, label: connector.name });
    } else {
      window.location.href = connectorsApi.connectUrl(connector.id);
    }
  }

  async function submitUpload() {
    if (!uploadModal || !uploadFile) return;
    setUploading(true);
    try {
      await connectorsApi.connectExcel(uploadFile);
      setUploadModal(null);
      setUploadFile(null);
      await loadAccounts();
      setToast({ msg: `${uploadModal.label} connected successfully`, ok: true });
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Upload failed", ok: false });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setUploading(false);
    }
  }

  async function submitCredentials() {
    if (!credModal || !connString.trim()) return;
    setConnecting(true);
    try {
      await connectorsApi.connectPostgres(connString.trim());
      setCredModal(null);
      setConnString("");
      await loadAccounts();
      setToast({ msg: `${credModal.label} connected successfully`, ok: true });
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Connection failed", ok: false });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect(connector: Connector, account: ConnectedAccount) {
    setDisconnecting(account.id);
    try {
      await connectorsApi.disconnect(account.id);
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
    } catch {
      setToast({ msg: `Failed to disconnect ${connector.name}`, ok: false });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDisconnecting(null);
    }
  }

  // Derive status of each connector from the live accounts list
  function statusOf(providerId: string): ConnectorStatus {
    return accounts.some((a) => a.provider === providerId) ? "connected" : "disconnected";
  }

  function accountFor(providerId: string): ConnectedAccount | undefined {
    return accounts.find((a) => a.provider === providerId);
  }

  const connectedCount = accounts.length;

  // Apply search + status filter, then group by category
  const filtered = CONNECTORS.filter((c) => {
    const matchesSearch =
      search.trim() === "" ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase());
    // Coming-soon connectors only appear under "all", not under connected/disconnected filters
    const matchesFilter =
      activeFilter === "all" || (!c.comingSoon && statusOf(c.id) === activeFilter);
    return matchesSearch && matchesFilter;
  });

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: filtered.filter((c) => c.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <AppShell>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <PageHeader
        title="Connectors"
        subtitle={loading ? "Loading…" : `${connectedCount} of ${CONNECTORS.length} connected · Link tools your AI employees can use`}
      />

      {/* Credentials modal (for non-OAuth connectors) */}
      {credModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(16,24,40,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onClick={(e) => { if (e.target === e.currentTarget) { setCredModal(null); } }}
        >
          <div style={{
            background: "#fff", borderRadius: 14,
            boxShadow: "0 8px 32px rgba(16,24,40,0.16)",
            padding: "28px 28px 24px",
            width: 440, maxWidth: "calc(100vw - 48px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#101828", margin: 0 }}>
                Connect {credModal.label}
              </p>
              <button
                onClick={() => setCredModal(null)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#667085", padding: 4, display: "flex" }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#667085", margin: "0 0 14px" }}>
              Paste your PostgreSQL connection string. The connection will be tested before saving.
            </p>

            <input
              ref={connStringRef}
              type="text"
              value={connString}
              onChange={(e) => setConnString(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitCredentials(); }}
              placeholder="postgresql://user:password@host:5432/dbname"
              style={{
                width: "100%", boxSizing: "border-box",
                height: 38, padding: "0 12px",
                border: "1px solid #d0d5dd", borderRadius: 8,
                fontSize: 13, fontFamily: "JetBrains Mono, monospace",
                outline: "none", color: "#101828",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#0f5b6c"; }}
              onBlur={(e) => { e.target.style.borderColor = "#d0d5dd"; }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
              <button
                onClick={() => setCredModal(null)}
                style={{
                  height: 34, padding: "0 16px",
                  background: "transparent", border: "1px solid #d0d5dd",
                  borderRadius: 8, fontSize: 13, fontWeight: 500,
                  color: "#475467", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitCredentials}
                disabled={connecting || !connString.trim()}
                style={{
                  height: 34, padding: "0 18px",
                  background: connecting || !connString.trim() ? "#8a94a6" : "#0f5b6c",
                  border: "none", borderRadius: 8,
                  fontSize: 13, fontWeight: 600, color: "#fff",
                  cursor: connecting || !connString.trim() ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 7,
                }}
              >
                {connecting && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                {connecting ? "Testing…" : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File upload modal (for Excel and similar) */}
      {uploadModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(16,24,40,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onClick={(e) => { if (e.target === e.currentTarget) { setUploadModal(null); } }}
        >
          <div style={{
            background: "#fff", borderRadius: 14,
            boxShadow: "0 8px 32px rgba(16,24,40,0.16)",
            padding: "28px 28px 24px",
            width: 440, maxWidth: "calc(100vw - 48px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#101828", margin: 0 }}>
                Upload {uploadModal.label}
              </p>
              <button
                onClick={() => setUploadModal(null)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#667085", padding: 4, display: "flex" }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#667085", margin: "0 0 14px" }}>
              Upload an .xlsx, .xls, or .csv file. Your AI employees will be able to read and analyse its contents.
            </p>

            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) setUploadFile(f);
              }}
              style={{
                border: `2px dashed ${uploadFile ? "#0f5b6c" : "#d0d5dd"}`,
                borderRadius: 10, padding: "24px 16px",
                textAlign: "center", cursor: "pointer",
                background: uploadFile ? "#f0f9fa" : "#f9fafb",
                transition: "all 120ms",
              }}
            >
              {uploadFile ? (
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0f5b6c", margin: 0 }}>
                  {uploadFile.name}
                  <span style={{ fontWeight: 400, color: "#667085", marginLeft: 6 }}>
                    ({(uploadFile.size / 1024).toFixed(0)} KB)
                  </span>
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#475467", margin: "0 0 4px" }}>
                    Click to browse or drag and drop
                  </p>
                  <p style={{ fontSize: 12, color: "#98a2b3", margin: 0 }}>
                    .xlsx, .xls, .csv — max 10 MB
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadFile(f); }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
              <button
                onClick={() => setUploadModal(null)}
                style={{
                  height: 34, padding: "0 16px",
                  background: "transparent", border: "1px solid #d0d5dd",
                  borderRadius: 8, fontSize: 13, fontWeight: 500,
                  color: "#475467", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitUpload}
                disabled={uploading || !uploadFile}
                style={{
                  height: 34, padding: "0 18px",
                  background: uploading || !uploadFile ? "#8a94a6" : "#0f5b6c",
                  border: "none", borderRadius: 8,
                  fontSize: 13, fontWeight: 600, color: "#fff",
                  cursor: uploading || !uploadFile ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 7,
                }}
              >
                {uploading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 100,
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px", borderRadius: 10,
          background: toast.ok ? "#157f4f" : "#c0362c",
          color: "#fff", fontSize: 13, fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}>
          {toast.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e4e7ec",
        padding: "0 32px", display: "flex", alignItems: "center", gap: 12,
        flexShrink: 0,
      }}>
        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          height: 36, padding: "0 12px", borderRadius: 8,
          border: "1px solid #e4e7ec", background: "#f7f8fa",
          width: 260, flexShrink: 0, margin: "12px 0",
        }}>
          <Search size={13} strokeWidth={1.75} style={{ color: "#8a94a6", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search connectors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, border: "none", outline: "none",
              background: "transparent", fontSize: 13,
              color: "#101828",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ border: "none", background: "none", cursor: "pointer", color: "#8a94a6", padding: 0, lineHeight: 1 }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Status filter tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              style={{
                height: 30, padding: "0 12px", borderRadius: 6,
                border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
                background: activeFilter === tab.id ? "#e6f2f4" : "transparent",
                color: activeFilter === tab.id ? "#0f5b6c" : "#667085",
                transition: "all 100ms",
              }}
            >
              {tab.label}
              {tab.id === "connected" && connectedCount > 0 && (
                <span style={{
                  marginLeft: 5, fontSize: 11, fontWeight: 600,
                  background: "#0f5b6c", color: "#fff",
                  borderRadius: 9999, padding: "1px 6px",
                }}>
                  {connectedCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 32px", overflowY: "auto", flex: 1 }}>
        {grouped.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 8, paddingTop: 80, color: "#98a2b3",
          }}>
            <Search size={32} strokeWidth={1.25} />
            <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>No connectors match "{search}"</p>
            <button
              onClick={() => { setSearch(""); setActiveFilter("all"); }}
              style={{ fontSize: 13, color: "#0f5b6c", background: "none", border: "none", cursor: "pointer", marginTop: 4 }}
            >
              Clear filters
            </button>
          </div>
        ) : (
        <div style={{ maxWidth: 960, display: "flex", flexDirection: "column", gap: 32 }}>
          {grouped.map(({ category, items }) => (
            <section key={category}>
              {/* Category label */}
              <p style={{
                fontSize: 11, fontWeight: 600, color: "#8a94a6",
                letterSpacing: "0.06em", textTransform: "uppercase",
                marginBottom: 12,
              }}>
                {category}
              </p>

              {/* Cards grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 14,
              }}>
                {items.map((connector) => {
                  const account = accountFor(connector.id);
                  return (
                    <ConnectorCard
                      key={connector.id}
                      connector={connector}
                      status={loading ? "disconnected" : statusOf(connector.id)}
                      accountEmail={account?.accountEmail ?? null}
                      disconnecting={disconnecting === (account?.id ?? "")}
                      onConnect={() => connect(connector)}
                      onDisconnect={() => account && disconnect(connector, account)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        )}
      </div>
    </AppShell>
  );
}
