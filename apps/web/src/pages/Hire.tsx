import { useState, useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { employeesApi, connectorsApi, type ToolGrant } from "@/lib/api";
import ToolAccessPicker, { grantsForIntegrations } from "@/components/ToolAccessPicker";
import { AppShell, PageHeader } from "@/components/AppShell";
import { ArrowLeft, ArrowRight, Check, Crown, Wallet, Plug, ShieldCheck, Mail, Calendar, HardDrive, Table2, MessageSquare, Network, User, Loader2, Bot, Clock } from "lucide-react";
import "./Hire.css";

const PROVIDERS = [
  { id: "anthropic",  label: "Anthropic (Claude)" },
  { id: "deepseek",   label: "DeepSeek" },
  { id: "gemini",     label: "Google Gemini" },
  { id: "openrouter", label: "OpenRouter (free)" },
  { id: "ollama",     label: "Ollama (local)" },
] as const;

const MODEL_OPTIONS: Record<string, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast)" },
    { id: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6 (balanced)" },
    { id: "claude-opus-4-6",           label: "Claude Opus 4.6 (most capable)" },
  ],
  deepseek: [
    { id: "deepseek-chat",     label: "DeepSeek Chat (V3)" },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner (R1)" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (fast, cheap)" },
    { id: "gemini-2.5-pro",   label: "Gemini 2.5 Pro (most capable)" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    { id: "gemini-1.5-pro",   label: "Gemini 1.5 Pro" },
  ],
  openrouter: [
    { id: "google/gemma-4-31b-it:free",                         label: "Gemma 4 31B (free)" },
    { id: "google/gemma-4-26b-a4b-it:free",                     label: "Gemma 4 26B A4B (free)" },
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free",             label: "Nemotron 3 Ultra 550B (free)" },
    { id: "nvidia/nemotron-3-super-120b-a12b:free",             label: "Nemotron 3 Super 120B (free)" },
    { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", label: "Nemotron 3 Nano Omni 30B (free)" },
    { id: "nvidia/nemotron-3.5-lightning:free",                 label: "Nemotron 3.5 Lightning (free)" },
    { id: "poolside/laguna-s-2.1:free",                         label: "Laguna S 2.1 (free)" },
    { id: "apodex/apodex-1.1-mini:free",                        label: "Apodex 1.1 Mini (free)" },
  ],
  ollama: [
    { id: "qwen3:8b",       label: "Qwen 3 8B (recommended)" },
    { id: "qwen2.5:7b",     label: "Qwen 2.5 7B" },
    { id: "qwen2.5:3b",     label: "Qwen 2.5 3B (fast)" },
    { id: "deepseek-r1:7b", label: "DeepSeek R1 7B" },
    { id: "llama3.1:8b",    label: "Llama 3.1 8B" },
    { id: "mistral:7b",     label: "Mistral 7B" },
  ],
};

// Active integrations — shown only if the user has connected the account
const INTEGRATIONS = [
  { id: "gmail",         provider: "gmail",           label: "Gmail",          description: "Email & inbox",        icon: Mail },
  { id: "gcal",          provider: "google_calendar", label: "Google Calendar", description: "Events & scheduling",  icon: Calendar },
  { id: "google_drive",  provider: "google_drive",    label: "Google Drive",    description: "Files & documents",    icon: HardDrive },
  { id: "google_sheets", provider: "google_sheets",   label: "Google Sheets",   description: "Spreadsheets & data",  icon: Table2 },
  { id: "slack",         provider: "slack",           label: "Slack",           description: "Team messaging",       icon: MessageSquare },
  { id: "internal",      provider: null,              label: "Internal",        description: "Business knowledge",   icon: Network },
];

// Coming soon integrations — shown as disabled pills
const COMING_SOON = [
  { label: "Outlook",     description: "Microsoft email" },
  { label: "OneDrive",    description: "Microsoft files" },
  { label: "Dropbox",     description: "Cloud storage" },
  { label: "PostgreSQL",  description: "Database queries" },
  { label: "HubSpot",     description: "CRM & contacts" },
  { label: "Salesforce",  description: "CRM & pipeline" },
  { label: "Teams",       description: "Microsoft Teams" },
  { label: "Notion",      description: "Docs & wikis" },
  { label: "Airtable",    description: "Databases & bases" },
];

function SetupSection({ number, title, description, children }: { number: number; title: string; description: string; children: ReactNode }) {
  return (
    <section className="hire-card" aria-labelledby={`hire-section-${number}`}>
      <div className="hire-card-heading">
        <span className="hire-step" aria-hidden="true">{number}</span>
        <div><h2 id={`hire-section-${number}`}>{title}</h2><p>{description}</p></div>
      </div>
      <div className="hire-card-body">{children}</div>
    </section>
  );
}

export default function Hire() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [integrations, setIntegrations] = useState<string[]>([]);
  const [toolGrants, setToolGrants] = useState<ToolGrant[]>([]);
  const [budget, setBudget] = useState("10");
  const [isManager, setIsManager] = useState(false);
  const [llmProvider, setLlmProvider] = useState<string>("");
  const [llmModel, setLlmModel] = useState<string>("");
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());

  useEffect(() => {
    connectorsApi.list().then((rows) => {
      setConnectedProviders(new Set(rows.map((r) => r.provider)));
    }).catch(() => {});
  }, []);

  const budgetValue = Number(budget);
  const budgetValid = budget.trim().length > 0 && Number.isFinite(budgetValue) && budgetValue >= 1 && budgetValue <= 1000;
  const detailsValid = displayName.trim().length > 0 && roleDescription.trim().length > 0;
  const isValid = detailsValid && budgetValid;
  const initials = displayName.trim().split(/\s+/).filter(Boolean).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  const selectedApps = isManager ? [] : INTEGRATIONS.filter((app) => integrations.includes(app.id));

  function toggleIntegration(id: string) {
    const next = integrations.includes(id) ? integrations.filter((value) => value !== id) : [...integrations, id];
    setIntegrations(next);
    setToolGrants((grants) => grantsForIntegrations(grants, next));
  }

  function chooseType(manager: boolean) {
    if (isManager !== manager) { setIsManager(manager); setToolGrants([]); }
  }

  async function hire() {
    if (!isValid || saving) return;
    setSaving(true);
    setError("");
    try {
      await employeesApi.hire({
        displayName: displayName.trim(),
        roleDescription: roleDescription.trim(),
        integrations: isManager ? ["internal"] : integrations,
        toolGrants: isManager ? [] : toolGrants,
        budgetMonthlyUsd: budgetValue,
        isManager,
        instructions: instructions.trim() ? { instructions: instructions.trim() } : {},
        llmProvider: llmProvider || null,
        llmModel: llmModel || null,
      });
      navigate("/team");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not hire this employee. Please try again.");
    } finally { setSaving(false); }
  }

  return (
    <AppShell>
      <div className="hire-page">
        <PageHeader
          title="Hire an employee"
          subtitle="Give your new teammate a role, the right tools, and a little direction."
          breadcrumbs={[{ label: "Team", href: "/team" }, { label: "Hire an employee" }]}
          action={<Link className="hire-back" to="/team"><ArrowLeft size={16} strokeWidth={1.75} /> Back to team</Link>}
        />
        <form className="hire-content" onSubmit={(event) => { event.preventDefault(); void hire(); }}>
          <div className="hire-form-sections">
            <SetupSection number={1} title="Meet your new employee" description="Start with their name and the work you want them to own.">
              <div className="hire-fields">
                <div className="hire-field">
                  <label htmlFor="employee-name">Employee name <span aria-hidden="true">*</span></label>
                  <input id="employee-name" autoComplete="off" placeholder="e.g. Layla" value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={saving} required />
                </div>
                <div className="hire-field">
                  <label htmlFor="employee-role">Role <span aria-hidden="true">*</span></label>
                  <input id="employee-role" placeholder="e.g. Personal assistant" value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} disabled={saving} required />
                </div>
              </div>
              <fieldset className="hire-type-fieldset">
                <legend>How will they work?</legend>
                <div className="hire-type-options">
                  <label className={`hire-type-option ${!isManager ? "is-selected" : ""}`}>
                    <input type="radio" name="employee-type" value="specialist" checked={!isManager} onChange={() => chooseType(false)} disabled={saving} />
                    <User size={20} strokeWidth={1.75} />
                    <span><strong>Specialist</strong><span>Works on tasks using the tools you choose.</span></span>
                  </label>
                  <label className={`hire-type-option ${isManager ? "is-selected" : ""}`}>
                    <input type="radio" name="employee-type" value="manager" checked={isManager} onChange={() => chooseType(true)} disabled={saving} />
                    <Crown size={20} strokeWidth={1.75} />
                    <span><strong>Manager</strong><span>Plans work and delegates to your team.</span></span>
                  </label>
                </div>
              </fieldset>
            </SetupSection>

            <SetupSection number={2} title="Apps & tool access" description={isManager ? "Managers coordinate the team through built-in tools." : "Choose an app, then select the tools this employee can use."}>
              {!isManager && <>
                <div className="hire-app-grid" role="group" aria-label="Employee integrations">
                  {INTEGRATIONS.map(({ id, provider, label, description, icon: Icon }) => {
                    const connected = provider === null || connectedProviders.has(provider);
                    const selected = integrations.includes(id);
                    if (!connected) return null;
                    return (
                      <button type="button" key={id} className={`hire-app-option ${selected ? "is-selected" : ""}`} aria-pressed={selected} disabled={saving} onClick={() => toggleIntegration(id)}>
                        <span className="hire-app-icon"><Icon size={20} strokeWidth={1.75} /></span>
                        <span className="hire-app-copy"><strong>{label}</strong><span>{description}</span></span>
                        <span className="hire-app-check" aria-hidden="true">{selected && <Check size={14} strokeWidth={2} />}</span>
                      </button>
                    );
                  })}
                  {COMING_SOON.map(({ label, description }) => (
                    <div key={label} className="hire-app-option hire-app-coming-soon" aria-disabled="true">
                      <span className="hire-app-icon"><Clock size={20} strokeWidth={1.75} /></span>
                      <span className="hire-app-copy"><strong>{label}</strong><span>{description}</span></span>
                      <span className="hire-app-badge">Soon</span>
                    </div>
                  ))}
                </div>
                {INTEGRATIONS.some(({ id, provider }) => provider !== null && !connectedProviders.has(provider) && !integrations.includes(id)) && (
                  <p className="hire-connect-hint"><Plug size={14} strokeWidth={1.75} /><Link to="/connectors">Connect more apps</Link> to give this employee access to more tools.</p>
                )}
                <div className="hire-access-divider"><span>Choose allowed tools</span><span>Access is granted individually</span></div>
              </>}
              <ToolAccessPicker integrations={integrations} value={toolGrants} onChange={setToolGrants} isManager={isManager} disabled={saving} />
            </SetupSection>

            <SetupSection number={3} title="Set them up for success" description="Share your working preferences and set a monthly AI budget.">
              <div className="hire-field">
                <label htmlFor="employee-instructions">Standing instructions <span className="hire-optional">Optional</span></label>
                <textarea id="employee-instructions" placeholder={"What should they know?\n\nFor example: Keep replies warm and professional. Prioritise VIP clients and flag anything urgent."} value={instructions} onChange={(event) => setInstructions(event.target.value)} disabled={saving} />
                <p className="hire-field-help">Add tone, priorities, and any business context they should follow.</p>
              </div>
              <div className="hire-budget-row">
                <div className="hire-budget-label"><Wallet size={20} strokeWidth={1.75} /><div><label htmlFor="employee-budget">Monthly AI budget</label><p>A spending limit for this employee’s AI work.</p></div></div>
                <div className="hire-budget-control"><span aria-hidden="true">$</span><input id="employee-budget" aria-describedby={!budgetValid ? "budget-error" : undefined} aria-invalid={!budgetValid} type="number" min="1" max="1000" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} disabled={saving} required /><span>/ month</span></div>
              </div>
              {!budgetValid && <p className="hire-field-error" id="budget-error">Enter a budget between $1 and $1,000.</p>}
              <div className="hire-budget-row" style={{ marginTop: 16 }}>
                <div className="hire-budget-label">
                  <Bot size={20} strokeWidth={1.75} />
                  <div>
                    <label>AI model <span className="hire-optional">Optional</span></label>
                    <p>Override the workspace model for this employee.</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                  <select
                    value={llmProvider}
                    onChange={(e) => { setLlmProvider(e.target.value); setLlmModel(MODEL_OPTIONS[e.target.value]?.[0]?.id ?? ""); }}
                    disabled={saving}
                    style={{ height: 36, padding: "0 8px", borderRadius: 8, border: "1px solid #d0d5dd", fontSize: 13, background: "#fff", cursor: "pointer" }}
                  >
                    <option value="">Use workspace default</option>
                    {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                  {llmProvider && (
                    <select
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      disabled={saving}
                      style={{ height: 36, padding: "0 8px", borderRadius: 8, border: "1px solid #d0d5dd", fontSize: 13, background: "#fff", cursor: "pointer" }}
                    >
                      {(MODEL_OPTIONS[llmProvider] ?? []).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </SetupSection>
          </div>

          <aside className="hire-review" aria-labelledby="hire-review-title">
            <div className="hire-review-card">
              <div className="hire-review-heading"><h2 id="hire-review-title">Your new teammate</h2><p>A quick look before you hire.</p></div>
              <div className="hire-employee-preview">
                <div className="hire-avatar" aria-hidden="true">{initials || <User size={24} strokeWidth={1.75} />}</div>
                <strong>{displayName.trim() || "Employee name"}</strong>
                <p>{roleDescription.trim() || "Their role on your team"}</p>
                <span className="hire-type-badge">{isManager ? <Crown size={14} strokeWidth={1.75} /> : <User size={14} strokeWidth={1.75} />}{isManager ? "Manager" : "Specialist"}</span>
              </div>
              <dl className="hire-review-stats">
                <div><dt><Plug size={16} strokeWidth={1.75} /> Apps</dt><dd>{isManager ? "Team access" : selectedApps.length}</dd></div>
                <div><dt><ShieldCheck size={16} strokeWidth={1.75} /> Allowed tools</dt><dd>{isManager ? "Built-in" : toolGrants.length}</dd></div>
                <div><dt><Wallet size={16} strokeWidth={1.75} /> Monthly budget</dt><dd>{budgetValid ? `$${budgetValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}</dd></div>
              </dl>
              {selectedApps.length > 0 && <div className="hire-selected-apps" aria-label="Selected apps">{selectedApps.map(({ id, label, icon: Icon }) => <span key={id}><Icon size={14} strokeWidth={1.75} />{label}</span>)}</div>}
              <div className="hire-approval-note"><ShieldCheck size={20} strokeWidth={1.75} /><div><strong>You stay in control</strong><p>External actions wait for your approval.</p></div></div>
              <div className="hire-review-footer">
                {error && <p className="hire-submit-error" role="alert">{error}</p>}
                <button type="submit" className="hire-submit" disabled={saving || !isValid}>{saving ? <><Loader2 size={16} className="animate-spin" /> Hiring…</> : <>Hire employee <ArrowRight size={16} strokeWidth={1.75} /></>}</button>
                <p>{!detailsValid ? "Add a name and role to get started." : !budgetValid ? "Set a valid budget to continue." : "Ready when you are. You can refine setup later."}</p>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </AppShell>
  );
}
