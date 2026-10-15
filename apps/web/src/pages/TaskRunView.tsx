import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { tasksApi, employeesApi, approvalsApi } from "@/lib/api";
import type { Task, RunStep, Employee, Approval } from "@staffroom/types";
import { AppShell } from "@/components/AppShell";
import { empColor, timeAgo } from "@/lib/emp";
import {
  Brain, ArrowRight, CheckCircle2, CheckCircle, Clock, Square,
  RefreshCw, Activity, Wallet, Info, ShieldAlert, ShieldCheck, ShieldX,
  Home, ChevronRight, type LucideIcon,
} from "lucide-react";

// ─── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  ink: "#101828",
  inkSecondary: "#475467",
  inkMuted: "#667085",
  icon: "#8a94a6",
  surface: "#fff",
  surfaceSubtle: "#f7f8fa",
  surfaceSunken: "#eef1f4",
  line: "#e4e7ec",
  lineStrong: "#d0d5dd",
  brand: "#0f5b6c",
  brandSoft: "#e6f2f4",
  successFg: "#157f4f",
  successBg: "#e8f6ee",
  warningFg: "#b45309",
  warningBg: "#fef4e4",
  dangerFg: "#c0362c",
  dangerBg: "#fdecea",
  infoFg: "#1d63c8",
  infoBg: "#eaf1fc",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

type TaskWithRun = Task & {
  run: { steps: RunStep[]; costUsd: number; durationMs: number; totalTokens: number } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── Step config ──────────────────────────────────────────────────────────────

type StepType = RunStep["type"];

const STEP_CFG: Record<StepType, {
  MarkerIcon: LucideIcon;
  markerBg: string;
  markerColor: string;
  title: string;
}> = {
  thought:     { MarkerIcon: Brain,        markerBg: "#efedfb", markerColor: "#5e4bc4", title: "Reasoning" },
  tool_call:   { MarkerIcon: ArrowRight,   markerBg: "#e0f2fe", markerColor: "#0284c7", title: "Tool call" },
  tool_result: { MarkerIcon: CheckCircle,  markerBg: "#e6f5ee", markerColor: "#17774f", title: "Result"    },
  final:       { MarkerIcon: CheckCircle2, markerBg: C.brandSoft, markerColor: C.brand, title: "Final answer" },
};

// ─── Tiny atoms ───────────────────────────────────────────────────────────────

function SCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.line}`,
      borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,40,.05)",
      overflow: "hidden", ...style,
    }}>
      {children}
    </div>
  );
}

function SCardHeader({
  icon, title, right,
}: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div style={{
      padding: "16px 20px", borderBottom: `1px solid ${C.line}`,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      {icon}
      <h3 style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.ink, margin: 0, lineHeight: "20px" }}>
        {title}
      </h3>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

function IconTile({ icon, bg, color }: { icon: React.ReactNode; bg: string; color: string }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8, background: bg, color,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {icon}
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", gap: 6,
      height: 38, padding: "0 16px", borderRadius: 8,
      border: "none", background: C.brand, color: "#fff",
      fontSize: 14, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
    }}>
      {children}
    </button>
  );
}

function SecBtn({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "flex", alignItems: "center", gap: 6,
      height: 38, padding: "0 16px", borderRadius: 8,
      border: `1px solid ${danger ? C.dangerFg : C.lineStrong}`,
      background: danger ? C.dangerFg : C.surface,
      color: danger ? "#fff" : C.ink,
      fontSize: 14, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
    }}>
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
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

// ─── Task status badge ─────────────────────────────────────────────────────────

const TASK_ST: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
  running:          { bg: C.infoBg,        fg: C.infoFg,    dot: "#1d63c8", label: "Working"         },
  waiting_approval: { bg: C.warningBg,     fg: C.warningFg, dot: "#f2a93b", label: "Waiting for you" },
  done:             { bg: C.successBg,     fg: C.successFg, dot: "#22a06b", label: "Done"            },
  queued:           { bg: C.surfaceSunken, fg: C.inkMuted,  dot: "#98a2b3", label: "Queued"          },
  stopped:          { bg: C.dangerBg,      fg: C.dangerFg,  dot: C.dangerFg, label: "Stopped"       },
  stale:            { bg: C.dangerBg,      fg: C.dangerFg,  dot: C.dangerFg, label: "Stale"         },
};

function StatusPill({ status, stepCount, totalSteps }: { status: string; stepCount?: number; totalSteps?: number }) {
  const s = TASK_ST[status] ?? { bg: C.surfaceSunken, fg: C.inkMuted, dot: C.icon, label: status };
  const stepLabel = (typeof stepCount === "number" && typeof totalSteps === "number" && totalSteps > 0)
    ? ` · step ${stepCount} of ${totalSteps}`
    : "";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      height: 26, padding: "0 10px", borderRadius: 9999,
      background: s.bg, color: s.fg,
      fontSize: 13, fontWeight: 600,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 9999, background: s.dot, flexShrink: 0 }} />
      {s.label}{stepLabel}
    </span>
  );
}

// ─── Mini avatar ──────────────────────────────────────────────────────────────

function MiniAvatar({ name, size = 22 }: { name: string; size?: number }) {
  const colors = empColor(name);
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 9999,
      background: colors.bg, color: colors.text,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = C.brand }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div style={{ height: 6, borderRadius: 9999, background: C.surfaceSunken, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 9999, transition: "width .3s" }} />
    </div>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────

type TabId = "trace" | "output" | "audit";

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TaskRunView() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [task, setTask]               = useState<TaskWithRun | null>(null);
  const [employee, setEmployee]       = useState<Employee | null>(null);
  const [approval, setApproval]       = useState<Approval | null>(null);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<TabId>("trace");
  const [stopping, setStopping]       = useState(false);
  const [approving, setApproving]     = useState(false);
  const [rejecting, setRejecting]     = useState(false);
  const [rejectNote, setRejectNote]   = useState("");
  const [showReject, setShowReject]   = useState(false);
  const timelineEndRef = useRef<HTMLDivElement>(null);

  async function load() {
    if (!id) return;
    const data = await tasksApi.get(id) as TaskWithRun;
    setTask(data);

    if (data.assignedToEmployeeId) {
      employeesApi.get(data.assignedToEmployeeId).then(setEmployee).catch(() => {});
    }

    if (data.status === "waiting_approval") {
      approvalsApi.list().then((rows) => {
        const match = rows.find((r) => r.task.id === id);
        setApproval(match?.approval ?? null);
      }).catch(() => {});
    } else {
      setApproval(null);
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  // Poll while active
  useEffect(() => {
    if (!task) return;
    if (["done", "stopped", "stale"].includes(task.status)) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [task?.status]);

  // Auto-scroll
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [task?.run?.steps?.length]);

  if (loading || !task) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 384, fontSize: 14, color: C.inkMuted }}>
          Loading…
        </div>
      </AppShell>
    );
  }

  const steps = (task.run?.steps ?? []) as RunStep[];
  const isRunning  = task.status === "running";
  const isWaiting  = task.status === "waiting_approval";
  const isDone     = task.status === "done";
  const isStopped  = task.status === "stopped" || task.status === "stale";
  const isActive   = isRunning || isWaiting || task.status === "queued";

  async function handleStop() {
    if (!id || stopping) return;
    setStopping(true);
    try { await tasksApi.stop(id); await load(); } finally { setStopping(false); }
  }

  async function handleApprove() {
    if (!approval || approving) return;
    setApproving(true);
    try { await approvalsApi.approve(approval.id); await load(); } finally { setApproving(false); }
  }

  async function handleReject() {
    if (!approval || rejecting) return;
    setRejecting(true);
    try {
      await approvalsApi.reject(approval.id, rejectNote);
      setRejectNote(""); setShowReject(false);
      await load();
    } finally { setRejecting(false); }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "trace",  label: "Run trace"  },
    { id: "output", label: "Output"     },
    { id: "audit",  label: "Audit log"  },
  ];

  return (
    <AppShell>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* ── Header ───────────────────────────────────────────── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.line}`, padding: "20px 32px 0", flexShrink: 0 }}>

        {/* Breadcrumbs */}
        <nav style={{ marginBottom: 12 }}>
          <ol style={{ display: "flex", alignItems: "center", gap: 4, listStyle: "none", margin: 0, padding: 0, fontSize: 13 }}>
            <li>
              <Link to="/" style={{ color: C.inkMuted, textDecoration: "none", display: "flex", alignItems: "center" }}>
                <Home size={14} strokeWidth={1.75} />
              </Link>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <ChevronRight size={14} strokeWidth={1.75} color={C.lineStrong} />
              <Link to="/board" style={{ color: C.inkMuted, textDecoration: "none" }}>Team board</Link>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <ChevronRight size={14} strokeWidth={1.75} color={C.lineStrong} />
              <span style={{ color: C.ink, fontWeight: 500, fontFamily: '"JetBrains Mono",monospace', fontSize: 12 }}>
                {task.id.slice(0, 8)}
              </span>
            </li>
          </ol>
        </nav>

        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, paddingBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: C.ink, margin: "0 0 4px", lineHeight: "32px" }}>
              {task.title}
            </h1>
            {task.description && (
              <p style={{ fontSize: 14, color: C.inkMuted, margin: "0 0 10px", lineHeight: "20px" }}>
                {task.description}
              </p>
            )}
            {/* Status row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <StatusPill
                status={task.status}
                stepCount={steps.length}
                totalSteps={steps.length}
              />
              {employee && (
                <>
                  <MiniAvatar name={employee.displayName} />
                  <span style={{ fontSize: 13, color: C.inkSecondary, fontWeight: 500 }}>
                    {employee.displayName}
                  </span>
                  <span style={{ fontSize: 12, color: C.inkMuted }}>
                    {employee.roleDescription.split("—")[0].trim()}
                  </span>
                </>
              )}
              <span style={{ fontSize: 12, color: C.inkMuted }}>
                Started {timeAgo(task.startedAt ?? task.createdAt)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <SecBtn onClick={load}>
              <RefreshCw size={16} strokeWidth={1.75} /> Retry
            </SecBtn>
            {isActive && (
              <SecBtn onClick={handleStop} disabled={stopping} danger>
                <Square size={16} strokeWidth={1.75} />
                {stopping ? "Stopping…" : "Stop run"}
              </SecBtn>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex" }}>
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

        {/* RUN TRACE */}
        {tab === "trace" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(300px,320px)", gap: 24, alignItems: "start" }}>

            {/* LEFT: Timeline */}
            <SCard>
              <SCardHeader
                icon={<IconTile icon={<Activity size={20} strokeWidth={1.75} />} bg={C.brandSoft} color={C.brand} />}
                title="Run trace"
                right={task.run && (task.run.costUsd > 0 || task.run.durationMs > 0) ? (
                  <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, color: C.inkMuted }}>
                    {task.run.costUsd > 0 ? `$${task.run.costUsd.toFixed(4)} · ` : ""}
                    {task.run.durationMs > 0 ? fmtDuration(task.run.durationMs) : ""}
                  </span>
                ) : undefined}
              />

              {/* Status banner */}
              {isRunning && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 20px",
                  background: C.brandSoft, borderLeft: `3px solid ${C.brand}`,
                  borderBottom: `1px solid ${C.line}`,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: 9999, background: C.brand, display: "inline-block" }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.brand }}>
                    Working · step {steps.length}
                  </span>
                </div>
              )}
              {isWaiting && (
                <div style={{
                  padding: "12px 20px", background: C.warningBg, borderBottom: `1px solid #f2d98a`,
                  borderLeft: `3px solid ${C.warningFg}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <ShieldAlert size={16} strokeWidth={1.75} color={C.warningFg} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.warningFg }}>
                      Waiting for your approval
                      {approval?.reason ? ` · ${approval.reason}` : ""}
                    </span>
                  </div>
                  {approval?.payloadJson && (
                    <pre style={{
                      fontSize: 12, fontFamily: '"JetBrains Mono",monospace',
                      background: "rgba(0,0,0,.04)", borderRadius: 6, padding: "8px 12px",
                      overflowX: "auto", marginBottom: 10, maxHeight: 120,
                      border: `1px solid rgba(0,0,0,.08)`, color: C.inkSecondary,
                      whiteSpace: "pre-wrap",
                    }}>
                      {JSON.stringify(approval.payloadJson, null, 2)}
                    </pre>
                  )}
                  {!showReject ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <PrimaryBtn onClick={handleApprove} disabled={approving}>
                        <ShieldCheck size={16} strokeWidth={1.75} />
                        {approving ? "Approving…" : "Approve"}
                      </PrimaryBtn>
                      <GhostBtn onClick={() => setShowReject(true)}>
                        <ShieldX size={16} strokeWidth={1.75} /> Reject
                      </GhostBtn>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea
                        autoFocus
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Reason for rejection (optional)"
                        rows={2}
                        style={{
                          width: "100%", borderRadius: 8, border: `1px solid ${C.lineStrong}`,
                          padding: "8px 12px", fontSize: 13, fontFamily: "inherit",
                          resize: "none", outline: "none", boxSizing: "border-box",
                          color: C.ink, background: C.surface,
                        }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <SecBtn onClick={handleReject} disabled={rejecting} danger>
                          <ShieldX size={16} strokeWidth={1.75} />
                          {rejecting ? "Rejecting…" : "Confirm rejection"}
                        </SecBtn>
                        <GhostBtn onClick={() => setShowReject(false)}>Cancel</GhostBtn>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {isDone && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: C.successBg, borderBottom: `1px solid #b7e5c8`, borderLeft: `3px solid ${C.successFg}` }}>
                  <CheckCircle2 size={16} strokeWidth={1.75} color={C.successFg} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.successFg }}>Run complete</span>
                  {task.finishedAt && (
                    <span style={{ fontSize: 12, color: C.successFg, fontWeight: 400 }}>· {timeAgo(task.finishedAt)}</span>
                  )}
                </div>
              )}
              {isStopped && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: C.dangerBg, borderBottom: `1px solid #f3b3b0`, borderLeft: `3px solid ${C.dangerFg}` }}>
                  <Square size={16} strokeWidth={1.75} color={C.dangerFg} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.dangerFg }}>Run stopped</span>
                </div>
              )}

              {/* Timeline steps */}
              <div style={{ padding: "20px 20px 20px 20px", position: "relative" }}>
                {steps.length === 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "48px 0", color: C.inkMuted, fontSize: 14 }}>
                    {isActive ? (
                      <>
                        <div style={{ width: 16, height: 16, border: `2px solid ${C.line}`, borderTopColor: C.brand, borderRadius: 9999, animation: "spin 1s linear infinite" }} />
                        Waiting for agent to start…
                      </>
                    ) : "No trace available."}
                  </div>
                )}

                {steps.length > 0 && (
                  <div style={{ position: "relative" }}>
                    {/* Vertical connector line */}
                    <div style={{
                      position: "absolute",
                      left: 15, top: 8, bottom: 8,
                      width: 1, background: C.line, zIndex: 0,
                    }} />

                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {steps.map((step, i) => {
                        const cfg = STEP_CFG[step.type as StepType] ?? STEP_CFG.thought;
                        const Icon = cfg.MarkerIcon;
                        const isThought = step.type === "thought";

                        return (
                          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
                            {/* Circle marker */}
                            <div style={{
                              width: 32, height: 32, borderRadius: 9999, flexShrink: 0,
                              background: cfg.markerBg, color: cfg.markerColor,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              zIndex: 1, position: "relative",
                              border: "2px solid #fff",
                              boxShadow: "0 0 0 1px rgba(0,0,0,.06)",
                            }}>
                              <Icon size={16} strokeWidth={1.75} />
                            </div>

                            {/* Body */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Header line */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: isThought ? C.inkSecondary : C.ink }}>
                                  {cfg.title}
                                </span>

                                {/* Tool badge */}
                                {step.toolName && (
                                  <span style={{
                                    display: "inline-flex", alignItems: "center",
                                    padding: "2px 8px", borderRadius: 6,
                                    background: C.surfaceSunken,
                                    fontFamily: '"JetBrains Mono",monospace',
                                    fontSize: 12, color: C.inkSecondary,
                                    border: `1px solid ${C.line}`,
                                  }}>
                                    {step.toolName}
                                    {step.toolArgs?.to ? ` → ${step.toolArgs.to}` : ""}
                                  </span>
                                )}

                                {/* Cost + time */}
                                <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                                  {step.costUsd != null && step.costUsd > 0 && (
                                    <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, color: C.inkMuted }}>
                                      ${step.costUsd.toFixed(4)}
                                    </span>
                                  )}
                                  <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, color: C.inkMuted }}>
                                    {fmtTime(step.timestamp)}
                                  </span>
                                </div>
                              </div>

                              {/* Detail box */}
                              {step.content && (
                                <div style={{
                                  background: C.surfaceSubtle, borderRadius: 8,
                                  padding: "8px 12px", fontSize: 13, color: C.inkSecondary,
                                  lineHeight: "20px", whiteSpace: "pre-wrap", wordBreak: "break-word",
                                }}>
                                  {step.content}
                                </div>
                              )}

                              {/* Tool args */}
                              {step.toolArgs && Object.keys(step.toolArgs).length > 0 && step.type === "tool_call" && (
                                <pre style={{
                                  marginTop: 6, fontSize: 12, fontFamily: '"JetBrains Mono",monospace',
                                  background: C.surfaceSunken, borderRadius: 8, padding: "8px 12px",
                                  overflowX: "auto", color: C.inkSecondary, whiteSpace: "pre-wrap",
                                  border: `1px solid ${C.line}`,
                                }}>
                                  {JSON.stringify(step.toolArgs, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Live spinner */}
                      {isRunning && (
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 9999, flexShrink: 0,
                            background: C.surfaceSunken, zIndex: 1, position: "relative",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            border: "2px solid #fff",
                          }}>
                            <Clock size={14} strokeWidth={1.75} color={C.inkMuted} />
                          </div>
                          <span style={{ fontSize: 14, color: C.inkMuted }}>Working…</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div ref={timelineEndRef} />
              </div>
            </SCard>

            {/* RIGHT: Details + Cost */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Details card */}
              <SCard>
                <SCardHeader
                  icon={<IconTile icon={<Info size={20} strokeWidth={1.75} />} bg={C.surfaceSunken} color={C.inkSecondary} />}
                  title="Details"
                />
                <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    {
                      label: "Owner",
                      value: employee ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <MiniAvatar name={employee.displayName} />
                          <span style={{ fontSize: 14, color: C.ink }}>{employee.displayName}</span>
                        </div>
                      ) : "—",
                    },
                    {
                      label: "Requested by",
                      value: <span style={{ fontSize: 14, color: C.ink }}>
                        {task.createdByHumanId ? "Human · chat" : "System"}
                      </span>,
                    },
                    {
                      label: "Model",
                      value: <span style={{ fontSize: 14, color: C.ink }}>Fast (default)</span>,
                    },
                    {
                      label: "Task ID",
                      value: <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 12, color: C.inkSecondary }}>{task.id}</span>,
                    },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 12, color: C.inkMuted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {label}
                      </span>
                      <div>{value}</div>
                    </div>
                  ))}
                </div>
              </SCard>

              {/* Cost card */}
              <SCard>
                <SCardHeader
                  icon={<IconTile icon={<Wallet size={20} strokeWidth={1.75} />} bg={C.warningBg} color={C.warningFg} />}
                  title="Cost"
                />
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* This run */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: C.inkMuted }}>This run</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: '"JetBrains Mono",monospace' }}>
                        ${(task.run?.costUsd ?? task.costUsd ?? 0).toFixed(4)}{" "}
                        <span style={{ fontWeight: 400, color: C.inkMuted }}>
                          of ${employee?.budgetMonthlyUsd?.toFixed(2) ?? "—"} cap
                        </span>
                      </span>
                    </div>
                    <ProgressBar
                      value={task.run?.costUsd ?? task.costUsd ?? 0}
                      max={employee?.budgetMonthlyUsd ?? 100}
                    />
                  </div>

                  {/* Employee this month */}
                  {employee && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: C.inkMuted }}>{employee.displayName} this month</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: '"JetBrains Mono",monospace' }}>
                          ${employee.budgetUsedUsd.toFixed(2)}{" "}
                          <span style={{ fontWeight: 400, color: C.inkMuted }}>of ${employee.budgetMonthlyUsd}</span>
                        </span>
                      </div>
                      <ProgressBar
                        value={employee.budgetUsedUsd}
                        max={employee.budgetMonthlyUsd}
                        color={
                          employee.budgetMonthlyUsd > 0 && employee.budgetUsedUsd / employee.budgetMonthlyUsd >= 0.9
                            ? C.dangerFg
                            : employee.budgetMonthlyUsd > 0 && employee.budgetUsedUsd / employee.budgetMonthlyUsd >= 0.75
                            ? C.warningFg
                            : C.brand
                        }
                      />
                    </div>
                  )}
                </div>
              </SCard>

            </div>
          </div>
        )}

        {/* OUTPUT */}
        {tab === "output" && (
          <SCard>
            <SCardHeader
              icon={<IconTile icon={<CheckCircle2 size={20} strokeWidth={1.75} />} bg={C.successBg} color={C.successFg} />}
              title="Output"
            />
            <div style={{ padding: "16px 20px" }}>
              {task.run ? (
                <pre style={{
                  fontSize: 13, fontFamily: '"JetBrains Mono",monospace',
                  background: C.surfaceSunken, borderRadius: 8, padding: "12px 16px",
                  overflowX: "auto", color: C.inkSecondary, whiteSpace: "pre-wrap", lineHeight: "20px",
                }}>
                  {JSON.stringify(task.run, null, 2)}
                </pre>
              ) : (
                <p style={{ fontSize: 14, color: C.inkMuted, margin: 0 }}>No output yet.</p>
              )}
            </div>
          </SCard>
        )}

        {/* AUDIT LOG */}
        {tab === "audit" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "80px 24px", color: C.inkMuted, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: C.surfaceSubtle, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={20} strokeWidth={1.75} color={C.icon} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.ink, margin: "0 0 4px" }}>Audit log</p>
              <p style={{ fontSize: 13, color: C.inkMuted, margin: 0 }}>Audit log coming soon.</p>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
