import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Employee, Integration } from "@staffroom/types";
import type { ConnectorTool } from "@/lib/api";
import { Network, Loader2, KeyRound, CheckCircle2, Eye, ShieldCheck } from "lucide-react";
import { employeesApi, connectorsApi, toolGrantsApi } from "@/lib/api";
import {
  C, SCard, INTG_ICONS, PROVIDER_META, NATIVE_TOOLS,
} from "./shared";

export function AccessTab({ employee, onReload }: { employee: Employee; onReload: () => void }) {
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [integrations, setIntegrations]             = useState<string[]>(employee.integrations ?? []);
  const [allGrants, setAllGrants]                   = useState<{ provider: string; toolName: string }[]>([]);
  const [mcpTools, setMcpTools]                     = useState<ConnectorTool[]>([]);
  const [selectedProvider, setSelectedProvider]     = useState<string | null>(null);
  const [saving, setSaving]                         = useState(false);
  const [saved, setSaved]                           = useState(false);
  const [savingIntg, setSavingIntg]                 = useState(false);
  const [loading, setLoading]                       = useState(true);

  useEffect(() => {
    Promise.all([
      connectorsApi.list(),
      toolGrantsApi.list(employee.id),
    ]).then(([connectors, grants]) => {
      const providers = connectors.map((c: { provider: string }) => c.provider);
      setConnectedProviders(providers);
      setAllGrants(grants);
      // Auto-select first connected+enabled provider
      const firstEnabled = providers.find((p: string) => {
        const meta = PROVIDER_META[p];
        return meta && (employee.integrations ?? []).includes(meta.intgKey as Integration);
      });
      if (firstEnabled) setSelectedProvider(firstEnabled);
      else if (providers.length > 0) setSelectedProvider(providers[0]);

      // Load MCP tools for non-native connected providers
      const mcpProviders = providers.filter((p: string) => !NATIVE_TOOLS[p]);
      return Promise.all(mcpProviders.map((p: string) =>
        connectorsApi.tools(p).catch(() => [] as ConnectorTool[])
      ));
    }).then((toolSets) => {
      setMcpTools((toolSets as ConnectorTool[][]).flat());
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [employee.id]);

  function isIntgEnabled(intgKey: string) { return integrations.includes(intgKey); }

  async function toggleIntegration(intgKey: string) {
    const next = isIntgEnabled(intgKey)
      ? integrations.filter((k) => k !== intgKey)
      : [...integrations, intgKey];
    setIntegrations(next);
    setSavingIntg(true);
    try {
      await employeesApi.update(employee.id, { integrations: next as Integration[] });
      onReload();
    } finally { setSavingIntg(false); }
  }

  function isGranted(provider: string, toolName: string) {
    return allGrants.some((g) => g.provider === provider && g.toolName === toolName);
  }

  function toggleGrant(provider: string, toolName: string) {
    setAllGrants((prev) => {
      const exists = prev.some((g) => g.provider === provider && g.toolName === toolName);
      return exists
        ? prev.filter((g) => !(g.provider === provider && g.toolName === toolName))
        : [...prev, { provider, toolName }];
    });
  }

  async function save() {
    setSaving(true); setSaved(false);
    try {
      await toolGrantsApi.save(employee.id, allGrants);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  const mcpByProvider: Record<string, ConnectorTool[]> = {};
  mcpTools.forEach((t) => {
    if (!mcpByProvider[t.provider]) mcpByProvider[t.provider] = [];
    mcpByProvider[t.provider].push(t);
  });

  const displayedProviders = Object.entries(PROVIDER_META).filter(
    ([provider]) => connectedProviders.includes(provider)
  );

  const enabledGrantCount = allGrants.filter((g) => {
    const meta = PROVIDER_META[g.provider];
    return meta && integrations.includes(meta.intgKey);
  }).length;

  // Tools to show for the selected provider
  const selMeta = selectedProvider ? PROVIDER_META[selectedProvider] : null;
  const selNative = selectedProvider ? NATIVE_TOOLS[selectedProvider] : null;
  const selMcp = selectedProvider ? (mcpByProvider[selectedProvider] ?? []) : [];
  const selEnabled = selMeta ? isIntgEnabled(selMeta.intgKey) : false;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 48, color: C.inkMuted, fontSize: 14 }}>
        <Loader2 size={16} strokeWidth={1.75} style={{ animation: "spin 1s linear infinite" }} /> Loading…
      </div>
    );
  }

  if (displayedProviders.length === 0) {
    return (
      <SCard>
        <div style={{ padding: "48px 24px", textAlign: "center", color: C.inkMuted }}>
          <Network size={28} strokeWidth={1.5} style={{ marginBottom: 12, color: C.icon }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: C.ink, margin: "0 0 6px" }}>No connectors set up</p>
          <p style={{ fontSize: 13, margin: "0 0 16px" }}>
            Connect accounts on the <Link to="/connectors" style={{ color: C.brand }}>Connectors page</Link> first.
          </p>
        </div>
      </SCard>
    );
  }

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

      {/* ── LEFT: Connector list ─────────────────────────────── */}
      <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: C.inkMuted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px 4px" }}>
          Connectors
        </p>
        {displayedProviders.map(([provider, meta]) => {
          const enabled = isIntgEnabled(meta.intgKey);
          const isSelected = selectedProvider === provider;
          return (
            <button
              key={provider}
              onClick={() => setSelectedProvider(provider)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10, border: "none",
                background: isSelected ? C.brandSoft : C.surface,
                boxShadow: isSelected ? `inset 0 0 0 1.5px ${C.brand}` : `inset 0 0 0 1px ${C.line}`,
                cursor: "pointer", textAlign: "left", width: "100%",
                transition: "background 120ms",
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: enabled ? (isSelected ? C.brandSoft : C.surfaceSunken) : C.surfaceSunken,
                color: enabled ? C.brand : C.icon,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {INTG_ICONS[meta.intgKey] ?? <Network size={16} strokeWidth={1.75} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: isSelected ? C.brand : C.ink, margin: 0, lineHeight: "18px" }}>
                  {meta.label}
                </p>
                <p style={{ fontSize: 11, color: enabled ? C.successFg : C.inkMuted, margin: 0, fontWeight: 500 }}>
                  {enabled ? "● Enabled" : "○ Disabled"}
                </p>
              </div>
              {/* toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleIntegration(meta.intgKey); }}
                disabled={savingIntg}
                style={{
                  position: "relative", width: 36, height: 20, borderRadius: 9999, flexShrink: 0,
                  background: enabled ? C.brand : C.surfaceSunken,
                  border: `1px solid ${enabled ? C.brand : C.lineStrong}`,
                  cursor: savingIntg ? "not-allowed" : "pointer",
                  opacity: savingIntg ? 0.6 : 1, padding: 0,
                }}
              >
                <span style={{
                  position: "absolute", top: 2,
                  left: enabled ? 17 : 2,
                  width: 14, height: 14, borderRadius: 9999,
                  background: "#fff", boxShadow: "0 1px 3px rgba(16,24,40,0.2)",
                  transition: "left 120ms", display: "block",
                }} />
              </button>
            </button>
          );
        })}
      </div>

      {/* ── RIGHT: Tool access for selected provider ─────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selectedProvider || !selMeta ? (
          <SCard>
            <div style={{ padding: "48px 24px", textAlign: "center", color: C.inkMuted }}>
              <ShieldCheck size={24} strokeWidth={1.5} style={{ marginBottom: 8, color: C.icon }} />
              <p style={{ fontSize: 14, color: C.inkMuted, margin: 0 }}>Select a connector to manage tool access.</p>
            </div>
          </SCard>
        ) : (
          <SCard>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: selEnabled ? C.brandSoft : C.surfaceSunken,
                color: selEnabled ? C.brand : C.inkMuted,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {INTG_ICONS[selMeta.intgKey] ?? <Network size={16} strokeWidth={1.75} />}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 2px" }}>
                  {selMeta.label} — Tool access
                </h3>
                <p style={{ fontSize: 12, color: C.inkMuted, margin: 0 }}>
                  {selEnabled
                    ? `Choose which ${selMeta.label} tools ${employee.displayName} can call.`
                    : `Enable ${selMeta.label} above to grant tool access.`}
                </p>
              </div>
              {selNative && (
                <span style={{
                  fontSize: 11, fontWeight: 500, height: 20, padding: "0 8px", borderRadius: 4,
                  background: C.surfaceSunken, color: C.inkMuted, display: "inline-flex", alignItems: "center",
                }}>
                  Native
                </span>
              )}
            </div>

            {!selEnabled ? (
              <div style={{ padding: "36px 24px", textAlign: "center", color: C.inkMuted }}>
                <KeyRound size={22} strokeWidth={1.5} style={{ marginBottom: 8, color: C.icon }} />
                <p style={{ fontSize: 14, color: C.inkMuted, margin: 0 }}>
                  Enable {selMeta.label} on the left to configure tool access.
                </p>
              </div>
            ) : selNative ? (
              selNative.map((tool) => {
                const granted = isGranted(selectedProvider, tool.toolName);
                return (
                  <label key={tool.toolName} style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "12px 20px", cursor: "pointer",
                    borderBottom: `1px solid ${C.line}`,
                    background: granted ? C.brandSoft : "transparent",
                    transition: "background 120ms",
                  }}>
                    <input
                      type="checkbox"
                      checked={granted}
                      onChange={() => toggleGrant(selectedProvider, tool.toolName)}
                      style={{ marginTop: 3, accentColor: C.brand, width: 16, height: 16, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <code style={{ fontSize: 12, fontFamily: '"JetBrains Mono",monospace', color: C.ink, background: C.surfaceSunken, padding: "1px 6px", borderRadius: 4 }}>
                          {tool.toolName}
                        </code>
                        {tool.readOnly ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, height: 18, padding: "0 6px", borderRadius: 4, background: C.successBg, color: C.successFg, fontSize: 11, fontWeight: 500 }}>
                            <Eye size={11} strokeWidth={1.75} /> Read only
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, height: 18, padding: "0 6px", borderRadius: 4, background: C.warningBg, color: C.warningFg, fontSize: 11, fontWeight: 500 }}>
                            <CheckCircle2 size={11} strokeWidth={1.75} /> Needs approval
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: C.inkMuted, margin: 0, lineHeight: "18px" }}>{tool.description}</p>
                    </div>
                  </label>
                );
              })
            ) : selMcp.length === 0 ? (
              <div style={{ padding: "36px 24px", textAlign: "center", color: C.inkMuted }}>
                <p style={{ fontSize: 14, margin: 0 }}>No tools discovered for this connector.</p>
              </div>
            ) : (
              selMcp.map((tool) => {
                const granted = isGranted(tool.provider, tool.toolName);
                return (
                  <label key={tool.toolName} style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "12px 20px", cursor: "pointer",
                    borderBottom: `1px solid ${C.line}`,
                    background: granted ? C.brandSoft : "transparent",
                    transition: "background 120ms",
                  }}>
                    <input
                      type="checkbox"
                      checked={granted}
                      onChange={() => toggleGrant(tool.provider, tool.toolName)}
                      style={{ marginTop: 3, accentColor: C.brand, width: 16, height: 16, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <code style={{ fontSize: 12, fontFamily: '"JetBrains Mono",monospace', color: C.ink, background: C.surfaceSunken, padding: "1px 6px", borderRadius: 4, display: "inline-block", marginBottom: 4 }}>
                        {tool.toolName}
                      </code>
                      <p style={{ fontSize: 13, color: C.inkMuted, margin: 0, lineHeight: "18px" }}>{tool.description}</p>
                    </div>
                  </label>
                );
              })
            )}

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.line}`, background: C.surfaceSubtle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 13, color: C.inkMuted, margin: 0 }}>
                {enabledGrantCount} tool{enabledGrantCount !== 1 ? "s" : ""} granted across all integrations
              </p>
              <button onClick={save} disabled={saving} style={{
                height: 36, padding: "0 16px", borderRadius: 8,
                border: "none", background: saved ? C.successFg : C.brand,
                color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                display: "flex", alignItems: "center", gap: 8,
                transition: "background 0.15s",
              }}>
                {saving
                  ? <><Loader2 size={14} strokeWidth={1.75} style={{ animation: "spin 1s linear infinite" }} /> Saving…</>
                  : saved ? "Saved" : "Save access"}
              </button>
            </div>
          </SCard>
        )}
      </div>
    </div>
  );
}
