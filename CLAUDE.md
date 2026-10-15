# Staffroom — AI Workforce for Small Business

## Project overview

Staffroom lets small business owners hire AI employees that run autonomously, use real SaaS tools (Gmail, Google Calendar, Slack), ask for approval before taking write actions, and learn from their work over time.

## Monorepo structure

```
apps/
  api/          Hono backend (Node.js, TypeScript)
  web/          React + Vite SPA frontend
packages/
  db/           Drizzle ORM schema + migrations (PostgreSQL)
  llm/          Unified LLM gateway (Anthropic, DeepSeek, Ollama)
  types/        Shared TypeScript types
docs/
  AGENT_ORCHESTRATION.md   Complete agent system architecture diagram
```

## Tech stack

- **Frontend:** React + Vite, TypeScript, React Router, shadcn/ui, Tailwind CSS
- **Backend:** Hono (Node.js), Drizzle ORM, PostgreSQL, Zod validation
- **LLM:** Anthropic (Claude), DeepSeek, Ollama — unified via `packages/llm`
- **MCP:** `@modelcontextprotocol/sdk` StreamableHTTP transport — Gmail, Google Calendar, Slack
- **Auth:** JWT (`jose`), bcrypt
- **Package manager:** pnpm workspaces

## Commands

```bash
pnpm dev          # start all apps (api + web)
pnpm db:migrate   # run Drizzle migrations
pnpm db:studio    # open Drizzle Studio
pnpm exec tsc --noEmit   # type-check (run from root)
```

## Agent orchestration

See `docs/AGENT_ORCHESTRATION.md` for the full architecture.

Key points:
- `runner.ts` — entry point; loads task/employee/business, routes to supervisor or employee
- `loop.ts` — shared agentic loop for both agent types
- `employee.ts` — executes tasks using MCP tool grants from DB
- `supervisor.ts` — plans + delegates to employees via `spawn_task`
- `memory.ts` — 3-tier memory: business_memories, team_memories, personal memories
- `prompts.ts` — returns `SystemPromptParts { static, dynamic }` for prompt caching
- `mcp/` — auth registry, client, tool discovery, employee-tool execution

Anthropic prompt caching is enabled in `loop.ts`: static system prompt prefix is cached with `cache_control: { type: "ephemeral" }`, dynamic suffix is appended uncached. ~90% input token saving on cache hits.

## Frontend structure

```
src/
  pages/       Office, Board, Team, EmployeeProfile, TaskRunView,
               Approvals, Hire, Connectors, Settings, Login, Signup
  components/  AppShell (sidebar + topbar + PageHeader), ToolAccessPicker
  lib/api.ts   All API calls — auth, employeesApi, tasksApi, approvalsApi,
               connectorsApi, settingsApi, toolGrantsApi, businessMemoriesApi
  store/auth   Zustand auth store (token, userId, businessId)
```

## API routes

All under `/api`:
- `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
- `GET|POST|PATCH|DELETE /employees`, `GET /employees/:id/tool-grants`, `PUT /employees/:id/tool-grants`
- `GET|POST|PATCH|DELETE /tasks`, `POST /tasks/:id/stop`
- `GET|POST /approvals/:id/approve`, `POST /approvals/:id/reject`
- `GET|DELETE /connectors`, `GET /connectors/:provider/tools`, `POST /connectors/:provider/tools/refresh`
- `GET|PATCH /settings`, `POST /settings/test-llm`
- `GET|POST|PATCH|DELETE /business-memories`, `/team-memories`, `/employees/:id/memories`

## UI design system

See `staffroom-ui-rules.md` for the full spec. Key rules:

- **White-first** surfaces. Sidebar is deep petrol (`#0b2530`). One amber accent (`#f2a93b`) for "waiting for you" only.
- **No decorative animation.** Only `120ms` transitions on color/background/border. No gradients, glassmorphism, or glow.
- **CSS variables only** — never hardcode hex values in components. Full token list in `staffroom-ui-rules.md §11`.
- **Icons:** Lucide, outline, `strokeWidth={1.75}`, sizes 14/16/20/24px only.
- **Type scale:** Plus Jakarta Sans (UI) + JetBrains Mono (costs, IDs, tool names). Fixed sizes only — 11/12/13/14/15/16/18/24/28/30px.
- **Page skeleton:** AppShell → PageHeader (breadcrumbs + h1 + action) → 4 KPI stat cards → body grid of cards.
- **One primary button per view.** Primary = `#0f5b6c`.
- **Always implement:** loader, breadcrumbs, empty state, error state, disabled state.

## DB schema key tables

```
businesses          llmProvider, llmModel, ollamaBaseUrl, demoMode
employees           isManager, integrations, instructionsJson, budgetMonthlyUsd, budgetUsedUsd
tasks               status, parentTaskId, assignedToEmployeeId
runs                steps (jsonb), totalTokens, costUsd, durationMs
approvals           actionType, payloadJson, status, idempotencyKey, expiresAt
memories            employeeId, kind, content, source
business_memories   businessId, kind (policy|brand_voice|company_fact|sop), content
team_memories       businessId, authorEmployeeId, taskId, kind, content
connector_accounts  businessId, provider, accessToken, refreshToken, expiresAt
connector_tools     businessId, provider, toolName, description, inputSchema
employee_tool_grants employeeId, businessId, provider, toolName, revokedAt
```

## Conventions

- IDs use `newId("prefix")` — e.g. `newId("emp")`, `newId("task")`, `newId("apr")`
- All API responses: `{ ok: true, data: T }` or `{ ok: false, error: string }`
- Task statuses: `queued | running | waiting_approval | done | stopped | stale`
- Memory kinds: `instruction | preference | correction | episodic | learned`
- MCP tools require `readOnlyHint` annotation; write tools auto-trigger approval gate
- Supervisor always uses `claude-sonnet-4-6`; employees use business-configured model (default Haiku)

## What NOT to do

- Do not add animations, gradients, or glassmorphism to the UI
- Do not hardcode hex values — use CSS variables
- Do not use `read_memory` tool (removed — memories are loaded at agent startup)
- Do not bypass the approval gate for non-read-only MCP tools
- Do not use `git push --force` or amend published commits
