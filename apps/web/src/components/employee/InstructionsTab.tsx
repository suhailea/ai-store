import { useState } from "react";
import type { Employee } from "@staffroom/types";
import { Plus, Trash2, Loader2, ListChecks } from "lucide-react";
import { employeesApi } from "@/lib/api";
import { C, SCard, SCardHeader, IconTile } from "./shared";

export function InstructionsTab({ employee, onSaved }: { employee: Employee; onSaved: () => void }) {
  const [entries, setEntries] = useState<{ key: string; val: string }[]>(
    Object.entries(employee.instructionsJson ?? {}).map(([key, val]) => ({ key, val }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  function addRow() {
    setEntries((prev) => [...prev, { key: "", val: "" }]);
  }

  function updateRow(i: number, field: "key" | "val", value: string) {
    setEntries((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function removeRow(i: number) {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    const obj: Record<string, string> = {};
    entries.filter((r) => r.key.trim()).forEach((r) => { obj[r.key.trim()] = r.val; });
    try {
      await employeesApi.saveOnboarding(employee.id, obj);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    height: 36, padding: "0 10px", border: `1px solid ${C.lineStrong}`,
    borderRadius: 6, fontSize: 13, color: C.ink, background: C.surface,
    outline: "none", boxSizing: "border-box",
  };

  return (
    <SCard>
      <SCardHeader
        icon={<IconTile icon={<ListChecks size={20} strokeWidth={1.75} />} bg={C.brandSoft} color={C.brand} />}
        title="Standing instructions"
        subtitle={`${employee.displayName} follows these on every task. Changes take effect on the next run.`}
        action={
          <button onClick={addRow} style={{
            display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
            borderRadius: 6, border: `1px solid ${C.lineStrong}`, background: C.surface,
            color: C.ink, fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}>
            <Plus size={14} strokeWidth={1.75} /> Add row
          </button>
        }
      />
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: C.inkMuted, fontSize: 14 }}>
            No instructions yet. Add a row to guide {employee.displayName}.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 32px", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.inkMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Key / label</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.inkMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Value</span>
              <span />
            </div>
            {entries.map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "200px 1fr 32px", gap: 8, alignItems: "center" }}>
                <input
                  style={inputStyle}
                  placeholder="e.g. tone"
                  value={row.key}
                  onChange={(e) => updateRow(i, "key", e.target.value)}
                />
                <input
                  style={inputStyle}
                  placeholder="e.g. professional but warm"
                  value={row.val}
                  onChange={(e) => updateRow(i, "val", e.target.value)}
                />
                <button onClick={() => removeRow(i)} style={{
                  width: 32, height: 32, border: "none", background: "none",
                  cursor: "pointer", color: C.inkMuted, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6,
                }}>
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
      <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.line}`, background: C.surfaceSubtle, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={save} disabled={saving} style={{
          height: 36, padding: "0 16px", borderRadius: 8,
          border: "none", background: saved ? C.successFg : C.brand,
          color: "#fff", fontSize: 14, fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
          display: "flex", alignItems: "center", gap: 8,
          transition: "background 0.15s",
        }}>
          {saving ? <><Loader2 size={14} strokeWidth={1.75} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : saved ? "Saved" : "Save instructions"}
        </button>
      </div>
    </SCard>
  );
}
