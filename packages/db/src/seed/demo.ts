import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../schema";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

const newId = (prefix: string) => `${prefix}_${nanoid(16)}`;

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("🌱 Seeding demo company...");

  // Remove existing demo data
  const demos = await db.query.businesses.findMany({
    where: (b, { eq }) => eq(b.demoMode, true),
  });
  for (const demo of demos) {
    console.log(`  Removing existing demo: ${demo.name}`);
    await db.delete(schema.businesses).where(eq(schema.businesses.id, demo.id));
  }

  // IDs
  const businessId = newId("biz");
  const ownerId    = newId("usr");
  const emp1Id     = newId("emp");
  const emp2Id     = newId("emp");
  const emp3Id     = newId("emp");
  const task1Id    = newId("tsk");
  const task2Id    = newId("tsk");
  const run1Id     = newId("run");

  // ── Business ────────────────────────────────────────────────────────────────
  await db.insert(schema.businesses).values({
    id: businessId,
    name: "Crescent Studio",
    industry: "Creative Agency",
    teamSize: 8,
    ownerUserId: ownerId,
    demoMode: true,
  });
  console.log("  ✓ Business: Crescent Studio");

  // ── Owner ───────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("demo1234", 10);
  await db.insert(schema.humanUsers).values({
    id: ownerId,
    businessId,
    email: "sara@crescentstudio.ae",
    name: "Sara Al Mansoori",
    role: "owner",
    passwordHash,
  });
  console.log("  ✓ Owner: Sara Al Mansoori");

  // ── Employees ────────────────────────────────────────────────────────────────
  await db.insert(schema.employees).values([
    {
      id: emp1Id,
      businessId,
      displayName: "Layla",
      roleDescription: "Personal Assistant — inbox triage, morning brief, scheduling, reply drafts",
      integrations: ["gmail", "gcal"],
      status: "active",
      budgetMonthlyUsd: 10,
      budgetUsedUsd: 2.34,
      instructionsJson: {
        vip_clients: "Acme Corp, Desert Ventures, Gulf Media",
        tone: "Professional but warm",
        approval_required: "External meetings always need approval",
      },
      isManager: false,
    },
    {
      id: emp2Id,
      businessId,
      displayName: "Omar",
      roleDescription: "Docs & Data — spreadsheets, weekly reports, file Q&A",
      integrations: ["drive"],
      status: "active",
      budgetMonthlyUsd: 8,
      budgetUsedUsd: 0.87,
      instructionsJson: {
        revenue_sheet: "Revenue Tracker Q4 2026",
        report_day: "Monday mornings",
      },
      isManager: false,
    },
    {
      id: emp3Id,
      businessId,
      displayName: "Noor",
      roleDescription: "Manager — coordinates the team, breaks goals into tasks, writes weekly report",
      integrations: [],
      status: "active",
      budgetMonthlyUsd: 5,
      budgetUsedUsd: 0.45,
      instructionsJson: {
        weekly_report_day: "Friday",
        escalate_to: "sara@crescentstudio.ae",
      },
      isManager: true,
    },
  ]);
  console.log("  ✓ Employees: Layla, Omar, Noor");

  // ── Memories ─────────────────────────────────────────────────────────────────
  await db.insert(schema.memories).values([
    {
      id: newId("mem"),
      employeeId: emp1Id,
      kind: "instruction",
      content: "VIP clients: Acme Corp, Desert Ventures, Gulf Media — always prioritise their emails",
      source: "onboarding",
    },
    {
      id: newId("mem"),
      employeeId: emp1Id,
      kind: "instruction",
      content: "Tone: professional but warm. Avoid overly formal language.",
      source: "onboarding",
    },
    {
      id: newId("mem"),
      employeeId: emp1Id,
      kind: "preference",
      content: "Sara prefers email summaries in bullet points, not paragraphs",
      source: "correction",
    },
    {
      id: newId("mem"),
      employeeId: emp2Id,
      kind: "instruction",
      content: "Source of truth for revenue: 'Revenue Tracker Q4 2026' in Drive",
      source: "onboarding",
    },
  ]);
  console.log("  ✓ Memories seeded");

  // ── Tasks ────────────────────────────────────────────────────────────────────
  await db.insert(schema.tasks).values([
    {
      id: task1Id,
      businessId,
      assignedToEmployeeId: emp1Id,
      createdByHumanId: ownerId,
      title: "Triage this morning's inbox",
      description: "Categorise all unread emails and flag anything that needs attention today.",
      status: "done",
      costUsd: 0.0012,
      startedAt: new Date(Date.now() - 1000 * 60 * 30),
      finishedAt: new Date(Date.now() - 1000 * 60 * 25),
    },
    {
      id: task2Id,
      businessId,
      assignedToEmployeeId: emp1Id,
      createdByHumanId: ownerId,
      title: "Draft reply to Acme Corp follow-up",
      description: "Reply to Sarah at Acme asking to schedule a call for next week.",
      status: "waiting_approval",
      costUsd: 0.0008,
      startedAt: new Date(Date.now() - 1000 * 60 * 10),
    },
  ]);
  console.log("  ✓ Tasks seeded");

  // ── Run log ──────────────────────────────────────────────────────────────────
  await db.insert(schema.runs).values({
    id: run1Id,
    taskId: task1Id,
    steps: [
      { type: "thought", content: "I'll list unread emails first to understand what needs attention.", timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
      { type: "tool_call", toolName: "list_emails", toolArgs: { max_results: 20, query: "is:unread" }, timestamp: new Date(Date.now() - 1000 * 60 * 29).toISOString() },
      { type: "tool_result", toolName: "list_emails", content: "Found 5 unread emails", timestamp: new Date(Date.now() - 1000 * 60 * 29).toISOString() },
      { type: "thought", content: "5 emails. One from Acme Corp (VIP — action required). Let me read it in detail.", timestamp: new Date(Date.now() - 1000 * 60 * 28).toISOString() },
      { type: "tool_call", toolName: "get_email", toolArgs: { email_id: "email_001" }, timestamp: new Date(Date.now() - 1000 * 60 * 27).toISOString() },
      { type: "tool_result", toolName: "get_email", content: "From: sarah@acmecorp.com — Follow-up on last week's proposal", timestamp: new Date(Date.now() - 1000 * 60 * 27).toISOString() },
      { type: "tool_call", toolName: "get_email", toolArgs: { email_id: "email_005" }, timestamp: new Date(Date.now() - 1000 * 60 * 26).toISOString() },
      { type: "tool_result", toolName: "get_email", content: "BLOCKED: Prompt injection attempt detected in email from attacker@evil.com", timestamp: new Date(Date.now() - 1000 * 60 * 26).toISOString() },
      { type: "final", content: "Inbox triage complete. 5 emails processed:\n• 1 action required — Acme Corp VIP follow-up (sarah@acmecorp.com)\n• 1 invoice to review — AED 12,500 due Oct 15 (accounts@supplier.ae)\n• 1 newsletter — archived\n• 1 internal notification — read\n• 🚫 1 blocked — prompt injection attempt (attacker@evil.com)", timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString() },
    ],
    totalTokens: 4821,
    costUsd: 0.0012,
    durationMs: 5 * 60 * 1000,
  });
  console.log("  ✓ Run log seeded");

  // ── Pending approval ─────────────────────────────────────────────────────────
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  await db.insert(schema.approvals).values({
    id: newId("apr"),
    taskId: task2Id,
    runId: run1Id,
    employeeId: emp1Id,
    actionType: "send_email",
    payloadJson: {
      to: "sarah@acmecorp.com",
      subject: "Re: Follow-up on last week's proposal",
      body: "Hi Sarah,\n\nThank you for following up! We'd love to connect this week. Would Thursday at 2 PM work for you? If not, I'm also free Friday morning.\n\nLooking forward to chatting.\n\nBest,\nSara\nCresident Studio",
    },
    reason: "Acme Corp is a VIP client. They followed up on the proposal — I've drafted a reply to schedule a call. Needs your approval before sending.",
    status: "pending",
    idempotencyKey: newId("idem"),
    expiresAt,
  });
  console.log("  ✓ Pending approval seeded");

  // ── Audit log ────────────────────────────────────────────────────────────────
  await db.insert(schema.auditLogs).values([
    { id: newId("aud"), businessId, actorType: "employee", actorId: emp1Id, action: "task.completed", targetType: "task", targetId: task1Id },
    { id: newId("aud"), businessId, actorType: "employee", actorId: emp1Id, action: "approval.requested", targetType: "task", targetId: task2Id },
  ]);

  await client.end();

  console.log("\n✅ Demo seed complete!");
  console.log("   Business : Crescent Studio");
  console.log("   Login    : sara@crescentstudio.ae / demo1234");
  console.log("   Demo API : POST /api/auth/demo  (no login needed)\n");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
