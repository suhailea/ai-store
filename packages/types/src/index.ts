// ─── Enums ────────────────────────────────────────────────────────────────────

export type HumanRole = "owner" | "admin" | "viewer";

export type EmployeeStatus = "active" | "paused" | "fired";

export type Integration =
  | "gmail"
  | "gcal"
  | "drive"
  | "crm"
  | "upload"
  | "internal"
  | "slack";

export type TaskStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "done"
  | "stopped"
  | "stale";

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export type MemoryKind = "instruction" | "preference" | "correction" | "episodic" | "learned";
export type MemorySource = "onboarding" | "hiring" | "agent_self" | "supervisor_correction" | "task_outcome";
export type BusinessMemoryKind = "policy" | "brand_voice" | "company_fact" | "sop";
export type TeamMemoryKind = "briefing" | "delegation_note" | "outcome_summary";

// ─── Core entities ────────────────────────────────────────────────────────────

export interface Business {
  id: string;
  name: string;
  industry: string;
  teamSize: number;
  ownerUserId: string;
  demoMode: boolean;
  createdAt: string;
}

export interface HumanUser {
  id: string;
  businessId: string;
  email: string;
  name: string;
  role: HumanRole;
  createdAt: string;
}

export interface Employee {
  id: string;
  businessId: string;
  displayName: string;
  roleDescription: string;
  integrations: Integration[];
  status: EmployeeStatus;
  budgetMonthlyUsd: number;
  budgetUsedUsd: number;
  instructionsJson: Record<string, string>;
  isManager: boolean;
  llmProvider: string | null;
  llmModel: string | null;
  createdAt: string;
}

export interface Badge {
  id: string;
  employeeId: string;
  integration: Integration;
  grantedAt: string;
  revokedAt: string | null;
}

export interface Task {
  id: string;
  businessId: string;
  assignedToEmployeeId: string;
  createdByHumanId: string | null;
  createdByTaskId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  costUsd: number;
  parentTaskId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface RunStep {
  type: "thought" | "tool_call" | "tool_result" | "final";
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  costUsd?: number;
  durationMs?: number;
  timestamp: string;
}

export interface Run {
  id: string;
  taskId: string;
  steps: RunStep[];
  totalTokens: number;
  costUsd: number;
  durationMs: number;
  createdAt: string;
}

export interface Approval {
  id: string;
  taskId: string;
  runId: string;
  employeeId: string;
  actionType: string;
  payloadJson: Record<string, unknown>;
  reason: string;
  status: ApprovalStatus;
  idempotencyKey: string;
  expiresAt: string;
  executedAt: string | null;
  reviewerNote: string | null;
  createdAt: string;
}

export interface Memory {
  id: string;
  employeeId: string;
  kind: MemoryKind;
  content: string;
  source: string;
  createdAt: string;
}

export interface BusinessMemory {
  id: string;
  businessId: string;
  kind: BusinessMemoryKind;
  content: string;
  source: string;
  createdAt: string;
}

export interface TeamMemory {
  id: string;
  businessId: string;
  authorEmployeeId: string | null;
  taskId: string | null;
  kind: TeamMemoryKind;
  content: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  businessId: string;
  actorType: "human" | "employee";
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
}

export type ConnectorProvider =
  | "gmail"
  | "outlook"
  | "google_calendar"
  | "outlook_calendar"
  | "slack";

export interface ConnectorAccount {
  id: string;
  businessId: string;
  provider: ConnectorProvider;
  accountEmail: string | null;
  scopes: string | null;
  connectedAt: string;
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
