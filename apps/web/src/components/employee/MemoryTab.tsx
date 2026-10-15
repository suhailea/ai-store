import { useState } from "react";
import type { Employee, Memory } from "@staffroom/types";
import { Brain, Plus, Trash2, Loader2 } from "lucide-react";
import { employeesApi } from "@/lib/api";
import { timeAgo } from "../../lib/emp";
import { C, SCard, SCardHeader, IconTile, MEMORY_KIND_STYLES } from "./shared";

const LABELS: Record<string, string> = {
  instruction: "Instructions", preference: "Preferences",
  correction: "Corrections", episodic: "Past observations", learned: "Learnings",
};

export function MemoryTab({ employee, memories, onRefresh }: {
  employee: Employee; memories: Memory[]; onRefresh: () => void;
}) {
  const [adding, setAdding]         = useState(false);
  const [newKind, setNewKind]       = useState<Memory["kind"]>("instruction");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);

  async function addMemory() {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      await employeesApi.createMemory(employee.id, { kind: newKind, content: newContent.trim() });
      setNewContent("");
      setAdding(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteMemory(memId: string) {
    setDeleting(memId);
    try {
      await employeesApi.deleteMemory(employee.id, memId);
      onRefresh();
    } finally {
      setDeleting(null);
    }
  }

  const grouped: Record<string, Memory[]> = {};
  memories.forEach((m) => {
    if (!grouped[m.kind]) grouped[m.kind] = [];
    grouped[m.kind].push(m);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Add memory */}
      <SCard>
        <SCardHeader
          icon={<IconTile icon={<Brain size={20} strokeWidth={1.75} />} bg={C.infoBg} color={C.infoFg} />}
          title={`${employee.displayName}'s memory`}
          subtitle="What this employee knows, has learned, and has been told."
          action={
            !adding ? (
              <button onClick={() => setAdding(true)} style={{
                display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
                borderRadius: 6, border: `1px solid ${C.lineStrong}`, background: C.surface,
                color: C.ink, fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}>
                <Plus size={14} strokeWidth={1.75} /> Add memory
              </button>
            ) : null
          }
        />
        {adding && (
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: C.ink, whiteSpace: "nowrap" }}>Kind:</label>
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as Memory["kind"])}
                style={{
                  height: 34, padding: "0 10px", border: `1px solid ${C.lineStrong}`,
                  borderRadius: 6, fontSize: 13, color: C.ink, background: C.surface, outline: "none",
                }}
              >
                {Object.keys(LABELS).map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}
              </select>
            </div>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Enter the memory content…"
              rows={3}
              style={{
                width: "100%", padding: "10px 12px", border: `1px solid ${C.lineStrong}`,
                borderRadius: 8, fontSize: 14, color: C.ink, resize: "vertical",
                outline: "none", fontFamily: "inherit", lineHeight: "20px", boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setAdding(false); setNewContent(""); }} style={{
                height: 34, padding: "0 14px", borderRadius: 6, border: `1px solid ${C.lineStrong}`,
                background: C.surface, color: C.inkSecondary, fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}>
                Cancel
              </button>
              <button onClick={addMemory} disabled={saving || !newContent.trim()} style={{
                height: 34, padding: "0 14px", borderRadius: 6, border: "none",
                background: C.brand, color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                {saving ? <><Loader2 size={13} strokeWidth={1.75} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : "Save"}
              </button>
            </div>
          </div>
        )}

        {memories.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: C.inkMuted }}>
            <Brain size={24} strokeWidth={1.75} style={{ marginBottom: 8, color: C.icon }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 4px" }}>No memories yet</p>
            <p style={{ fontSize: 13, margin: 0 }}>Memories are written by the agent during tasks, or you can add them manually.</p>
          </div>
        ) : (
          Object.entries(LABELS).map(([kind, label]) => {
            const items = grouped[kind];
            if (!items || items.length === 0) return null;
            const style = MEMORY_KIND_STYLES[kind] ?? { bg: C.surfaceSunken, fg: C.inkMuted };
            return (
              <div key={kind}>
                <div style={{ padding: "10px 20px 6px", borderTop: `1px solid ${C.line}` }}>
                  <div style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px", borderRadius: 4, background: style.bg }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: style.fg, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                  </div>
                </div>
                {items.map((mem) => (
                  <div key={mem.id} style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "10px 20px", borderBottom: `1px solid ${C.line}`,
                  }}>
                    <p style={{ flex: 1, fontSize: 14, color: C.ink, margin: 0, lineHeight: "20px" }}>
                      {mem.content}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, color: C.inkMuted }}>{timeAgo(mem.createdAt)}</span>
                      <button onClick={() => deleteMemory(mem.id)} disabled={deleting === mem.id} style={{
                        width: 28, height: 28, border: "none", background: "none",
                        cursor: "pointer", color: C.inkMuted, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6,
                        opacity: deleting === mem.id ? 0.5 : 1,
                      }}>
                        {deleting === mem.id
                          ? <Loader2 size={13} strokeWidth={1.75} style={{ animation: "spin 1s linear infinite" }} />
                          : <Trash2 size={13} strokeWidth={1.75} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </SCard>
    </div>
  );
}
