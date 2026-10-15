/**
 * Chat.tsx — conversational task interface with session support.
 *
 * Each user message creates a task linked to a chat session.
 * The AI response streams in via polling (GET /tasks/:id every 2s),
 * showing run steps as they arrive, then a final summary bubble when done.
 *
 * Layout:
 *   Left column  — employee pills + session list
 *   Right panel  — active conversation with streaming step feed
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { employeesApi, tasksApi, approvalsApi, chatSessionsApi } from "@/lib/api";
import type { ChatSession } from "@/lib/api";
import type { Employee, Task, RunStep } from "@staffroom/types";
import { AppShell } from "@/components/AppShell";
import {
  Send,
  Loader2,
  MessageSquare,
  Clock,
  ExternalLink,
  Plus,
} from "lucide-react";
import { EmpAvatar } from "@/components/EmpAvatar";
import { AssistantBubble, extractReply } from "@/components/chat/AssistantBubble";
import { UserBubble } from "@/components/chat/UserBubble";
import { empColor, initials, timeAgo } from "@/lib/emp";

// ─── Design tokens ────────────────────────────────────────────────────────────

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
  sidebar: "#0b2530",
  successFg: "#157f4f",
  successBg: "#e8f6ee",
  warningFg: "#b45309",
  warningBg: "#fef4e4",
  dangerFg: "#c0362c",
  dangerBg: "#fdecea",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskWithRun = Task & {
  run: { steps: RunStep[]; costUsd: number; durationMs: number; totalTokens: number } | null;
};

export interface ChatMessage {
  id: string;         // local id
  taskId: string | null;
  role: "user" | "assistant";
  text: string;       // user prompt or final summary
  status: "sending" | "running" | "waiting_approval" | "done" | "stopped" | "stale";
  steps: RunStep[];
  costUsd: number;
  employeeName: string;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Sidebar: employee tabs + session list ────────────────────────────────────

function ConvSidebar({
  employees,
  selectedEmpId,
  onSelect,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
}: {
  employees: Employee[];
  selectedEmpId: string;
  onSelect: (id: string) => void;
  sessions: Record<string, ChatSession[]>;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
}) {
  const activeEmps = employees.filter((e) => e.status === "active");
  const empSessions = sessions[selectedEmpId] ?? [];

  return (
    <div style={{
      width: 256, flexShrink: 0,
      borderRight: `1px solid ${C.line}`,
      background: C.surface,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* ── Employee dropdown ── */}
      <div style={{ padding: "12px 12px 10px", borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
        <p style={{
          fontSize: 11, fontWeight: 600, color: C.icon,
          letterSpacing: "0.06em", textTransform: "uppercase",
          margin: "0 0 6px 2px",
        }}>
          Employee
        </p>
        {(() => {
          const selected = activeEmps.find((e) => e.id === selectedEmpId);
          const c = selected ? empColor(selected.displayName) : { bg: C.surfaceSubtle, text: C.inkSecondary };
          return (
            <div style={{ position: "relative" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 32px 6px 8px",
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                background: C.surface,
                pointerEvents: "none",
                position: "absolute", inset: 0, zIndex: 1,
              }}>
                {selected && (
                  <div style={{
                    width: 24, height: 24, borderRadius: "9999px",
                    background: c.bg, color: c.text,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, flexShrink: 0,
                  }}>
                    {initials(selected.displayName)}
                  </div>
                )}
                <span style={{ fontSize: 13, fontWeight: 500, color: C.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selected ? selected.displayName : "Select employee…"}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: C.inkMuted }}>
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <select
                value={selectedEmpId}
                onChange={(e) => onSelect(e.target.value)}
                style={{
                  position: "relative", zIndex: 2,
                  width: "100%", height: 38,
                  opacity: 0, cursor: "pointer",
                }}
              >
                {activeEmps.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.displayName} — {emp.roleDescription?.split("—")[0]?.trim() ?? ""}</option>
                ))}
              </select>
            </div>
          );
        })()}
      </div>

      {/* ── New Chat button ── */}
      <div style={{ padding: "10px 12px 6px", flexShrink: 0 }}>
        <button
          onClick={onNewChat}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 7,
            height: 34, padding: "0 12px",
            background: C.brand, border: "none", borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: "#fff",
            cursor: "pointer", transition: "background 120ms",
          }}
        >
          <Plus size={14} strokeWidth={2} />
          New Chat
        </button>
      </div>

      {/* ── Session list ── */}
      <div style={{
        padding: "4px 0 4px",
        flexShrink: 0,
      }}>
        <p style={{
          fontSize: 11, fontWeight: 600, color: C.icon,
          letterSpacing: "0.06em", textTransform: "uppercase",
          margin: "0 0 4px 14px",
        }}>
          Conversations
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {empSessions.length === 0 ? (
          <div style={{
            padding: "24px 16px",
            textAlign: "center",
            color: C.inkMuted, fontSize: 13,
          }}>
            No conversations yet
          </div>
        ) : (
          empSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "flex-start", gap: 9,
                  padding: "9px 14px",
                  background: isActive ? C.brandSoft : "transparent",
                  borderLeft: isActive ? `2px solid ${C.brand}` : "2px solid transparent",
                  border: "none", cursor: "pointer", textAlign: "left",
                  transition: "background 100ms",
                }}
                onMouseEnter={(ev) => { if (!isActive) ev.currentTarget.style.background = C.surfaceSubtle; }}
                onMouseLeave={(ev) => { if (!isActive) ev.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ paddingTop: 5 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: "9999px",
                    background: C.inkMuted, flexShrink: 0, display: "inline-block",
                    opacity: 0.5,
                  }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{
                    margin: 0,
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    color: isActive ? C.brand : C.ink,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {session.title}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: C.inkMuted }}>
                    {timeAgo(session.updatedAt)}
                    {session.taskCount > 0 && (
                      <span style={{ marginLeft: 6 }}>· {session.taskCount} {session.taskCount === 1 ? "task" : "tasks"}</span>
                    )}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TERMINAL_STATUSES = ["done", "stopped", "stale"];
const POLL_INTERVAL_MS = 2500;

// Build ChatMessage pairs from a persisted task+run record
function taskToChatMessages(
  task: Task & { run: { steps: unknown[]; costUsd: number } | null },
  empName: string
): ChatMessage[] {
  const steps = (task.run?.steps ?? []) as RunStep[];
  const reply = TERMINAL_STATUSES.includes(task.status) ? extractReply(steps, "") : "";
  const user: ChatMessage = {
    id: `user_${task.id}`,
    taskId: task.id,
    role: "user",
    text: task.title,
    status: task.status as ChatMessage["status"],
    steps: [],
    costUsd: 0,
    employeeName: empName,
    createdAt: task.createdAt as unknown as string,
  };
  const assistant: ChatMessage = {
    id: `asst_${task.id}`,
    taskId: task.id,
    role: "assistant",
    text: reply,
    status: task.status as ChatMessage["status"],
    steps,
    costUsd: task.run?.costUsd ?? 0,
    employeeName: empName,
    createdAt: task.createdAt as unknown as string,
  };
  return [user, assistant];
}

export default function Chat() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [sessions, setSessions] = useState<Record<string, ChatSession[]>>({}); // keyed by employeeId
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({}); // keyed by sessionId
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadedSessions, setLoadedSessions] = useState<Set<string>>(new Set());
  const [loadedEmpSessions, setLoadedEmpSessions] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const msgRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Track active task polls: Map<localMsgId, intervalId>
  const pollMap = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Load employees on mount
  useEffect(() => {
    employeesApi.list().then((emps) => {
      const active = emps.filter((e) => e.status === "active");
      setEmployees(active);
      if (active.length > 0) setSelectedEmpId(active[0].id);
    }).finally(() => setLoading(false));
    return () => {
      pollMap.current.forEach((id) => clearInterval(id));
    };
  }, []);

  // Load sessions when employee selected for the first time
  useEffect(() => {
    if (!selectedEmpId || loadedEmpSessions.has(selectedEmpId)) return;
    setLoadedEmpSessions((prev) => new Set([...prev, selectedEmpId]));
    chatSessionsApi.list(selectedEmpId).then((list) => {
      setSessions((prev) => ({ ...prev, [selectedEmpId]: list }));
      // auto-select most recent session
      if (list.length > 0 && !activeSessionId) {
        setActiveSessionId(list[0].id);
      }
    }).catch(() => {});
  }, [selectedEmpId, employees]);

  // Load tasks when session selected for the first time
  useEffect(() => {
    if (!activeSessionId || loadedSessions.has(activeSessionId)) return;
    setLoadedSessions((prev) => new Set([...prev, activeSessionId]));
    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;
    chatSessionsApi.tasks(activeSessionId).then((rows) => {
      const pairs = [...rows].reverse().flatMap((t) =>
        taskToChatMessages(t as Task & { run: { steps: unknown[]; costUsd: number } | null }, emp.displayName)
      );
      setMessages((prev) => ({ ...prev, [activeSessionId]: pairs }));
      // resume polling for non-terminal tasks
      (rows as Array<Task & { run: unknown }>).filter((t) => !TERMINAL_STATUSES.includes(t.status)).forEach((t) => {
        startPolling(activeSessionId, `asst_${t.id}`, t.id);
      });
    }).catch(() => {});
  }, [activeSessionId, employees]);

  // Auto-scroll when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const currentMessages = messages[activeSessionId ?? ""] ?? [];

  function updateMessage(sessionId: string, localId: string, patch: Partial<ChatMessage>) {
    setMessages((prev) => {
      const list = prev[sessionId] ?? [];
      return {
        ...prev,
        [sessionId]: list.map((m) => m.id === localId ? { ...m, ...patch } : m),
      };
    });
  }

  function startPolling(sessionId: string, localId: string, taskId: string) {
    const existing = pollMap.current.get(localId);
    if (existing) clearInterval(existing);

    const interval = setInterval(async () => {
      try {
        const data = await tasksApi.get(taskId) as TaskWithRun;
        const steps = (data.run?.steps ?? []) as RunStep[];
        const reply = TERMINAL_STATUSES.includes(data.status) ? extractReply(steps, "") : "";

        updateMessage(sessionId, localId, {
          status: data.status as ChatMessage["status"],
          steps,
          costUsd: data.run?.costUsd ?? 0,
          text: reply,
        });

        if (TERMINAL_STATUSES.includes(data.status)) {
          clearInterval(interval);
          pollMap.current.delete(localId);
        }
      } catch {
        // polling failure — keep trying
      }
    }, POLL_INTERVAL_MS);

    pollMap.current.set(localId, interval);
  }

  async function handleNewChat() {
    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;
    const session = await chatSessionsApi.create(selectedEmpId, "New chat");
    setSessions((prev) => ({ ...prev, [selectedEmpId]: [session, ...(prev[selectedEmpId] ?? [])] }));
    setActiveSessionId(session.id);
    setMessages((prev) => ({ ...prev, [session.id]: [] }));
    setLoadedSessions((prev) => new Set([...prev, session.id]));
  }

  async function handleSend() {
    if (!input.trim() || !selectedEmpId || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) { setSending(false); return; }

    // Ensure we have a session
    let sessionId = activeSessionId;
    if (!sessionId) {
      try {
        const newSession = await chatSessionsApi.create(selectedEmpId, text.slice(0, 60));
        setSessions((prev) => ({ ...prev, [selectedEmpId]: [newSession, ...(prev[selectedEmpId] ?? [])] }));
        setActiveSessionId(newSession.id);
        setMessages((prev) => ({ ...prev, [newSession.id]: [] }));
        setLoadedSessions((prev) => new Set([...prev, newSession.id]));
        sessionId = newSession.id;
      } catch (err) {
        setSending(false);
        return;
      }
    }

    const localId = `local_${Date.now()}`;
    const now = new Date().toISOString();

    // Optimistically add user + assistant messages
    const userMsg: ChatMessage = {
      id: `user_${localId}`,
      taskId: null,
      role: "user",
      text,
      status: "sending",
      steps: [],
      costUsd: 0,
      employeeName: emp.displayName,
      createdAt: now,
    };
    const assistantMsg: ChatMessage = {
      id: localId,
      taskId: null,
      role: "assistant",
      text: "",
      status: "sending",
      steps: [],
      costUsd: 0,
      employeeName: emp.displayName,
      createdAt: now,
    };

    const capturedSessionId = sessionId;

    setMessages((prev) => ({
      ...prev,
      [capturedSessionId]: [...(prev[capturedSessionId] ?? []), userMsg, assistantMsg],
    }));

    try {
      const task = await tasksApi.create({
        assignedToEmployeeId: selectedEmpId,
        title: text,
        description: "",
        chatSessionId: capturedSessionId,
      });

      // Attach task id to both messages
      setMessages((prev) => ({
        ...prev,
        [capturedSessionId]: (prev[capturedSessionId] ?? []).map((m) =>
          (m.id === localId || m.id === `user_${localId}`)
            ? { ...m, taskId: task.id, status: m.role === "assistant" ? "running" : m.status }
            : m
        ),
      }));

      // Update session title if it's "New chat" (use first message text)
      const empSessions = sessions[selectedEmpId] ?? [];
      const currentSession = empSessions.find((s) => s.id === capturedSessionId);
      if (currentSession && currentSession.title === "New chat") {
        const newTitle = text.slice(0, 60);
        setSessions((prev) => ({
          ...prev,
          [selectedEmpId]: (prev[selectedEmpId] ?? []).map((s) =>
            s.id === capturedSessionId ? { ...s, title: newTitle, updatedAt: new Date().toISOString() } : s
          ),
        }));
      } else {
        // Still bump updatedAt in state
        setSessions((prev) => ({
          ...prev,
          [selectedEmpId]: (prev[selectedEmpId] ?? []).map((s) =>
            s.id === capturedSessionId ? { ...s, updatedAt: new Date().toISOString() } : s
          ),
        }));
      }

      startPolling(capturedSessionId, localId, task.id);
    } catch (err) {
      updateMessage(capturedSessionId, localId, {
        status: "stopped",
        text: (err as Error).message,
      });
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleApprove(msg: ChatMessage) {
    if (!msg.taskId || !activeSessionId) return;
    try {
      const rows = await approvalsApi.list();
      const match = rows.find((r) => r.task.id === msg.taskId);
      if (match) {
        await approvalsApi.approve(match.approval.id);
        startPolling(activeSessionId, msg.id, msg.taskId);
      }
    } catch { /* ignore */ }
  }

  async function handleReject(msg: ChatMessage) {
    if (!msg.taskId || !activeSessionId) return;
    try {
      const rows = await approvalsApi.list();
      const match = rows.find((r) => r.task.id === msg.taskId);
      if (match) {
        await approvalsApi.reject(match.approval.id);
        startPolling(activeSessionId, msg.id, msg.taskId);
      }
    } catch { /* ignore */ }
  }

  async function handleStop(msg: ChatMessage) {
    if (!msg.taskId || !activeSessionId) return;
    try {
      await tasksApi.stop(msg.taskId);
      const interval = pollMap.current.get(msg.id);
      if (interval) clearInterval(interval);
      pollMap.current.delete(msg.id);
      updateMessage(activeSessionId, msg.id, { status: "stopped" });
    } catch { /* ignore */ }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, fontSize: 14, color: C.inkMuted }}>
          Loading…
        </div>
      </AppShell>
    );
  }

  if (employees.length === 0) {
    return (
      <AppShell>
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 16, padding: 48, color: C.inkMuted, textAlign: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            background: C.surfaceSunken, border: `1px solid ${C.line}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MessageSquare size={24} strokeWidth={1.25} color={C.icon} />
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: C.ink, margin: "0 0 6px" }}>No active employees</p>
            <p style={{ fontSize: 14, color: C.inkMuted, margin: 0 }}>Hire your first AI employee to start chatting.</p>
          </div>
          <button
            onClick={() => navigate("/hire")}
            style={{
              height: 38, padding: "0 20px",
              background: C.brand, border: "none", borderRadius: 8,
              fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer",
            }}
          >
            Hire an employee
          </button>
        </div>
      </AppShell>
    );
  }

  const selectedEmp = employees.find((e) => e.id === selectedEmpId);

  return (
    <AppShell>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        flex: 1, display: "flex", overflow: "hidden",
        minHeight: 0,
      }}>

        {/* Left sidebar — employee tabs + session list */}
        <ConvSidebar
          employees={employees}
          selectedEmpId={selectedEmpId}
          onSelect={(id) => {
            setSelectedEmpId(id);
            setActiveSessionId(null);
          }}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={(sessionId) => setActiveSessionId(sessionId)}
          onNewChat={handleNewChat}
        />

        {/* Right — conversation pane */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          overflow: "hidden", background: C.surfaceSubtle,
        }}>

          {/* Slim header — employee name + profile link */}
          {selectedEmp && (
            <div style={{
              background: C.surface, borderBottom: `1px solid ${C.line}`,
              padding: "10px 20px",
              display: "flex", alignItems: "center", gap: 10,
              flexShrink: 0,
            }}>
              <EmpAvatar name={selectedEmp.displayName} size={28} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{selectedEmp.displayName}</span>
              <span style={{ fontSize: 12, color: C.inkMuted }}>·</span>
              <span style={{ fontSize: 12, color: C.inkMuted }}>{selectedEmp.roleDescription.split(/[,—]/)[0].trim()}</span>
              {activeSessionId && (
                <>
                  <span style={{ fontSize: 12, color: C.inkMuted }}>·</span>
                  <span style={{ fontSize: 12, color: C.inkMuted }}>
                    {(sessions[selectedEmpId] ?? []).find((s) => s.id === activeSessionId)?.title ?? "Chat"}
                  </span>
                </>
              )}
              <a
                href={`/team/${selectedEmp.id}`}
                style={{
                  marginLeft: "auto", height: 28, padding: "0 10px",
                  background: "transparent", border: `1px solid ${C.line}`,
                  borderRadius: 7, fontSize: 12, fontWeight: 500,
                  color: C.inkSecondary, textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}
              >
                Profile
                <ExternalLink size={11} strokeWidth={1.75} />
              </a>
            </div>
          )}

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", minHeight: 0,
            padding: "24px 28px",
            display: "flex", flexDirection: "column", gap: 24,
          }}>

            {currentMessages.length === 0 && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 12, padding: "80px 24px",
                color: C.inkMuted, textAlign: "center",
              }}>
                {!activeSessionId ? (
                  <>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: C.surfaceSunken, border: `1px solid ${C.line}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <MessageSquare size={20} strokeWidth={1.25} color={C.icon} />
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 500, color: C.ink, margin: 0 }}>
                      Start a new conversation
                    </p>
                    <p style={{ fontSize: 13, color: C.inkMuted, margin: 0 }}>
                      Click "New Chat" or send a message to begin.
                    </p>
                  </>
                ) : selectedEmp ? (
                  <>
                    <EmpAvatar name={selectedEmp.displayName} size={56} />
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 600, color: C.ink, margin: "0 0 6px" }}>
                        Chat with {selectedEmp.displayName}
                      </p>
                      <p style={{ fontSize: 13, color: C.inkMuted, margin: 0, maxWidth: 320 }}>
                        {selectedEmp.roleDescription}
                      </p>
                    </div>
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 8,
                      justifyContent: "center", maxWidth: 480,
                    }}>
                      {[
                        "Check my emails and summarise what needs action",
                        "Schedule a meeting for tomorrow at 2pm",
                        "What's on my calendar today?",
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                          style={{
                            padding: "7px 14px",
                            background: C.surface, border: `1px solid ${C.line}`,
                            borderRadius: 20, fontSize: 13, color: C.inkSecondary,
                            cursor: "pointer", transition: "border-color 120ms",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = C.brand}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = C.line}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {currentMessages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} ref={(el) => { if (el) msgRefs.current.set(msg.id, el); else msgRefs.current.delete(msg.id); }}>
                  <UserBubble text={msg.text} time={timeAgo(msg.createdAt)} />
                </div>
              ) : (
                <div key={msg.id} ref={(el) => { if (el) msgRefs.current.set(msg.id, el); else msgRefs.current.delete(msg.id); }}>
                  <AssistantBubble
                    msg={msg}
                    onApprove={() => handleApprove(msg)}
                    onReject={() => handleReject(msg)}
                    onStop={() => handleStop(msg)}
                  />
                </div>
              )
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div style={{
            background: C.surface, borderTop: `1px solid ${C.line}`,
            padding: "12px 20px",
            flexShrink: 0,
          }}>
            {/* Hint row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Clock size={12} strokeWidth={1.75} color={C.icon} />
              <span style={{ fontSize: 12, color: C.inkMuted }}>Tasks run in the background</span>
            </div>

            {/* Text input */}
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 10,
              background: C.surface, border: `1px solid ${C.lineStrong}`,
              borderRadius: 12, padding: "8px 12px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedEmp ? `Message ${selectedEmp.displayName}…` : "Select an employee…"}
                rows={1}
                style={{
                  flex: 1, border: "none", outline: "none", resize: "none",
                  fontSize: 14, color: C.ink, background: "transparent",
                  lineHeight: "22px", fontFamily: "inherit",
                  maxHeight: 120, overflowY: "auto",
                }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim() || !selectedEmpId}
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: (sending || !input.trim()) ? C.surfaceSunken : C.brand,
                  border: "none", cursor: (sending || !input.trim()) ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "background 120ms",
                }}
              >
                {sending
                  ? <Loader2 size={16} strokeWidth={1.75} color={C.icon} style={{ animation: "spin 1s linear infinite" }} />
                  : <Send size={16} strokeWidth={1.75} color={(sending || !input.trim()) ? C.icon : "#fff"} />
                }
              </button>
            </div>
            <p style={{ fontSize: 11, color: C.inkMuted, margin: "6px 0 0", textAlign: "center" }}>
              Press <kbd style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 10, background: C.surfaceSunken, padding: "1px 5px", borderRadius: 4, border: `1px solid ${C.line}` }}>Enter</kbd> to send · <kbd style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 10, background: C.surfaceSunken, padding: "1px 5px", borderRadius: 4, border: `1px solid ${C.line}` }}>Shift+Enter</kbd> for new line
            </p>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
