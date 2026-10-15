import {
  pgTable,
  text,
  boolean,
  integer,
  real,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const humanRoleEnum = pgEnum("human_role", ["owner", "admin", "viewer"]);
export const employeeStatusEnum = pgEnum("employee_status", ["active", "paused", "fired"]);
export const integrationEnum = pgEnum("integration", ["gmail", "gcal", "drive", "crm", "upload", "internal", "slack", "google_drive", "google_sheets", "postgres", "excel"]);
export const taskStatusEnum = pgEnum("task_status", ["queued", "running", "waiting_approval", "done", "stopped", "stale"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected", "expired"]);
export const memoryKindEnum = pgEnum("memory_kind", ["instruction", "preference", "correction", "episodic", "learned"]);
export const businessMemoryKindEnum = pgEnum("business_memory_kind", ["policy", "brand_voice", "company_fact", "sop"]);
export const teamMemoryKindEnum = pgEnum("team_memory_kind", ["briefing", "delegation_note", "outcome_summary"]);
export const actorTypeEnum = pgEnum("actor_type", ["human", "employee"]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const businesses = pgTable("businesses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  teamSize: integer("team_size").notNull().default(1),
  ownerUserId: text("owner_user_id").notNull(),
  demoMode: boolean("demo_mode").notNull().default(false),
  // LLM gateway config — owner sets this in Settings
  llmProvider: text("llm_provider").notNull().default("anthropic"),
  llmModel: text("llm_model").notNull().default("claude-haiku-4-5-20251001"),
  ollamaBaseUrl: text("ollama_base_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const humanUsers = pgTable("human_users", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: humanRoleEnum("role").notNull().default("owner"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const employees = pgTable("employees", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  roleDescription: text("role_description").notNull(),
  integrations: integrationEnum("integrations").array().notNull().default([]),
  status: employeeStatusEnum("status").notNull().default("active"),
  budgetMonthlyUsd: real("budget_monthly_usd").notNull().default(10),
  budgetUsedUsd: real("budget_used_usd").notNull().default(0),
  instructionsJson: jsonb("instructions_json").notNull().default({}),
  isManager: boolean("is_manager").notNull().default(false),
  // Per-employee model override — null means use the business default
  llmProvider: text("llm_provider"),
  llmModel: text("llm_model"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const badges = pgTable("badges", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  integration: integrationEnum("integration").notNull(),
  oauthTokenRef: text("oauth_token_ref"),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

export const chatSessions = pgTable("chat_sessions", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  employeeId: text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  createdByHumanId: text("created_by_human_id").references(() => humanUsers.id),
  title: text("title").notNull().default("New chat"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const workflows = pgTable("workflows", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type").notNull(), // "schedule" | "webhook" | "email_received" | "slack_message"
  triggerConfig: jsonb("trigger_config").notNull().$type<Record<string, unknown>>(),
  assignedToEmployeeId: text("assigned_to_employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  taskTitleTemplate: text("task_title_template").notNull(),
  taskDescriptionTemplate: text("task_description_template").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastFiredAt: timestamp("last_fired_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  assignedToEmployeeId: text("assigned_to_employee_id").notNull().references(() => employees.id),
  createdByHumanId: text("created_by_human_id").references(() => humanUsers.id),
  createdByTaskId: text("created_by_task_id"),
  parentTaskId: text("parent_task_id"),
  chatSessionId: text("chat_session_id"),
  createdByWorkflowId: text("created_by_workflow_id").references(() => workflows.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: taskStatusEnum("status").notNull().default("queued"),
  costUsd: real("cost_usd").notNull().default(0),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workflowRuns = pgTable("workflow_runs", {
  id: text("id").primaryKey(),
  workflowId: text("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  taskId: text("task_id").references(() => tasks.id),
  status: text("status").notNull(), // "triggered" | "task_created" | "failed"
  contextData: jsonb("context_data").$type<Record<string, unknown>>(),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  steps: jsonb("steps").notNull().default([]),
  totalTokens: integer("total_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  // Checkpoint: serialized LLM message history saved when pausing for approval.
  // Null = fresh run (no checkpoint). Non-null = resume from this point.
  messagesJson: jsonb("messages_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  runId: text("run_id").notNull().references(() => runs.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  actionType: text("action_type").notNull(),
  payloadJson: jsonb("payload_json").notNull().default({}),
  reason: text("reason").notNull().default(""),
  status: approvalStatusEnum("status").notNull().default("pending"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  executedAt: timestamp("executed_at"),
  reviewerNote: text("reviewer_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const memories = pgTable("memories", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  kind: memoryKindEnum("kind").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull().default("onboarding"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({ employeeCreated: index("memories_employee_created_idx").on(table.employeeId, table.createdAt) }));

export const businessMemories = pgTable("business_memories", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  kind: businessMemoryKindEnum("kind").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull().default("owner"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({ businessCreated: index("business_memories_business_created_idx").on(table.businessId, table.createdAt) }));

export const teamMemories = pgTable("team_memories", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  authorEmployeeId: text("author_employee_id").references(() => employees.id, { onDelete: "set null" }),
  // Null is a business-wide briefing; a task ID restricts a delegation note
  // to that task and its descendants. Human authors have no employee ID.
  taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  kind: teamMemoryKindEnum("kind").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({ businessCreated: index("team_memories_business_created_idx").on(table.businessId, table.createdAt) }));

// ─── Connector accounts (business-level OAuth tokens) ─────────────────────────
// One row per connected provider per business.
// provider: "gmail" | "outlook" | "google_calendar" | "outlook_calendar" | "slack"

export const connectorAccounts = pgTable("connector_accounts", {
  id:           text("id").primaryKey(),
  businessId:   text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  provider:     text("provider").notNull(),          // e.g. "gmail", "slack"
  accountEmail: text("account_email"),               // the connected user's email/name
  accessToken:  text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenType:    text("token_type").notNull().default("Bearer"),
  expiresAt:    timestamp("expires_at"),
  scopes:       text("scopes"),                      // space-separated scope list
  connectedAt:  timestamp("connected_at").notNull().defaultNow(),
});

// ─── Connector tools (discovered from MCP server's tools/list) ────────────────
// One row per (businessId, provider, toolName). Upserted on each discovery run.
// inputSchema is stored verbatim from the MCP server and re-served to the LLM.

export const connectorTools = pgTable("connector_tools", {
  id:           text("id").primaryKey(),
  businessId:   text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  provider:     text("provider").notNull(),
  toolName:     text("tool_name").notNull(),
  description:  text("description").notNull().default(""),
  inputSchema:  jsonb("input_schema").notNull().default({}),
  discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
});

// ─── Employee tool grants (per-employee permission rows) ──────────────────────
// Active grant:  revokedAt IS NULL
// Revoked grant: revokedAt IS NOT NULL (kept for audit trail — never deleted)

export const employeeToolGrants = pgTable("employee_tool_grants", {
  id:          text("id").primaryKey(),
  employeeId:  text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  businessId:  text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  provider:    text("provider").notNull(),
  toolName:    text("tool_name").notNull(),
  grantedAt:   timestamp("granted_at").notNull().defaultNow(),
  revokedAt:   timestamp("revoked_at"),   // null = active
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  actorType: actorTypeEnum("actor_type").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const businessesRelations = relations(businesses, ({ many }) => ({
  humanUsers: many(humanUsers),
  employees: many(employees),
  tasks: many(tasks),
  auditLogs: many(auditLogs),
}));

export const humanUsersRelations = relations(humanUsers, ({ one }) => ({
  business: one(businesses, { fields: [humanUsers.businessId], references: [businesses.id] }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  business: one(businesses, { fields: [employees.businessId], references: [businesses.id] }),
  badges: many(badges),
  tasks: many(tasks),
  memories: many(memories),
  approvals: many(approvals),
  toolGrants: many(employeeToolGrants),
}));

export const connectorToolsRelations = relations(connectorTools, ({ one }) => ({
  business: one(businesses, { fields: [connectorTools.businessId], references: [businesses.id] }),
}));

export const employeeToolGrantsRelations = relations(employeeToolGrants, ({ one }) => ({
  employee: one(employees, { fields: [employeeToolGrants.employeeId], references: [employees.id] }),
  business: one(businesses, { fields: [employeeToolGrants.businessId], references: [businesses.id] }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  business: one(businesses, { fields: [tasks.businessId], references: [businesses.id] }),
  employee: one(employees, { fields: [tasks.assignedToEmployeeId], references: [employees.id] }),
  runs: many(runs),
  approvals: many(approvals),
}));

export const runsRelations = relations(runs, ({ one }) => ({
  task: one(tasks, { fields: [runs.taskId], references: [tasks.id] }),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  task: one(tasks, { fields: [approvals.taskId], references: [tasks.id] }),
  employee: one(employees, { fields: [approvals.employeeId], references: [employees.id] }),
}));
