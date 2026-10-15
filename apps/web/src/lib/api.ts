import type { ApiResponse, Employee, Task, Approval, Memory, BusinessMemory, TeamMemory } from "@staffroom/types";

const BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

function getToken() {
  return localStorage.getItem("staffroom_token");
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  signup: (data: {
    email: string;
    password: string;
    name: string;
    businessName: string;
    industry: string;
    teamSize: number;
  }) => req<{ token: string; userId: string; businessId: string }>("POST", "/auth/signup", data),

  login: (email: string, password: string) =>
    req<{ token: string; userId: string; businessId: string }>("POST", "/auth/login", { email, password }),

  demo: () =>
    req<{ token: string; userId: string; businessId: string; demo: boolean }>("POST", "/auth/demo"),

  me: () =>
    req<{
      user: { id: string; name: string; email: string; role: string };
      business: { id: string; name: string; industry: string; demoMode: boolean };
    }>("GET", "/auth/me"),
};

// ─── Employees ────────────────────────────────────────────────────────────────

export interface ToolGrant {
  provider: string;
  toolName: string;
}

export interface ConnectorTool extends ToolGrant {
  id: string;
  description: string;
  inputSchema: Record<string, unknown>;
  discoveredAt: string;
}

export const employeesApi = {
  list: () => req<Employee[]>("GET", "/employees"),

  hire: (data: {
    displayName: string;
    roleDescription: string;
    integrations: string[];
    budgetMonthlyUsd: number;
    isManager: boolean;
    instructions: Record<string, string>;
    toolGrants?: ToolGrant[];
    llmProvider?: string | null;
    llmModel?: string | null;
  }) => req<Employee>("POST", "/employees", data),

  get: (id: string) => req<Employee>("GET", `/employees/${id}`),

  update: (id: string, data: Partial<Employee>) =>
    req<Employee>("PATCH", `/employees/${id}`, data),

  fire: (id: string) => req<null>("DELETE", `/employees/${id}`),

  saveOnboarding: (id: string, answers: Record<string, string>) =>
    req<{ saved: number }>("POST", `/employees/${id}/onboarding`, { answers }),

  memories: (id: string) => req<Memory[]>("GET", `/employees/${id}/memories`),
  createMemory: (id: string, body: Pick<Memory, "kind" | "content">) => req<Memory>("POST", `/employees/${id}/memories`, body),
  updateMemory: (id: string, memoryId: string, body: Partial<Pick<Memory, "kind" | "content">>) => req<Memory>("PATCH", `/employees/${id}/memories/${memoryId}`, body),
  deleteMemory: (id: string, memoryId: string) => req<null>("DELETE", `/employees/${id}/memories/${memoryId}`),

  grantBadge: (id: string, integration: string) =>
    req<unknown>("POST", `/employees/${id}/badges`, { integration }),

  revokeBadge: (id: string, badgeId: string) =>
    req<null>("DELETE", `/employees/${id}/badges/${badgeId}`),
};

export const businessMemoriesApi = {
  list: () => req<BusinessMemory[]>("GET", "/business-memories"),
  create: (body: Pick<BusinessMemory, "kind" | "content">) => req<BusinessMemory>("POST", "/business-memories", body),
  update: (id: string, body: Partial<Pick<BusinessMemory, "kind" | "content">>) => req<BusinessMemory>("PATCH", `/business-memories/${id}`, body),
  delete: (id: string) => req<null>("DELETE", `/business-memories/${id}`),
};

export const teamMemoriesApi = {
  list: () => req<TeamMemory[]>("GET", "/team-memories"),
  create: (body: Pick<TeamMemory, "kind" | "content"> & { taskId?: string | null }) => req<TeamMemory>("POST", "/team-memories", body),
  update: (id: string, body: Partial<Pick<TeamMemory, "kind" | "content" | "taskId">>) => req<TeamMemory>("PATCH", `/team-memories/${id}`, body),
  delete: (id: string) => req<null>("DELETE", `/team-memories/${id}`),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasksApi = {
  list: () => req<Task[]>("GET", "/tasks"),

  create: (data: { assignedToEmployeeId: string; title: string; description?: string; chatSessionId?: string }) =>
    req<Task>("POST", "/tasks", data),

  get: (id: string) => req<Task & { run: unknown }>("GET", `/tasks/${id}`),

  stop: (id: string) => req<null>("POST", `/tasks/${id}/stop`),

  run: (id: string) => req<unknown[]>("GET", `/tasks/${id}/run`),

  history: (employeeId: string, limit = 50) =>
    req<(Task & { run: { steps: unknown[]; costUsd: number; totalTokens: number; durationMs: number } | null })[]>(
      "GET", `/tasks/history?employeeId=${employeeId}&limit=${limit}`
    ),
};

// ─── Connectors ───────────────────────────────────────────────────────────────

export const connectorsApi = {
  list: () => req<{ id: string; provider: string; accountEmail: string | null; scopes: string | null; connectedAt: string }[]>("GET", "/connectors"),

  disconnect: (id: string) => req<null>("DELETE", `/connectors/${id}`),

  tools: (provider: string) =>
    req<ConnectorTool[]>("GET", `/connectors/${encodeURIComponent(provider)}/tools`),

  refreshTools: (provider: string) =>
    req<{ discovered: number }>("POST", `/connectors/${encodeURIComponent(provider)}/tools/refresh`),

  // Returns the OAuth redirect URL — browser navigates directly to this (token passed as query param since headers can't be set)
  connectUrl: (provider: string) => {
    const token = localStorage.getItem("staffroom_token");
    return `${BASE}/connectors/${provider}/connect${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  },

  connectPostgres: (connectionString: string) =>
    req<{ id: string; accountEmail: string }>("POST", "/connectors/postgres/connect", { connectionString }),

  connectExcel: async (file: File): Promise<{ accountEmail: string }> => {
    const token = localStorage.getItem("staffroom_token");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/connectors/excel/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const json = (await res.json()) as ApiResponse<{ accountEmail: string }>;
    if (!json.ok) throw new Error(json.error);
    return json.data;
  },
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settingsApi = {
  get: () =>
    req<{ llmProvider: string; llmModel: string; ollamaBaseUrl: string | null; name: string; industry: string }>(
      "GET", "/settings"
    ),

  update: (data: { llmProvider?: string; llmModel?: string; ollamaBaseUrl?: string | null }) =>
    req<null>("PATCH", "/settings", data),

  testLlm: (data: { provider: string; model: string; apiKey?: string; baseUrl?: string }) =>
    req<{ success: boolean; latencyMs: number; error?: string }>("POST", "/settings/test-llm", data),
};

export const toolGrantsApi = {
  list: (employeeId: string) =>
    req<{ provider: string; toolName: string }[]>("GET", `/employees/${employeeId}/tool-grants`),

  save: (employeeId: string, grants: { provider: string; toolName: string }[]) =>
    req<null>("PUT", `/employees/${employeeId}/tool-grants`, { grants }),
};

// ─── Approvals ────────────────────────────────────────────────────────────────

export const approvalsApi = {
  list: () =>
    req<{ approval: Approval; employee: Employee; task: Task }[]>("GET", "/approvals"),

  approve: (id: string, editedPayload?: Record<string, unknown>) =>
    req<null>("POST", `/approvals/${id}/approve`, editedPayload ? { editedPayload } : {}),

  reject: (id: string, note?: string) =>
    req<null>("POST", `/approvals/${id}/reject`, { note }),
};

// ─── Workflows ────────────────────────────────────────────────────────────────

export interface Workflow {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  triggerType: "schedule" | "webhook" | "email_received" | "slack_message";
  triggerConfig: Record<string, unknown>;
  assignedToEmployeeId: string;
  taskTitleTemplate: string;
  taskDescriptionTemplate: string;
  enabled: boolean;
  lastFiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  taskId?: string | null;
  status: "triggered" | "task_created" | "failed";
  contextData?: Record<string, unknown> | null;
  error?: string | null;
  createdAt: string;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  triggerType: "schedule" | "webhook" | "email_received" | "slack_message";
  triggerConfig: Record<string, unknown>;
  assignedToEmployeeId: string;
  taskTitleTemplate: string;
  taskDescriptionTemplate: string;
  enabled?: boolean;
}

export const workflowsApi = {
  list: () => req<Workflow[]>("GET", "/workflows"),
  create: (data: CreateWorkflowInput) => req<Workflow>("POST", "/workflows", data),
  get: (id: string) => req<Workflow>("GET", `/workflows/${id}`),
  update: (id: string, data: Partial<CreateWorkflowInput>) => req<Workflow>("PATCH", `/workflows/${id}`, data),
  delete: (id: string) => req<null>("DELETE", `/workflows/${id}`),
  runs: (id: string) => req<WorkflowRun[]>("GET", `/workflows/${id}/runs`),
  fire: (id: string) => req<null>("POST", `/workflows/${id}/fire`),
};

// ─── Chat Sessions ─────────────────────────────────────────────────────────────

export interface ChatSession {
  id: string;
  employeeId: string;
  title: string;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

export const chatSessionsApi = {
  list: (employeeId: string) => req<ChatSession[]>("GET", `/chat-sessions?employeeId=${employeeId}`),
  create: (employeeId: string, title?: string) => req<ChatSession>("POST", "/chat-sessions", { employeeId, title }),
  delete: (sessionId: string) => req<null>("DELETE", `/chat-sessions/${sessionId}`),
  tasks: (sessionId: string) => req<unknown[]>("GET", `/chat-sessions/${sessionId}/tasks`),
};
