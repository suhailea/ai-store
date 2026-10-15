/**
 * Fix ShopFlow demo:
 * 1. Re-add LEO and OPS employees (without deleting existing ones)
 * 2. Seed google_drive and google_sheets native tools into connector_tools
 *    so they appear in the Access tab on employee profiles
 *
 * Run: pnpm db:seed:shopflow:fix
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, inArray } from "drizzle-orm";
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

// ── Native tool definitions for Drive + Sheets ────────────────────────────────

const NATIVE_TOOLS = [
  // Google Drive
  {
    provider: "google_drive",
    toolName: "drive_list_files",
    description: "List files and folders in Google Drive. Supports filtering by folder ID or search query.",
    readOnly: true,
  },
  {
    provider: "google_drive",
    toolName: "drive_get_file",
    description: "Get metadata and content of a Google Drive file. Exports Docs/Sheets/Slides as plain text.",
    readOnly: true,
  },
  {
    provider: "google_drive",
    toolName: "drive_create_file",
    description: "Create a new file in Google Drive. Requires approval before execution.",
    readOnly: false,
  },
  {
    provider: "google_drive",
    toolName: "drive_update_file",
    description: "Update the content of an existing Google Drive file. Requires approval before execution.",
    readOnly: false,
  },
  // Google Sheets
  {
    provider: "google_sheets",
    toolName: "sheets_list",
    description: "List all sheets in a spreadsheet. Returns sheet names, IDs, and dimensions.",
    readOnly: true,
  },
  {
    provider: "google_sheets",
    toolName: "sheets_read",
    description: "Read cell values from a Google Sheets range using A1 notation.",
    readOnly: true,
  },
  {
    provider: "google_sheets",
    toolName: "sheets_write",
    description: "Write or append rows to a Google Sheets range. Requires approval before execution.",
    readOnly: false,
  },
];

// ── Employees to add ──────────────────────────────────────────────────────────

const NEW_EMPLOYEES = [
  {
    displayName: "LEO",
    roleDescription: "Sales & B2B Outreach Rep — tracks bulk order leads, drafts proposals, follows up on enquiries, monitors pipeline",
    integrations: ["gmail", "slack", "google_sheets"] as schema.Integration[],
    isManager: false,
    budgetMonthlyUsd: 20,
    instructionsJson: {
      instructions: "You handle B2B sales for ShopFlow Electronics. Track all bulk order enquiries and reseller leads from email. Draft follow-up emails 3 days after any quote or proposal with no reply. Post a weekly pipeline summary to #sales. Flag any deal > AED 5,000 or any lead quiet for more than 7 days. All sends require approval. The B2B pipeline is tracked in Google Sheets — check business memories for the sheet ID.",
    },
    toolGrants: [
      { provider: "gmail",         toolName: "list_emails" },
      { provider: "gmail",         toolName: "get_email" },
      { provider: "gmail",         toolName: "draft_email" },
      { provider: "gmail",         toolName: "send_email" },
      { provider: "slack",         toolName: "slack_read_channel" },
      { provider: "slack",         toolName: "slack_send_message" },
      { provider: "google_sheets", toolName: "sheets_list" },
      { provider: "google_sheets", toolName: "sheets_read" },
      { provider: "google_sheets", toolName: "sheets_write" },
    ],
  },
  {
    displayName: "OPS",
    roleDescription: "Operations & Inventory Analyst — monitors inventory alerts, generates weekly ops reports, reads order data from Sheets and Drive",
    integrations: ["gmail", "google_drive", "google_sheets"] as schema.Integration[],
    isManager: false,
    budgetMonthlyUsd: 15,
    instructionsJson: {
      instructions: "You run operations intelligence for ShopFlow Electronics. Every Friday generate a weekly ops report: summarise order volumes, flag any low-stock alerts from the inventory sheet, list any overdue supplier deliveries, and note any ops blockers. Save reports to Google Drive. Flag anything critical immediately — don't wait for Friday. Never delete files. The inventory and orders data is in Google Sheets — check business memories for sheet IDs.",
    },
    toolGrants: [
      { provider: "gmail",         toolName: "list_emails" },
      { provider: "gmail",         toolName: "get_email" },
      { provider: "google_drive",  toolName: "drive_list_files" },
      { provider: "google_drive",  toolName: "drive_get_file" },
      { provider: "google_drive",  toolName: "drive_create_file" },
      { provider: "google_drive",  toolName: "drive_update_file" },
      { provider: "google_sheets", toolName: "sheets_list" },
      { provider: "google_sheets", toolName: "sheets_read" },
      { provider: "google_sheets", toolName: "sheets_write" },
    ],
  },
];

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("🔧 ShopFlow fix script\n");

  // ── 1. Seed native tools for Drive + Sheets ─────────────────────────────────
  console.log("1. Seeding native connector tools...");

  for (const tool of NATIVE_TOOLS) {
    // Check if already exists
    const existing = await db.select({ id: schema.connectorTools.id })
      .from(schema.connectorTools)
      .where(and(
        eq(schema.connectorTools.businessId, BUSINESS_ID),
        eq(schema.connectorTools.provider, tool.provider),
        eq(schema.connectorTools.toolName, tool.toolName),
      ))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  skip ${tool.provider}/${tool.toolName} (exists)`);
      continue;
    }

    await db.insert(schema.connectorTools).values({
      id: newId("ctool"),
      businessId: BUSINESS_ID,
      provider: tool.provider,
      toolName: tool.toolName,
      description: tool.description,
      inputSchema: { readOnly: tool.readOnly },
      discoveredAt: new Date(),
    });
    console.log(`  ✓ ${tool.provider}/${tool.toolName}`);
  }

  // ── 2. Add LEO and OPS if missing ───────────────────────────────────────────
  console.log("\n2. Checking LEO and OPS...");

  const existingNames = await db.select({ name: schema.employees.displayName })
    .from(schema.employees)
    .where(and(
      eq(schema.employees.businessId, BUSINESS_ID),
      inArray(schema.employees.displayName, ["LEO", "OPS"])
    ));

  const existingSet = new Set(existingNames.map((e: { name: string }) => e.name));

  for (const emp of NEW_EMPLOYEES) {
    if (existingSet.has(emp.displayName)) {
      console.log(`  skip ${emp.displayName} (already exists)`);
      continue;
    }

    const empId = newId("emp");
    const { toolGrants, ...empData } = emp;

    await db.insert(schema.employees).values({
      id: empId,
      businessId: BUSINESS_ID,
      status: "active",
      budgetUsedUsd: 0,
      ...empData,
    });
    console.log(`  ✓ Created ${emp.displayName} (${empId})`);

    for (const grant of toolGrants) {
      await db.insert(schema.employeeToolGrants).values({
        id: newId("tgr"),
        employeeId: empId,
        businessId: BUSINESS_ID,
        provider: grant.provider,
        toolName: grant.toolName,
      });
    }
    console.log(`    ↳ ${toolGrants.length} tool grants`);
  }

  // ── 3. Print summary ─────────────────────────────────────────────────────────
  console.log("\n3. Current employees:");
  const allEmps = await db.select({
    name: schema.employees.displayName,
    isManager: schema.employees.isManager,
    status: schema.employees.status,
  }).from(schema.employees).where(eq(schema.employees.businessId, BUSINESS_ID));

  for (const e of allEmps) {
    console.log(`  ${e.name}${e.isManager ? " [MANAGER]" : ""} — ${e.status}`);
  }

  console.log("\n✅ Done.");
  await client.end();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
