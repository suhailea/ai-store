# Memory layer

Company policies and context, shared team briefings, and personal employee memories are persisted separately. Each query is scoped to the current business or a validated employee in that business.

## Prompt context

Employees and managers receive the newest 20 company memories first (ordered by creation time), followed by the latest five visible team memories, all personal instructions/corrections/preferences, the latest three episodic memories, the latest five learned observations, and onboarding context. Learned and episodic records are observations, not instructions, and cannot override company policy, tool grants, or approval rules.

There is no persistent team hierarchy in the current project. Shared team memory is business-wide. A task-linked memory is visible only to that task and descendants. Supervisor corrections and promotions are restricted to employees assigned sub-tasks beneath the supervisor's current task.

## Agent tools

Memory context is loaded once at startup and supplied in the system prompt on each LLM call. There is no internal `read_memory` tool or mid-run memory refresh; changes are picked up by the next run. This avoids adding the startup memories to conversation history a second time.

- `write_memory({ kind, content })` permits only `episodic` and `learned` records on the caller's own employee, with source `agent_self`. Content must be 1–4,000 characters. Agents cannot write preferences, instructions, corrections, or company policies through this tool.
- Managers have `write_team_memory({ kind, content, task_id? })`. Kinds are `briefing`, `delegation_note`, and `outcome_summary`. Delegation notes require a directly delegated sub-task ID.
- Managers have `write_correction_memory({ employee_id, kind?, content })` for instructions or corrections to delegated employees. The default kind is `correction`; the source is `supervisor_correction`.
- `check_task_status` exposes a delegated employee's latest five observations and the latest run's last five steps for review. `promote_employee_memory({ memory_id })` copies a reviewed learned/episodic observation from that employee into a team outcome summary.

The loop automatically records an episodic `task_outcome` when finalized, including completion, approval pauses, stopped runs, stale runs, and unexpected execution failures. Its ID is based on the run ID to prevent duplicate summaries. A pending or failed action is not logged as completed. Execution traces remain in `runs`; memory stores a concise summary. Outcomes cannot be persisted while the database itself is unavailable.

The blueprint's employee-preference write rules conflict: its matrix allows preference writes, while its `write_memory` definition allows only episodic/learned. This implementation follows the stricter tool definition. Owners can still create and edit preferences.

## Owner API

Authenticated humans can list their business's company/team records. Mutations require the user's current database role to be `owner`; an old JWT owner claim is insufficient.

| Endpoint | Methods | Body |
| --- | --- | --- |
| `/api/business-memories` | GET, POST | `{ kind, content }` |
| `/api/business-memories/:id` | PATCH, DELETE | Partial `{ kind, content }` |
| `/api/team-memories` | GET, POST | `{ kind, content, taskId? }` |
| `/api/team-memories/:id` | PATCH, DELETE | Partial `{ kind, content, taskId }` |
| `/api/employees/:employeeId/memories` | GET, POST | `{ kind, content }` |
| `/api/employees/:employeeId/memories/:memoryId` | PATCH, DELETE | Partial `{ kind, content }` |

A null/omitted `taskId` makes a team record business-wide. `delegation_note` requires a task ID in the same business. Authors and business IDs are assigned server-side. Human edits of personal memories use source `onboarding`; company memory uses `owner`. The existing memory source column is text, so new sources need no enum migration.

Example company policy:

```json
{ "kind": "policy", "content": "Never commit to a deadline without manager approval." }
```

The typed frontend API helpers are in `apps/web/src/lib/api.ts`. This change provides the memory backend and runtime; the existing profile Memory tab UI remains separate work.

## Database and verification

`packages/db/migrations/0001_confused_doctor_octopus.sql` adds the business/team tables, memory kinds, foreign keys, and retrieval indexes. For an existing development database managed through schema push, run `pnpm --filter @staffroom/db db:push`. Fresh databases can apply the migration history with `db:migrate`.

Run `pnpm --filter @staffroom/api test` for tool dispatch and memory tests. API type checking currently needs `--rootDir ../..` for workspace package imports; an existing unused `rateLimiterMiddleware` import in `index.ts` requires `--noUnusedLocals false` until that separate issue is resolved.
