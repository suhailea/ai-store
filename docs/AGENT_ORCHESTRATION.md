# Staffroom — Agent Orchestration Architecture

---

## Overview

```
Owner creates task
       │
       ▼
  runner.ts  ──── loads task + employee + business + llmConfig
       │
       ├── employee.isManager = true  ──▶  runAsSupervisor()
       │
       └── employee.isManager = false ──▶  runAsEmployee()
```

---

## Entry Point — `runner.ts`

```
startAgentRun(taskId)
  │
  ├── Load task from DB
  ├── Load employee (isManager, integrations, instructionsJson, businessId)
  ├── Load business (llmProvider, llmModel, ollamaBaseUrl, demoMode)
  ├── Check employee budget — abort if exceeded
  ├── Mark task status = "running"
  ├── Create run record (runs table)
  │
  ├── isManager = true  ──▶  runAsSupervisor({ task, employee, business, llmConfig, runId })
  └── isManager = false ──▶  runAsEmployee({ task, employee, business, llmConfig, runId })
```

---

## Memory Loading — `memory.ts`

Both supervisor and employee call `loadMemoryContext()` before building the system prompt.

```
loadMemoryContext({ employeeId, businessId, taskId })
  │
  ├── [1] businessMemories   SELECT from business_memories WHERE businessId  LIMIT 20
  ├── [2] teamMemories       SELECT from team_memories WHERE businessId
  │                            AND (taskId IS NULL OR taskId IN task_lineage)  LIMIT 5
  ├── [3] standing           SELECT from memories WHERE employeeId
  │                            AND kind IN (instruction, preference, correction)
  ├── [4] episodic           SELECT from memories WHERE employeeId AND kind = episodic  LIMIT 3
  └── [5] learned            SELECT from memories WHERE employeeId AND kind = learned   LIMIT 5

Returns: { businessMemories, teamMemories, memories: [...standing, ...episodic, ...learned] }
```

**Task lineage** — walks parentTaskId chain up to 20 levels so delegation_notes
from a supervisor are visible to all descendant employees.

---

## System Prompt — `prompts.ts`

Returns `SystemPromptParts { static, dynamic }` — two separate strings.

```
buildEmployeeSystemPrompt(data)               buildSupervisorSystemPrompt(data)
  │                                              │
  ├── static:                                    ├── static:
  │     [COMPANY CONTEXT]   businessMemories     │     [COMPANY CONTEXT]
  │     [TEAM BRIEFING]     teamMemories         │     [TEAM BRIEFING]
  │     [YOUR INSTRUCTIONS] instruction/correction│    [YOUR INSTRUCTIONS]
  │     [YOUR PREFERENCES]  preference            │    [YOUR PREFERENCES]
  │     [YOUR PAST WORK]    episodic (max 3)      │    [YOUR PAST WORK]
  │     [YOUR LEARNINGS]    learned (max 5)       │    [YOUR LEARNINGS]
  │     role + rules                              │    role + delegation rules
  │                                               │
  └── dynamic:                                   └── dynamic:
        [ONBOARDING CONTEXT] instructionsJson          [ONBOARDING CONTEXT]
```

---

## Prompt Caching

```
llm() call in loop.ts
  │
  ├── provider = "anthropic"
  │     system param → array:
  │       [0] { type:"text", text: static,  cache_control: { type:"ephemeral" } }  ← CACHED
  │       [1] { type:"text", text: dynamic }                                        ← uncached
  │
  └── provider = "deepseek" | "ollama"
        system param → single string: static + "\n\n" + dynamic
```

Cache TTL = 5 minutes (refreshed on each use). ~90% input token saving on static prefix.

---

## Employee Agent — `employee.ts`

```
runAsEmployee()
  │
  ├── loadMemoryContext()
  ├── buildEmployeeSystemPrompt()  → SystemPromptParts
  ├── buildEmployeeToolset(employeeId, businessId)
  │     └── reads employee_tool_grants JOIN connector_tools (active grants only)
  │         returns { tools: LLMTool[], bindings: Map<toolName, EmployeeToolBinding> }
  │
  └── runAgentLoop({ systemPrompt, tools, executeTool: executeEmployeeTool })
```

### `executeEmployeeTool` dispatch

```
LLM returns tool_use
       │
       ├── bindings.has(toolName)?  ──▶  executeGrantedMcpTool(binding, args, scope)
       │                                   │
       │                                   ├── re-validate grant in DB (revokedAt IS NULL)
       │                                   ├── getConnectorToken(businessId, provider)
       │                                   │     └── auto-refresh if expired
       │                                   ├── isMcpToolReadOnly(provider, token, toolName)?
       │                                   │     ├── YES → call MCP directly
       │                                   │     └── NO  → return { requiresApproval: true }
       │                                   │                 → auto-trigger create_approval_request
       │                                   └── callMcpTool(serverUrl, token, toolName, args)
       │                                         └── MCP HTTP (Streamable HTTP transport)
       │
       ├── "write_memory"           ──▶  writeAgentMemory(scope, { kind, content })
       │                                   └── INSERT memories (kind: episodic | learned, source: agent_self)
       │
       ├── "create_approval_request" ──▶ INSERT approvals + SET task status = waiting_approval
       │
       └── "finish"                 ──▶  SET task status = done
```

---

## Supervisor Agent — `supervisor.ts`

```
runAsSupervisor()
  │
  ├── loadMemoryContext()
  ├── buildSupervisorSystemPrompt()  → SystemPromptParts
  ├── tools = SUPERVISOR_TOOLS (static, never dynamic)
  ├── modelOverride = "claude-sonnet-4-6"  (always Sonnet regardless of business config)
  │
  └── runAgentLoop({ systemPrompt, tools, executeTool: executeSupervisorTool })
```

### `executeSupervisorTool` dispatch

```
LLM returns tool_use
       │
       ├── "think_and_plan"          ──▶  echo plan back (recorded in run steps trace)
       │
       ├── "list_employees"          ──▶  SELECT active employees WHERE businessId
       │                                   returns: id, displayName, roleDescription, integrations
       │
       ├── "spawn_task"              ──▶  INSERT tasks (parentTaskId = supervisor task)
       │                                   └── startAgentRun(subTaskId)  [fire-and-forget]
       │
       ├── "check_task_status"       ──▶  SELECT task status + recent steps + recent memories
       │
       ├── "write_memory"            ──▶  writeAgentMemory (own episodic/learned)
       ├── "write_team_memory"       ──▶  writeSupervisorTeamMemory → INSERT team_memories
       ├── "write_correction_memory" ──▶  writeSupervisorCorrection → INSERT memories
       │                                   (source: supervisor_correction, target: subordinate only)
       ├── "promote_employee_memory" ──▶  promoteEmployeeMemory → copy to team_memories
       │
       └── "finish"                  ──▶  SET task status = done
```

---

## Shared Loop — `loop.ts`

```
runAgentLoop()
  │
  ┌─────────────────────────────────────────────────────┐
  │  for i = 0..maxSteps (default 20):                  │
  │    │                                                 │
  │    ├── re-check task status  → break if terminal    │
  │    │                                                 │
  │    ├── llm({ system.static [cached], dynamic,       │
  │    │         tools, messages })                      │
  │    │                                                 │
  │    ├── extract text blocks  → push "thought" step   │
  │    ├── extract tool blocks                          │
  │    │                                                 │
  │    ├── stopReason = end_turn + no tools             │
  │    │     → SET task = done, break                   │
  │    │                                                 │
  │    ├── for each tool call:                          │
  │    │     ├── push tool_call step                    │
  │    │     ├── executeTool(name, input, ctx)          │
  │    │     ├── push tool_result step                  │
  │    │     ├── persist steps + tokens to runs table   │
  │    │     ├── update employee budgetUsedUsd           │
  │    │     └── re-check task status → break if done   │
  │    │                                                 │
  │    └── append tool results to messages              │
  │                                                     │
  │  } catch → SET task = stopped, rethrow             │
  │                                                     │
  │  } finally (always runs):                          │
  │    ├── persist final run (durationMs)              │
  │    ├── if task still running → SET status = stale  │
  │    └── recordTaskOutcome()                         │
  │          └── INSERT memories (kind: episodic,      │
  │                source: task_outcome, idempotent)   │
  └─────────────────────────────────────────────────────┘
```

---

## MCP Layer — `mcp/`

```
mcp/
  registry.ts      MCP_REGISTRY: { gmail, google_calendar, slack } → server URLs
  auth.ts          getConnectorToken(businessId, provider)
                     └── SELECT connector_accounts WHERE businessId + provider
                         → refresh if expired (Google OAuth2 / Slack no-refresh)
                         → persist refreshed token back to DB
  client.ts        callMcpTool({ serverUrl, accessToken, toolName, toolArgs })
                     └── StreamableHTTPClientTransport
                         → client.connect() → client.callTool() → client.close()
                     isMcpToolReadOnly(provider, token, toolName)
                         → client.listTools() → check annotations.readOnlyHint
  discovery.ts     discoverProviderTools(businessId, provider)
                     └── client.listTools() (paginated)
                         → upsert each tool into connector_tools table
                         → called fire-and-forget on OAuth callback
  gmail.ts         gmailListEmails / gmailGetEmail / gmailDraftEmail / gmailSendEmail
                     └── getConnectorToken() + callMcpTool()
                         injection guard on email body
  employee-tools.ts executeGrantedMcpTool(binding, args, scope, approved)
                     └── re-validate grant in DB
                         getConnectorToken()
                         isMcpToolReadOnly() → requiresApproval if false
                         callMcpTool()
```

---

## DB Tables Used by Agent System

```
businesses          llmProvider, llmModel, ollamaBaseUrl, demoMode
employees           isManager, integrations, instructionsJson, budgetMonthlyUsd, budgetUsedUsd
tasks               status, parentTaskId, createdByTaskId, assignedToEmployeeId
runs                steps (jsonb), totalTokens, costUsd, durationMs
approvals           actionType, payloadJson, status, idempotencyKey, expiresAt
memories            employeeId, kind, content, source
business_memories   businessId, kind (policy|brand_voice|company_fact|sop), content
team_memories       businessId, authorEmployeeId, taskId, kind, content
connector_accounts  businessId, provider, accessToken, refreshToken, expiresAt
connector_tools     businessId, provider, toolName, description, inputSchema
employee_tool_grants employeeId, businessId, provider, toolName, revokedAt
```

---

## Data Flow Summary

```
                        ┌─────────────────────────────────┐
                        │           OWNER (human)          │
                        │  creates task / approves actions │
                        └──────────────┬──────────────────┘
                                       │
                                  runner.ts
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                      │
             supervisor.ts                          employee.ts
             (Sonnet model)                        (Haiku model)
                    │                                      │
             SUPERVISOR_TOOLS                    buildEmployeeToolset()
          think_and_plan                          (from DB grants)
          list_employees                                   │
          spawn_task ──────────────────────────▶  employee.ts
          check_task_status                       (sub-task)
          write_team_memory                               │
          write_correction_memory              MCP tools (gmail, gcal, slack)
          promote_employee_memory              via executeGrantedMcpTool()
          write_memory                                     │
          finish                                     approval gate
                    │                            (non-read-only tools)
                    └──────────────────────────────────────┘
                                       │
                                  loop.ts
                              (shared for both)
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                      │
             LLM Gateway                           memory.ts
           packages/llm                        recordTaskOutcome()
       anthropic (cached)                      writeAgentMemory()
       deepseek / ollama
```
