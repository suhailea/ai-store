import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Loader2, Plug, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { connectorsApi, type ConnectorTool, type ToolGrant } from "@/lib/api";
import "./ToolAccessPicker.css";

const SOURCES = [
  { integration: "gmail",         provider: "gmail",            label: "Gmail",             refreshable: false },
  { integration: "gcal",          provider: "google_calendar",  label: "Google Calendar",   refreshable: false },
  { integration: "google_drive",  provider: "google_drive",     label: "Google Drive",      refreshable: false },
  { integration: "google_sheets", provider: "google_sheets",    label: "Google Sheets",     refreshable: false },
  { integration: "slack",         provider: "slack",            label: "Slack",             refreshable: true  },
  { integration: "excel",         provider: "excel",            label: "Excel",             refreshable: false },
];

export function grantsForIntegrations(grants: ToolGrant[], integrations: string[]) {
  return grants.filter((grant) => SOURCES.some((source) =>
    source.provider === grant.provider && integrations.includes(source.integration)
  ));
}

function toolErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  // Defend against old APIs or proxies returning an entire response body.
  if (!message || message.length > 240 || /[{}<>]|jsonrpc|Streamable HTTP|POSTing to endpoint/i.test(message)) return fallback;
  return message;
}

function ToolGroup({ source, account, value, onChange, disabled }: {
  source: typeof SOURCES[number];
  account: string | null;
  value: ToolGrant[];
  onChange: Dispatch<SetStateAction<ToolGrant[]>>;
  disabled: boolean;
}) {
  const [tools, setTools] = useState<ConnectorTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    connectorsApi.tools(source.provider).then((rows) => {
      if (active) setTools(rows);
    }).catch((err: unknown) => {
      if (active) setError(toolErrorMessage(err, "Could not load tools. Please try again."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [source.provider, retries]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      await connectorsApi.refreshTools(source.provider);
      const rows = await connectorsApi.tools(source.provider);
      setTools(rows);
      // Discovery can remove tools; do not keep grants for tools no longer listed.
      onChange((current) => current.filter((grant) => grant.provider !== source.provider || rows.some((tool) => tool.toolName === grant.toolName)));
    } catch (err: unknown) {
      setError(toolErrorMessage(err, "Could not refresh tools. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  const selected = value.filter((grant) => grant.provider === source.provider);
  const filtered = tools.filter((tool) => `${tool.toolName} ${tool.description}`.toLowerCase().includes(query.trim().toLowerCase()));
  function toggle(tool: ConnectorTool) {
    const checked = selected.some((grant) => grant.toolName === tool.toolName);
    onChange(checked
      ? value.filter((grant) => !(grant.provider === source.provider && grant.toolName === tool.toolName))
      : [...value, { provider: source.provider, toolName: tool.toolName }]);
  }

  return (
    <section className="tool-group" aria-label={`${source.label} tools`}>
      <div className="tool-group-header">
        <div className="tool-group-identity">
          <strong>{source.label}</strong>
          <span className="tool-account">{account || "Connected account"}</span>
        </div>
        <span className="tool-count">{selected.length} selected</span>
        {source.refreshable && <button type="button" className="tool-icon-button" disabled={loading || disabled} onClick={refresh} aria-label={`Refresh ${source.label} tools`} title="Refresh tools">
          <RefreshCw size={16} strokeWidth={1.75} />
        </button>}
      </div>
      {loading ? <div className="tool-state" role="status"><Loader2 size={16} className="animate-spin" /> Loading tools…</div>
        : error ? <div className="tool-state tool-error" role="alert"><AlertCircle size={16} /><span>{error}</span><button type="button" className="tool-text-button" disabled={disabled} onClick={() => setRetries((n) => n + 1)}>Retry</button></div>
        : tools.length === 0 ? <div className="tool-empty"><Plug size={20} strokeWidth={1.75} /><strong>No tools available yet</strong><p>{source.refreshable ? "Refresh tools to load the actions available from this connected account." : "Tool access for this integration is not available yet."}</p>{source.refreshable && <button type="button" className="tool-secondary-button" disabled={disabled} onClick={refresh}>Refresh tools</button>}</div>
        : <>
          <div className="tool-search"><Search size={16} strokeWidth={1.75} /><input aria-label={`Search ${source.label} tools`} placeholder="Search tools…" onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} value={query} onChange={(event) => setQuery(event.target.value)} disabled={disabled} /></div>
          <div className="tool-list">
            {filtered.length === 0 ? <p className="tool-state">No tools match “{query}”.</p> : filtered.map((tool) => (
              <label className="tool-option" key={tool.toolName}>
                <input type="checkbox" checked={selected.some((grant) => grant.toolName === tool.toolName)} onChange={() => toggle(tool)} disabled={disabled} />
                <span><strong className="tool-option-title">{tool.toolName.replace(/[_-]/g, " ")}</strong><code>{tool.toolName}</code><span className="tool-description" title={tool.description}>{tool.description || "No description provided."}</span></span>
              </label>
            ))}
          </div>
        </>}
    </section>
  );
}

export default function ToolAccessPicker({ integrations, value, onChange, isManager, disabled }: {
  integrations: string[];
  value: ToolGrant[];
  onChange: Dispatch<SetStateAction<ToolGrant[]>>;
  isManager: boolean;
  disabled: boolean;
}) {
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof connectorsApi.list>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retries, setRetries] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    connectorsApi.list().then((rows) => { if (active) setAccounts(rows); })
      .catch((err: unknown) => { if (active) setError(toolErrorMessage(err, "Could not load connected accounts. Please try again.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retries]);

  const sources = SOURCES.filter((source) => integrations.includes(source.integration));
  return (
    <div className="tool-access">
      <div className="tool-access-summary"><ShieldCheck size={16} strokeWidth={1.75} /><span>{isManager ? "Team coordination tools" : `${value.length} ${value.length === 1 ? "tool" : "tools"} selected`}</span></div>
      {isManager ? <div className="tool-empty"><strong>Managers work through the team</strong><p>This employee can plan work, assign tasks, and check progress. Connected apps are accessed by the specialists they delegate to.</p></div>
        : loading ? <div className="tool-state" role="status"><Loader2 size={16} className="animate-spin" /> Loading connected accounts…</div>
        : error ? <div className="tool-state tool-error" role="alert"><AlertCircle size={16} /><span>{error}</span><button type="button" className="tool-text-button" disabled={disabled} onClick={() => setRetries((n) => n + 1)}>Retry</button></div>
        : sources.length === 0 ? <div className="tool-empty"><Plug size={20} strokeWidth={1.75} /><strong>Select an integration to choose tools</strong><p>Choose a data source on the left, then grant only the tools this employee needs. Uploads and internal sources have no connector tools to select.</p></div>
        : sources.map((source) => {
          const account = accounts.find((row) => row.provider === source.provider);
          return account ? <ToolGroup key={source.provider} source={source} account={account.accountEmail} value={value} onChange={onChange} disabled={disabled} />
            : <div key={source.provider} className="tool-disconnected"><div><strong>{source.label}</strong><p>Connect an account before selecting tools.</p></div><Link to="/connectors">Connect account</Link></div>;
        })}
      {!isManager && <p className="tool-footnote"><ShieldCheck size={16} strokeWidth={1.75} /><span>Only selected tools are granted. External actions still require your approval.</span></p>}
    </div>
  );
}
