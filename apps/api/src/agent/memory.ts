import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { getDb, businessMemories, teamMemories, memories, employees, tasks } from "@staffroom/db";
import { z } from "zod";
import { newId } from "../lib/id";

export interface MemoryScope { businessId: string; employeeId: string; taskId: string }
export const memoryContentSchema = z.string().trim().min(1).max(500);
export const writeMemorySchema = z.object({
  kind: z.enum(["episodic", "learned"]), content: memoryContentSchema,
});
export const writeTeamMemorySchema = z.object({
  kind: z.enum(["briefing", "delegation_note", "outcome_summary"]),
  content: memoryContentSchema, task_id: z.string().min(1).optional(),
});
export const writeCorrectionSchema = z.object({
  employee_id: z.string().min(1), kind: z.enum(["instruction", "correction"]).default("correction"),
  content: memoryContentSchema,
});

async function scopedEmployee(scope: MemoryScope, managerOnly = false) {
  const [employee] = await getDb().select().from(employees).where(and(
    eq(employees.id, scope.employeeId), eq(employees.businessId, scope.businessId), eq(employees.status, "active")
  )).limit(1);
  if (!employee || (managerOnly && !employee.isManager)) throw new Error("Memory write is outside your scope.");
  return employee;
}

// With no persistent team membership, sharing is business-scoped. Task-linked
// notes are visible only along the current task's parent chain.
async function taskLineage(scope: MemoryScope): Promise<string[]> {
  const ids: string[] = [];
  let id: string | null = scope.taskId;
  const db = getDb();
  while (id && ids.length < 20 && !ids.includes(id)) {
    const [task]: Array<{ id: string; parentTaskId: string | null }> = await db.select({ id: tasks.id, parentTaskId: tasks.parentTaskId })
      .from(tasks).where(and(eq(tasks.id, id), eq(tasks.businessId, scope.businessId))).limit(1);
    if (!task) break;
    ids.push(task.id);
    id = task.parentTaskId;
  }
  return ids;
}

export async function loadMemoryContext(scope: MemoryScope) {
  await scopedEmployee(scope);
  const db = getDb();
  const lineage = await taskLineage(scope);
  const teamScope = and(eq(teamMemories.businessId, scope.businessId),
    or(isNull(teamMemories.taskId), ...(lineage.length ? [inArray(teamMemories.taskId, lineage)] : [])));
  const personal = eq(memories.employeeId, scope.employeeId);
  const [company, team, standing, episodic, learned] = await Promise.all([
    db.select().from(businessMemories).where(eq(businessMemories.businessId, scope.businessId)).orderBy(desc(businessMemories.createdAt)).limit(20),
    db.select().from(teamMemories).where(teamScope).orderBy(desc(teamMemories.createdAt)).limit(5),
    db.select().from(memories).where(and(personal, inArray(memories.kind, ["instruction", "preference", "correction"]))).orderBy(desc(memories.createdAt)),
    db.select().from(memories).where(and(personal, eq(memories.kind, "episodic"))).orderBy(desc(memories.createdAt)).limit(3),
    db.select().from(memories).where(and(personal, eq(memories.kind, "learned"))).orderBy(desc(memories.createdAt)).limit(5),
  ]);
  return { businessMemories: company, teamMemories: team, memories: [...standing, ...episodic, ...learned] };
}

export async function writeAgentMemory(scope: MemoryScope, input: Record<string, unknown>) {
  const body = writeMemorySchema.parse(input);
  await scopedEmployee(scope);
  const [saved] = await getDb().insert(memories).values({
    id: newId("mem"), employeeId: scope.employeeId, ...body, source: "agent_self",
  }).returning();
  return saved;
}

export async function writeSupervisorTeamMemory(scope: MemoryScope, input: Record<string, unknown>) {
  const { task_id, ...body } = writeTeamMemorySchema.parse(input);
  await scopedEmployee(scope, true);
  if (task_id) {
    const [task] = await getDb().select({ id: tasks.id }).from(tasks).where(and(
      eq(tasks.id, task_id), eq(tasks.businessId, scope.businessId), eq(tasks.parentTaskId, scope.taskId)
    )).limit(1);
    if (!task) throw new Error("Delegation note must target a sub-task you delegated.");
  }
  if (body.kind === "delegation_note" && !task_id) throw new Error("Delegation notes require task_id.");
  const [saved] = await getDb().insert(teamMemories).values({
    id: newId("tmem"), businessId: scope.businessId, authorEmployeeId: scope.employeeId,
    taskId: task_id ?? null, ...body,
  }).returning();
  return saved;
}

export async function writeSupervisorCorrection(scope: MemoryScope, input: Record<string, unknown>) {
  const { employee_id, ...body } = writeCorrectionSchema.parse(input);
  await scopedEmployee(scope, true);
  const [subordinate] = await getDb().select({ id: employees.id }).from(employees).innerJoin(tasks,
    eq(tasks.assignedToEmployeeId, employees.id)).where(and(
      eq(employees.id, employee_id), eq(employees.businessId, scope.businessId),
      eq(tasks.businessId, scope.businessId), eq(tasks.parentTaskId, scope.taskId)
    )).limit(1);
  if (!subordinate || employee_id === scope.employeeId) throw new Error("You may only correct an employee you delegated a sub-task to.");
  const [saved] = await getDb().insert(memories).values({
    id: newId("mem"), employeeId: employee_id, ...body, source: "supervisor_correction",
  }).returning();
  return saved;
}

export async function promoteEmployeeMemory(scope: MemoryScope, input: Record<string, unknown>) {
  const { memory_id } = z.object({ memory_id: z.string().min(1) }).parse(input);
  await scopedEmployee(scope, true);
  const [original] = await getDb().select({ content: memories.content }).from(memories)
    .innerJoin(employees, eq(memories.employeeId, employees.id))
    .innerJoin(tasks, eq(tasks.assignedToEmployeeId, employees.id))
    .where(and(eq(memories.id, memory_id), inArray(memories.kind, ["episodic", "learned"]),
      eq(employees.businessId, scope.businessId), eq(tasks.businessId, scope.businessId), eq(tasks.parentTaskId, scope.taskId)))
    .limit(1);
  if (!original) throw new Error("Only observations from a delegated employee can be promoted.");
  return writeSupervisorTeamMemory(scope, { kind: "outcome_summary", content: original.content });
}

