/**
 * Seed script — creates the 6 ShopFlow Electronics AI employees
 * in the biz_suhailea workspace.
 *
 * Run: npx tsx packages/db/src/seed/shopflow.ts
 *
 * Safe to re-run: existing ShopFlow employees are deleted first.
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../schema";
import { nanoid } from "nanoid";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });

const newId = (prefix: string) => `${prefix}_${nanoid(16)}`;

const BUSINESS_ID = "biz_suhailea";

const EMPLOYEES = [
  {
    id: newId("emp"),
    displayName: "ARIA",
    roleDescription: "Customer Support Lead — handles all customer emails, triages inbox, drafts replies, flags refunds and complaints",
    integrations: ["gmail"] as schema.Integration[],
    isManager: false,
    budgetMonthlyUsd: 20,
    instructionsJson: {
      instructions: "You handle all customer support emails for ShopFlow Electronics. Triage inbox every morning: categorise as order-query, return/refund, complaint, or general. Draft friendly, professional replies. For refund requests under $50 you may draft a direct approval reply. Flag anything above $100, legal threats, or angry customers. Never send without approval.",
    },
    toolGrants: [
      { provider: "gmail", toolName: "list_emails" },
      { provider: "gmail", toolName: "get_email" },
      { provider: "gmail", toolName: "draft_email" },
      { provider: "gmail", toolName: "send_email" },
    ],
  },
  {
    id: newId("emp"),
    displayName: "KAI",
    roleDescription: "Internal Comms Coordinator — monitors Slack channels, surfaces blockers, posts stand-up summaries, routes team messages",
    integrations: ["slack"] as schema.Integration[],
    isManager: false,
    budgetMonthlyUsd: 15,
    instructionsJson: {
      instructions: "You keep the ShopFlow team aligned. Read #general, #ops, and #warehouse daily. Summarise any blockers or decisions needed in a morning brief. Route questions to the right person. All channel posts require approval before sending.",
    },
    toolGrants: [
      { provider: "slack", toolName: "slack_read_channel" },
      { provider: "slack", toolName: "slack_search_public" },
      { provider: "slack", toolName: "slack_search_channels" },
      { provider: "slack", toolName: "slack_send_message" },
    ],
  },
  {
    id: newId("emp"),
    displayName: "NOVA",
    roleDescription: "Calendar & Scheduling Assistant — manages meetings, finds free slots, schedules syncs, sends reminders",
    integrations: ["gcal"] as schema.Integration[],
    isManager: false,
    budgetMonthlyUsd: 15,
    instructionsJson: {
      instructions: "You manage the ShopFlow calendar. Schedule internal syncs when asked. For supplier calls, find a free slot and draft the invite — wait for approval before sending. Send reminders 24h before all important meetings. Flag scheduling conflicts immediately.",
    },
    toolGrants: [
      { provider: "google_calendar", toolName: "list_events" },
      { provider: "google_calendar", toolName: "get_event" },
      { provider: "google_calendar", toolName: "create_event" },
      { provider: "google_calendar", toolName: "update_event" },
      { provider: "google_calendar", toolName: "delete_event" },
    ],
  },
  {
    id: newId("emp"),
    displayName: "LEO",
    roleDescription: "Sales & B2B Outreach Rep — tracks bulk order leads, drafts proposals, follows up on enquiries, monitors pipeline",
    integrations: ["gmail", "slack", "google_sheets"] as schema.Integration[],
    isManager: false,
    budgetMonthlyUsd: 20,
    instructionsJson: {
      instructions: "You handle B2B sales for ShopFlow Electronics. Track all bulk order enquiries and reseller leads from email. Draft follow-up emails 3 days after any quote or proposal with no reply. Post a weekly pipeline summary to #sales. Flag any deal > $5,000 or any lead quiet for more than 7 days. All sends require approval.",
    },
    toolGrants: [
      { provider: "gmail", toolName: "list_emails" },
      { provider: "gmail", toolName: "get_email" },
      { provider: "gmail", toolName: "draft_email" },
      { provider: "gmail", toolName: "send_email" },
      { provider: "slack", toolName: "slack_read_channel" },
      { provider: "slack", toolName: "slack_send_message" },
      { provider: "google_sheets", toolName: "sheets_list" },
      { provider: "google_sheets", toolName: "sheets_read" },
      { provider: "google_sheets", toolName: "sheets_write" },
    ],
  },
  {
    id: newId("emp"),
    displayName: "OPS",
    roleDescription: "Operations & Inventory Analyst — monitors inventory alerts, generates weekly ops reports, reads order data from email and Drive",
    integrations: ["gmail", "google_drive", "google_sheets"] as schema.Integration[],
    isManager: false,
    budgetMonthlyUsd: 15,
    instructionsJson: {
      instructions: "You run operations intelligence for ShopFlow Electronics. Every Friday generate a weekly ops report: summarise order volumes from email data, flag any low-stock alerts, list any overdue supplier deliveries, and note any ops blockers. Save reports to Google Drive. Flag anything critical immediately — don't wait for Friday. Never delete files or emails.",
    },
    toolGrants: [
      { provider: "gmail", toolName: "list_emails" },
      { provider: "gmail", toolName: "get_email" },
      { provider: "google_drive", toolName: "drive_list_files" },
      { provider: "google_drive", toolName: "drive_get_file" },
      { provider: "google_drive", toolName: "drive_create_file" },
      { provider: "google_drive", toolName: "drive_update_file" },
      { provider: "google_sheets", toolName: "sheets_list" },
      { provider: "google_sheets", toolName: "sheets_read" },
      { provider: "google_sheets", toolName: "sheets_write" },
    ],
  },
  {
    id: newId("emp"),
    displayName: "MAX",
    roleDescription: "Team Manager — coordinates the AI workforce, breaks down complex goals, delegates to specialists, compiles reports",
    integrations: ["internal"] as schema.Integration[],
    isManager: true,
    budgetMonthlyUsd: 25,
    instructionsJson: {
      instructions: "You coordinate the ShopFlow AI workforce. When given a complex goal, break it into clear subtasks and assign each to the right specialist. Always show your delegation plan first. Compile results into a clean summary for the owner. For the daily brief: delegate inbox summary to ARIA, Slack highlights to KAI, calendar to NOVA, then compile into one morning report.",
    },
    toolGrants: [],
  },
] as const;

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("🌱 Seeding ShopFlow Electronics employees...");

  // Remove existing ShopFlow seeded employees by display name
  const SHOPFLOW_NAMES = ["ARIA", "KAI", "NOVA", "LEO", "OPS", "MAX"];
  const existing = await db.query.employees.findMany({
    where: (e, { eq, and, inArray }) => and(
      eq(e.businessId, BUSINESS_ID),
      inArray(e.displayName, SHOPFLOW_NAMES)
    ),
  });

  for (const emp of existing) {
    console.log(`  Removing existing: ${emp.displayName} (${emp.id})`);
    await db.delete(schema.employees).where(eq(schema.employees.id, emp.id));
  }

  // Insert employees + tool grants
  for (const emp of EMPLOYEES) {
    const { toolGrants, ...empData } = emp;

    await db.insert(schema.employees).values({
      ...empData,
      businessId: BUSINESS_ID,
      status: "active",
      budgetUsedUsd: 0,
    });
    console.log(`  ✓ Employee: ${empData.displayName} (${empData.id})`);

    for (const grant of toolGrants) {
      await db.insert(schema.employeeToolGrants).values({
        id: newId("tgr"),
        employeeId: empData.id,
        businessId: BUSINESS_ID,
        provider: grant.provider,
        toolName: grant.toolName,
      });
    }

    if (toolGrants.length > 0) {
      console.log(`    ↳ ${toolGrants.length} tool grants`);
    }
  }

  console.log("\n✅ ShopFlow employees seeded successfully.");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
