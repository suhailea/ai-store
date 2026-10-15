import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { employeesApi, tasksApi } from "@/lib/api";
import type { Employee, Task, Memory } from "@staffroom/types";
import { AppShell } from "@/components/AppShell";
import {
  MessageSquare, Pause, Play, MoreHorizontal,
  History, Wallet, KeyRound, Brain,
  ArrowRight, Home, ChevronRight,
  Loader2, PenLine, Bot, ListChecks,
} from "lucide-react";
import { WorkTable } from "@/components/employee/WorkTable";
import { InstructionsTab } from "@/components/employee/InstructionsTab";
import { AccessTab } from "@/components/employee/AccessTab";
import { MemoryTab } from "@/components/employee/MemoryTab";
import {
  C, INTG_ICONS, INTG_LABELS,
  SCard, SCardHeader, IconTile, GhostBtn, SecBtn,
  KpiCard, BudgetSection,
} from "@/components/employee/shared";
import { empColor, timeAgo } from "@/lib/emp";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type TabId = "overview" | "instructions" | "access" | "memory" | "work_history" | "performance";

// ─── Status helpers ────────────────────────────────────────────────────────────

function getEmployeeStatus(employee: Employee, tasks: Task[]) {
  if (tasks.some((t) => t.status === "running"))
    return { label: "Working", color: "#22a06b" };
  if (tasks.some((t) => t.status === "waiting_approval"))
    return { label: "Waiting for you", color: "#f2a93b" };
  if (employee.status === "paused")
    return { label: "Paused", color: "#667085" };
  return { label: "Idle", color: "#98a2b3" };
}


// ─── Page ──────────────────────────────────────────────────────────────────────

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<TabId>("overview");
  const [showMenu, setShowMenu] = useState(false);
  const [confirmFire, setConfirmFire] = useState(false);
  const [acting, setActing]     = useState(false);
  const [modelProvider, setModelProvider] = useState("");
  const [modelId, setModelId]             = useState("");
  const [savingModel, setSavingModel]     = useState(false);
  const [modelSaved, setModelSaved]       = useState(false);

  async function load() {
    if (!id) return;
    const [emp, allTasks, mems] = await Promise.all([
      employeesApi.get(id),
      tasksApi.list(),
      employeesApi.memories(id),
    ]);
    setEmployee(emp);
    setTasks(allTasks.filter((t) => t.assignedToEmployeeId === id));
    setMemories(mems);
    setModelProvider(emp.llmProvider ?? "");
    setModelId(emp.llmModel ?? "");
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  const MODEL_OPTIONS: Record<string, { id: string; label: string }[]> = {
    anthropic: [
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast)" },
      { id: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6 (balanced)" },
      { id: "claude-opus-4-6",           label: "Claude Opus 4.6 (capable)" },
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

  async function saveModel() {
    if (!id) return;
    setSavingModel(true);
    try {
      await employeesApi.update(id, {
        llmProvider: modelProvider || null,
        llmModel: modelId || null,
      } as Partial<Employee>);
      setModelSaved(true);
      setTimeout(() => setModelSaved(false), 2500);
    } finally {
      setSavingModel(false);
    }
  }

  if (loading || !employee) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 384, fontSize: 14, color: C.inkMuted }}>
          Loading…
        </div>
      </AppShell>
    );
  }

  const color    = empColor(employee.displayName);
  const initials = employee.displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const status   = getEmployeeStatus(employee, tasks);

  // KPIs
  const weekAgo        = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const tasksThisWeek  = tasks.filter((t) => new Date(t.createdAt) >= weekAgo).length;
  const totalCost      = tasks.reduce((s, t) => s + t.costUsd, 0);
  const avgCost        = tasks.length > 0 ? totalCost / tasks.length : 0;
  const instEntries    = Object.entries(employee.instructionsJson ?? {});

  async function togglePause() {
    if (!id || acting || !employee) return;
    setActing(true);
    try {
      await employeesApi.update(id, { status: employee.status === "paused" ? "active" : "paused" });
      await load();
    } finally { setActing(false); }
  }

  async function handleFire() {
    if (!id || acting) return;
    setActing(true);
    try { await employeesApi.fire(id); navigate("/team"); }
    finally { setActing(false); }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview",     label: "Overview"                      },
    { id: "instructions", label: "Instructions"                  },
    { id: "access",       label: "Access"                        },
    { id: "memory",       label: "Memory"                        },
    { id: "work_history", label: `Work history (${tasks.length})` },
    { id: "performance",  label: "Performance"                   },
  ];

  return (
    <AppShell>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* ── Header region ───────────────────────────────────── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.line}`, padding: "20px 32px 0", flexShrink: 0 }}>

        {/* Breadcrumbs */}
        <nav style={{ marginBottom: 16 }}>
          <ol style={{ display: "flex", alignItems: "center", gap: 4, listStyle: "none", margin: 0, padding: 0, fontSize: 13 }}>
            <li>
              <Link to="/" style={{ color: C.inkMuted, textDecoration: "none", display: "flex", alignItems: "center" }}>
                <Home size={14} strokeWidth={1.75} />
              </Link>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <ChevronRight size={14} strokeWidth={1.75} color={C.lineStrong} />
              <Link to="/team" style={{ color: C.inkMuted, textDecoration: "none" }}>Team</Link>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <ChevronRight size={14} strokeWidth={1.75} color={C.lineStrong} />
              <span style={{ color: C.ink, fontWeight: 500 }}>{employee.displayName}</span>
            </li>
          </ol>
        </nav>

        {/* Employee identity row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>

            {/* 64px avatar + status dot */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 9999,
                background: color.bg, color: color.text,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 700,
              }}>
                {initials}
              </div>
              <span style={{
                position: "absolute", bottom: 1, right: 1,
                width: 12, height: 12, borderRadius: 9999,
                background: status.color, border: "2px solid #fff", display: "block",
              }} />
            </div>

            {/* Name / role / status / tags */}
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: C.ink, margin: "0 0 4px" }}>
                {employee.displayName}
              </h1>
              <p style={{ fontSize: 14, color: C.inkMuted, margin: "0 0 8px" }}>
                {employee.roleDescription} · hired {formatDate(employee.createdAt)}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 9999, background: status.color, display: "inline-block" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: status.color }}>{status.label}</span>
              </div>
              {employee.integrations.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {employee.integrations.map((intg) => (
                    <span key={intg} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      height: 22, padding: "0 8px", borderRadius: 6,
                      background: C.surfaceSunken, color: C.inkSecondary,
                      fontSize: 12, fontWeight: 500,
                    }}>
                      {INTG_ICONS[intg]}
                      {INTG_LABELS[intg] ?? intg}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <SecBtn>
              <MessageSquare size={16} strokeWidth={1.75} /> Message
            </SecBtn>
            <SecBtn onClick={togglePause} disabled={acting}>
              {employee.status === "paused"
                ? <><Play  size={16} strokeWidth={1.75} /> Resume</>
                : <><Pause size={16} strokeWidth={1.75} /> Pause</>}
            </SecBtn>
            {/* More */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                style={{
                  width: 38, height: 38, borderRadius: 8,
                  border: "none", background: "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: C.inkSecondary, cursor: "pointer",
                }}
              >
                <MoreHorizontal size={18} strokeWidth={1.75} />
              </button>
              {showMenu && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 4px)",
                  background: C.surface, border: `1px solid ${C.line}`,
                  borderRadius: 10, boxShadow: "0 8px 24px rgba(16,24,40,.12)",
                  minWidth: 160, zIndex: 50, overflow: "hidden", padding: 4,
                }}>
                  {!confirmFire ? (
                    <button onClick={() => setConfirmFire(true)} style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "8px 12px", background: "none", border: "none",
                      cursor: "pointer", borderRadius: 6, fontSize: 14, color: C.dangerFg,
                      textAlign: "left", fontWeight: 500,
                    }}>
                      Fire employee
                    </button>
                  ) : (
                    <div style={{ padding: "8px 12px" }}>
                      <p style={{ fontSize: 13, color: C.ink, margin: "0 0 8px", fontWeight: 500 }}>Are you sure?</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={handleFire} disabled={acting} style={{
                          flex: 1, height: 30, borderRadius: 6,
                          background: C.dangerFg, border: "none",
                          color: "#fff", fontSize: 13, fontWeight: 600,
                          cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.7 : 1,
                        }}>
                          {acting ? "…" : "Fire"}
                        </button>
                        <button onClick={() => { setConfirmFire(false); setShowMenu(false); }} style={{
                          flex: 1, height: 30, borderRadius: 6, background: "transparent",
                          border: `1px solid ${C.lineStrong}`, color: C.inkSecondary,
                          fontSize: 13, fontWeight: 500, cursor: "pointer",
                        }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab strip */}
        <div style={{ display: "flex", overflowX: "auto" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              height: 40, padding: "0 16px", background: "transparent", border: "none",
              borderBottom: tab === t.id ? `2px solid ${C.brand}` : "2px solid transparent",
              cursor: "pointer", fontSize: 14,
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? C.brand : C.inkMuted,
              whiteSpace: "nowrap", transition: "color .15s",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab body ─────────────────────────────────────────── */}
      <div style={{ padding: "24px 32px", overflowY: "auto", flex: 1 }}>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <>
            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
              <KpiCard label="Tasks this week" value={String(tasksThisWeek)} />
              <KpiCard label="Approved without edits" value="—" />
              <KpiCard label="Avg. cost per task" value={tasks.length > 0 ? `$${avgCost.toFixed(2)}` : "—"} />
              <KpiCard label="Time saved" value="—" />
            </div>

            {/* 2-col */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>

              {/* LEFT */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                {/* Standing instructions */}
                <SCard>
                  <SCardHeader
                    icon={<IconTile icon={<ListChecks size={20} strokeWidth={1.75} />} bg={C.brandSoft} color={C.brand} />}
                    title="Standing instructions"
                    subtitle={`${employee.displayName} follows these on every task.`}
                    action={<GhostBtn>Edit</GhostBtn>}
                  />
                  <div style={{ padding: "16px 20px" }}>
                    {instEntries.length > 0 ? (
                      <ol style={{ margin: 0, padding: "0 0 0 20px" }}>
                        {instEntries.map(([key, val], i) => (
                          <li key={key} style={{
                            fontSize: 14, color: C.ink, lineHeight: "22px",
                            marginBottom: i < instEntries.length - 1 ? 8 : 0,
                          }}>
                            <span style={{ fontWeight: 500 }}>{key.replace(/_/g, " ")}:</span> {val}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p style={{ fontSize: 14, color: C.inkMuted, margin: 0, lineHeight: "22px" }}>
                        No standing instructions yet. Add instructions to guide this employee.
                      </p>
                    )}
                  </div>
                </SCard>

                {/* Recent work */}
                <SCard>
                  <SCardHeader
                    icon={<IconTile icon={<History size={20} strokeWidth={1.75} />} bg={C.surfaceSunken} color={C.inkSecondary} />}
                    title="Recent work"
                    action={
                      <Link to="/board" style={{
                        fontSize: 13, fontWeight: 500, color: C.brand, textDecoration: "none",
                        display: "flex", alignItems: "center", gap: 2,
                      }}>
                        All {tasks.length} <ArrowRight size={14} strokeWidth={1.75} />
                      </Link>
                    }
                  />
                  <WorkTable tasks={[...tasks].reverse()} limit={5} />
                </SCard>
              </div>

              {/* RIGHT */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                {/* Budget */}
                <SCard>
                  <SCardHeader
                    icon={<IconTile icon={<Wallet size={20} strokeWidth={1.75} />} bg={C.warningBg} color={C.warningFg} />}
                    title="Budget"
                  />
                  <BudgetSection used={employee.budgetUsedUsd} total={employee.budgetMonthlyUsd} />
                </SCard>

                {/* AI Model */}
                <SCard>
                  <SCardHeader
                    icon={<IconTile icon={<Bot size={20} strokeWidth={1.75} />} bg={C.brandSoft} color={C.brand} />}
                    title="AI model"
                  />
                  <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 12, color: C.inkMuted, margin: "0 0 4px" }}>Provider</p>
                      <select
                        value={modelProvider}
                        onChange={(e) => { setModelProvider(e.target.value); setModelId(MODEL_OPTIONS[e.target.value]?.[0]?.id ?? ""); }}
                        style={{ width: "100%", height: 34, padding: "0 8px", borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 13, background: C.surface, color: C.ink, cursor: "pointer" }}
                      >
                        <option value="">Workspace default</option>
                        <option value="anthropic">Anthropic (Claude)</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="openrouter">OpenRouter (free)</option>
                        <option value="ollama">Ollama (local)</option>
                      </select>
                    </div>
                    {modelProvider && (
                      <div>
                        <p style={{ fontSize: 12, color: C.inkMuted, margin: "0 0 4px" }}>Model</p>
                        <select
                          value={modelId}
                          onChange={(e) => setModelId(e.target.value)}
                          style={{ width: "100%", height: 34, padding: "0 8px", borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 13, background: C.surface, color: C.ink, cursor: "pointer" }}
                        >
                          {(MODEL_OPTIONS[modelProvider] ?? []).map((m) => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button
                      onClick={() => void saveModel()}
                      disabled={savingModel}
                      style={{
                        height: 32, padding: "0 14px", borderRadius: 7, border: "none",
                        background: modelSaved ? C.successFg : C.brand,
                        color: "#fff", fontSize: 13, fontWeight: 600, cursor: savingModel ? "not-allowed" : "pointer",
                        opacity: savingModel ? 0.7 : 1, alignSelf: "flex-start",
                        display: "flex", alignItems: "center", gap: 6,
                        transition: "background 0.12s",
                      }}
                    >
                      {savingModel ? <><Loader2 size={13} strokeWidth={1.75} style={{ animation: "spin 1s linear infinite" }} />Saving…</> : modelSaved ? "Saved" : "Save model"}
                    </button>
                  </div>
                </SCard>

                {/* Access badge */}
                <SCard>
                  <SCardHeader
                    icon={<IconTile icon={<KeyRound size={20} strokeWidth={1.75} />} bg={C.surfaceSunken} color={C.inkSecondary} />}
                    title="Access badge"
                    action={<GhostBtn onClick={() => setTab("access")}>Manage</GhostBtn>}
                  />
                  <div style={{ padding: "8px 0" }}>
                    {employee.integrations.length > 0 ? employee.integrations.map((intg) => (
                      <div key={intg} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px" }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 6, background: C.surfaceSunken,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: C.inkSecondary, flexShrink: 0,
                        }}>
                          {INTG_ICONS[intg]}
                        </div>
                        <span style={{ flex: 1, fontSize: 14, color: C.ink, fontWeight: 500 }}>
                          {INTG_LABELS[intg] ?? intg}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {(["Read", "Write · via approval"] as const).map((lbl) => (
                            <span key={lbl} style={{
                              display: "inline-flex", alignItems: "center", height: 20, padding: "0 6px",
                              borderRadius: 4, background: C.surfaceSunken, color: C.inkSecondary,
                              fontSize: 11, fontWeight: 500,
                            }}>
                              {lbl}
                            </span>
                          ))}
                          <span style={{ fontSize: 12, color: C.successFg, fontWeight: 500, marginLeft: 4 }}>
                            ● Connected
                          </span>
                        </div>
                      </div>
                    )) : (
                      <div style={{ padding: 20, textAlign: "center", color: C.inkMuted, fontSize: 14 }}>
                        No integrations configured
                      </div>
                    )}
                  </div>
                </SCard>

                {/* Learned memories */}
                <SCard>
                  <SCardHeader
                    icon={<IconTile icon={<Brain size={20} strokeWidth={1.75} />} bg={C.infoBg} color={C.infoFg} />}
                    title={`What ${employee.displayName} has learned`}
                  />
                  <div style={{ padding: "8px 0" }}>
                    {memories.length > 0 ? memories.slice(0, 5).map((mem) => (
                      <div key={mem.id} style={{ padding: "10px 20px", borderBottom: `1px solid #f2f4f7` }}>
                        <p style={{ fontSize: 14, color: C.ink, margin: "0 0 4px", lineHeight: "20px" }}>
                          {mem.content}
                        </p>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{
                            display: "inline-flex", height: 20, padding: "0 6px", borderRadius: 4,
                            background: C.surfaceSunken, color: C.inkMuted,
                            fontSize: 11, fontWeight: 500, alignItems: "center", textTransform: "capitalize",
                          }}>
                            {mem.kind}
                          </span>
                          <span style={{ fontSize: 12, color: C.inkMuted }}>{timeAgo(mem.createdAt)}</span>
                        </div>
                      </div>
                    )) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 24, gap: 8, color: C.inkMuted }}>
                        <Brain size={24} strokeWidth={1.75} color={C.icon} />
                        <p style={{ fontSize: 14, margin: 0 }}>No memories yet</p>
                      </div>
                    )}
                  </div>
                </SCard>

              </div>
            </div>
          </>
        )}

        {/* WORK HISTORY */}
        {tab === "work_history" && (
          <SCard>
            <SCardHeader
              icon={<IconTile icon={<History size={20} strokeWidth={1.75} />} bg={C.surfaceSunken} color={C.inkSecondary} />}
              title={`Work history · ${tasks.length} tasks`}
            />
            <WorkTable tasks={[...tasks].reverse()} />
          </SCard>
        )}

        {tab === "instructions" && (
          <InstructionsTab employee={employee} onSaved={load} />
        )}
        {tab === "access" && (
          <AccessTab employee={employee} onReload={load} />
        )}
        {tab === "memory" && (
          <MemoryTab employee={employee} memories={memories} onRefresh={load} />
        )}
        {tab === "performance" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "80px 24px", color: C.inkMuted, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: C.surfaceSubtle, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PenLine size={20} strokeWidth={1.75} color={C.icon} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 4px" }}>Performance analytics</p>
              <p style={{ fontSize: 13, color: C.inkMuted, margin: 0 }}>Approval rates, average cost, and time saved — coming soon.</p>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
