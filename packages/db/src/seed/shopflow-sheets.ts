/**
 * Seed script — creates ShopFlow Electronics Google Sheets demo data
 *
 * Creates 3 sheets in Google Drive:
 *   1. ShopFlow — Orders (recent customer orders)
 *   2. ShopFlow — Inventory (stock levels + reorder alerts)
 *   3. ShopFlow — B2B Pipeline (sales leads for LEO)
 *
 * Then saves the sheet IDs as business_memories so OPS + LEO know where to find them.
 *
 * Run: apps/api/node_modules/.bin/tsx packages/db/src/seed/shopflow-sheets.ts
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../schema";
import { nanoid } from "nanoid";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });

const newId = (prefix: string) => `${prefix}_${nanoid(16)}`;
const BUSINESS_ID = "biz_suhailea";

// ── Token management ────────────────────────────────────────────────────────

async function getValidToken(db: ReturnType<typeof drizzle>): Promise<string> {
  const [account] = await (db as any)
    .select()
    .from(schema.connectorAccounts)
    .where(
      and(
        eq(schema.connectorAccounts.businessId, BUSINESS_ID),
        eq(schema.connectorAccounts.provider, "google_sheets")
      )
    );

  if (!account) throw new Error("No Google Sheets connector found for biz_suhailea. Connect it in the app first.");

  const now = new Date();
  const expires = account.expiresAt ? new Date(account.expiresAt) : new Date(0);
  const needsRefresh = expires.getTime() - now.getTime() < 5 * 60 * 1000; // refresh if < 5 min left

  if (!needsRefresh) {
    return account.accessToken!;
  }

  if (!account.refreshToken) throw new Error("No refresh token — reconnect Google Sheets in the app.");

  console.log("  Refreshing Google access token...");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  const newExpiry = new Date(Date.now() + data.expires_in * 1000);

  await (db as any)
    .update(schema.connectorAccounts)
    .set({ accessToken: data.access_token, expiresAt: newExpiry })
    .where(eq(schema.connectorAccounts.id, account.id));

  console.log("  ✓ Token refreshed");
  return data.access_token;
}

// ── Sheets API helpers ──────────────────────────────────────────────────────

async function createSpreadsheet(token: string, title: string): Promise<string> {
  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ properties: { title } }),
  });
  if (!res.ok) throw new Error(`Create sheet failed: ${await res.text()}`);
  const data = await res.json() as { spreadsheetId: string };
  return data.spreadsheetId;
}

async function writeSheet(
  token: string,
  spreadsheetId: string,
  range: string,
  values: (string | number)[][]
): Promise<void> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    }
  );
  if (!res.ok) throw new Error(`Write sheet failed: ${await res.text()}`);
}

async function formatHeader(token: string, spreadsheetId: string, sheetId: number): Promise<void> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.059, green: 0.357, blue: 0.424 }, // #0f5b6c
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat)",
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: "gridProperties.frozenRowCount",
            },
          },
        ],
      }),
    }
  );
  if (!res.ok) throw new Error(`Format failed: ${await res.text()}`);
}

// ── Sheet data ──────────────────────────────────────────────────────────────

const ORDERS_DATA: (string | number)[][] = [
  ["Order ID", "Date", "Customer", "Email", "Product", "SKU", "Qty", "Unit Price (AED)", "Total (AED)", "Status", "Notes"],
  ["ORD-10041", "2026-10-13", "Ahmed Al Rashid", "ahmed.r@gmail.com", "Samsung 65\" QLED TV", "SAM-TV-65Q", 1, 4299, 4299, "Processing", ""],
  ["ORD-10040", "2026-10-13", "Fatima Khalid", "fatima.k@hotmail.com", "Sony WH-1000XM5 Headphones", "SNY-WH-XM5", 2, 1099, 2198, "Shipped", "Tracking: DHL-44821"],
  ["ORD-10039", "2026-10-12", "James Mitchell", "j.mitchell@company.ae", "iPad Pro 13\" M4 256GB", "APL-IPADP-13", 3, 3999, 11997, "Delivered", "B2B bulk order"],
  ["ORD-10038", "2026-10-12", "Sara Al Mansoori", "sara@crescentstudio.ae", "MacBook Air M3 15\"", "APL-MBA-M3-15", 1, 6299, 6299, "Delivered", ""],
  ["ORD-10037", "2026-10-11", "Mohammed Hassan", "m.hassan@gmail.com", "LG 27\" 4K Monitor", "LG-MON-27-4K", 2, 1849, 3698, "Shipped", "Tracking: Aramex-77234"],
  ["ORD-10036", "2026-10-11", "Emily Chen", "emily.chen@startup.io", "Logitech MX Keys Combo", "LGT-MXKEYS", 5, 699, 3495, "Processing", "Office setup order"],
  ["ORD-10035", "2026-10-10", "Khalid Al Fahim", "khalid.f@enterprise.ae", "Dell XPS 15 Laptop", "DEL-XPS15", 2, 7499, 14998, "Delivered", ""],
  ["ORD-10034", "2026-10-10", "Priya Sharma", "priya.s@gmail.com", "Canon EOS R50 Camera", "CAN-EOSR50", 1, 2499, 2499, "Delivered", ""],
  ["ORD-10033", "2026-10-09", "David Park", "d.park@techco.com", "Anker 65W USB-C Hub", "ANK-HUB-65W", 10, 249, 2490, "Shipped", ""],
  ["ORD-10032", "2026-10-09", "Noura Al Zaabi", "noura.z@gmail.com", "Apple Watch Ultra 2", "APL-WATCH-U2", 1, 3299, 3299, "Return Requested", "Screen issue — awaiting assessment"],
  ["ORD-10031", "2026-10-08", "Tom Williams", "t.williams@corp.ae", "Samsung Galaxy S25 Ultra", "SAM-S25U", 4, 4199, 16796, "Delivered", "Corporate order"],
  ["ORD-10030", "2026-10-08", "Aisha Mohammed", "aisha.m@gmail.com", "Jabra Evolve2 85 Headset", "JAB-EV285", 1, 1399, 1399, "Delivered", ""],
  ["ORD-10029", "2026-10-07", "Ricardo Santos", "r.santos@agency.ae", "Sony A7 IV Camera Body", "SNY-A7IV", 1, 8999, 8999, "Delivered", ""],
  ["ORD-10028", "2026-10-07", "Hana Al Blooshi", "hana.b@hotmail.com", "iPhone 16 Pro Max 256GB", "APL-IP16PM", 2, 4799, 9598, "Refund Processed", "Changed mind — returned in 7 days"],
  ["ORD-10027", "2026-10-06", "Omar Yusuf", "omar.y@gmail.com", "Bose QuietComfort 45", "BSE-QC45", 1, 1299, 1299, "Delivered", ""],
];

const INVENTORY_DATA: (string | number)[][] = [
  ["SKU", "Product Name", "Category", "In Stock", "Reserved", "Available", "Reorder Threshold", "Unit Cost (AED)", "Sell Price (AED)", "Supplier", "Lead Time (days)", "Status"],
  ["APL-IP16PM", "iPhone 16 Pro Max 256GB", "Smartphones", 12, 4, 8, 15, 3800, 4799, "Apple MENA", 7, "OK"],
  ["APL-IP16P", "iPhone 16 Pro 256GB", "Smartphones", 8, 2, 6, 15, 3100, 3999, "Apple MENA", 7, "OK"],
  ["SAM-S25U", "Samsung Galaxy S25 Ultra", "Smartphones", 6, 4, 2, 10, 3200, 4199, "Samsung Gulf", 5, "LOW STOCK"],
  ["SAM-S25", "Samsung Galaxy S25", "Smartphones", 18, 3, 15, 10, 2100, 2799, "Samsung Gulf", 5, "OK"],
  ["APL-IPADP-13", "iPad Pro 13\" M4 256GB", "Tablets", 5, 3, 2, 8, 3100, 3999, "Apple MENA", 7, "LOW STOCK"],
  ["APL-IPADP-11", "iPad Pro 11\" M4 256GB", "Tablets", 14, 2, 12, 8, 2300, 2999, "Apple MENA", 7, "OK"],
  ["APL-MBA-M3-15", "MacBook Air M3 15\"", "Laptops", 4, 1, 3, 8, 4900, 6299, "Apple MENA", 10, "LOW STOCK"],
  ["APL-MBP-M4-14", "MacBook Pro M4 14\"", "Laptops", 7, 0, 7, 5, 7500, 9499, "Apple MENA", 10, "OK"],
  ["DEL-XPS15", "Dell XPS 15 Laptop", "Laptops", 9, 2, 7, 6, 5800, 7499, "Dell Arabia", 8, "OK"],
  ["SAM-TV-65Q", "Samsung 65\" QLED TV", "TVs", 3, 1, 2, 5, 3200, 4299, "Samsung Gulf", 12, "LOW STOCK"],
  ["LG-OLED-65", "LG 65\" OLED evo TV", "TVs", 6, 0, 6, 4, 4800, 6499, "LG Electronics", 14, "OK"],
  ["SNY-WH-XM5", "Sony WH-1000XM5 Headphones", "Audio", 22, 5, 17, 10, 750, 1099, "Sony Arabia", 6, "OK"],
  ["BSE-QC45", "Bose QuietComfort 45", "Audio", 11, 1, 10, 8, 900, 1299, "Bose ME", 9, "OK"],
  ["JAB-EV285", "Jabra Evolve2 85 Headset", "Audio", 8, 0, 8, 5, 1000, 1399, "GN Audio", 12, "OK"],
  ["APL-WATCH-U2", "Apple Watch Ultra 2", "Wearables", 2, 1, 1, 5, 2500, 3299, "Apple MENA", 7, "CRITICAL"],
  ["APL-WATCH-S10", "Apple Watch Series 10 45mm", "Wearables", 15, 3, 12, 8, 1200, 1699, "Apple MENA", 7, "OK"],
  ["SNY-A7IV", "Sony A7 IV Camera Body", "Cameras", 3, 1, 2, 3, 7000, 8999, "Sony Arabia", 14, "LOW STOCK"],
  ["CAN-EOSR50", "Canon EOS R50 Camera", "Cameras", 7, 0, 7, 4, 1800, 2499, "Canon Gulf", 10, "OK"],
  ["LG-MON-27-4K", "LG 27\" 4K Monitor", "Monitors", 13, 4, 9, 8, 1300, 1849, "LG Electronics", 7, "OK"],
  ["LGT-MXKEYS", "Logitech MX Keys Combo", "Accessories", 31, 5, 26, 12, 480, 699, "Logitech ME", 5, "OK"],
  ["ANK-HUB-65W", "Anker 65W USB-C Hub", "Accessories", 0, 0, 0, 15, 160, 249, "Anker Arabia", 5, "OUT OF STOCK"],
  ["SAM-TV-85Q", "Samsung 85\" QLED TV", "TVs", 2, 0, 2, 3, 5800, 7999, "Samsung Gulf", 12, "LOW STOCK"],
];

const PIPELINE_DATA: (string | number)[][] = [
  ["Lead ID", "Company", "Contact", "Email", "Phone", "Deal Type", "Products Interested", "Est. Value (AED)", "Stage", "Last Contact", "Next Follow-up", "Notes"],
  ["B2B-041", "TechCorp Solutions", "Ahmad Nasser", "a.nasser@techcorp.ae", "+971 50 123 4567", "Bulk Order", "MacBook Pro M4 x10, iPad Pro x20", 195000, "Proposal Sent", "2026-10-11", "2026-10-14", "Waiting on budget approval from CFO"],
  ["B2B-040", "Al Futtaim Retail", "Sandra Williams", "s.williams@alfuttaim.ae", "+971 4 567 8901", "Reseller Agreement", "Mixed Apple & Samsung stock", 500000, "Negotiation", "2026-10-12", "2026-10-15", "Discussing volume discount tiers — high priority"],
  ["B2B-039", "Dubai Government HQ", "Mohammed Al Marzouqi", "m.marzouqi@gov.ae", "+971 50 987 6543", "Tender", "Dell XPS Laptops x50, LG Monitors x50", 450000, "Qualification", "2026-10-10", "2026-10-16", "RFQ received — need to submit formal quote by Oct 20"],
  ["B2B-038", "Bloom Education Group", "Priya Krishnan", "p.krishnan@bloom.ae", "+971 4 234 5678", "Bulk Order", "iPad Air x100, Apple Pencil x100", 380000, "Closed Won", "2026-10-08", "", "PO received. Delivery scheduled Oct 18."],
  ["B2B-037", "Emirates NBD", "Tariq Al Hamdan", "t.hamdan@enbd.ae", "+971 50 456 7890", "Corporate Account", "iPhone 16 Pro x30, MacBook Air M3 x15", 285000, "Proposal Sent", "2026-10-09", "2026-10-14", "IT dept review ongoing — 2nd follow-up due"],
  ["B2B-036", "Majid Al Futtaim", "Hessa Al Marri", "h.almarri@maf.ae", "+971 4 890 1234", "Bulk Order", "Samsung 65\" QLED x10 (showroom display)", 42990, "Negotiation", "2026-10-07", "2026-10-13", "Wants 15% volume discount — max we can do is 10%"],
  ["B2B-035", "Careem", "Yusuf Ibrahim", "y.ibrahim@careem.com", "+971 50 345 6789", "Bulk Order", "iPhone 16 x50 (driver ops)", 175000, "Qualification", "2026-10-05", "2026-10-14", "No response to last email — needs follow-up urgently"],
  ["B2B-034", "GEMS Education", "Claire Thompson", "c.thompson@gemseducation.com", "+971 4 123 9999", "Reseller", "Mixed accessories + Chromebooks", 95000, "Closed Lost", "2026-10-01", "", "Went with competitor — better logistics terms"],
  ["B2B-033", "Aldar Properties", "Khalid Al Shamsi", "k.alshamsi@aldar.ae", "+971 50 678 9012", "Bulk Order", "Dell XPS 15 x8, LG 27\" Monitor x16", 105992, "Proposal Sent", "2026-10-06", "2026-10-13", "Decision maker on leave until Oct 13"],
  ["B2B-032", "Noon.com", "Zara Al Azizi", "z.alazizi@noon.com", "+971 4 456 7890", "Distribution Partner", "Full Apple product line", 1200000, "Qualification", "2026-10-03", "2026-10-17", "Huge opportunity — legal reviewing partnership terms"],
  ["B2B-031", "Etihad Airways", "James O'Brien", "j.obrien@etihad.ae", "+971 2 345 6789", "Bulk Order", "iPad Pro x25 (cabin crew)", 99975, "Closed Won", "2026-09-28", "", "Delivered. Follow up for accessories order."],
  ["B2B-030", "ADNOC", "Fatima Al Hosani", "f.alhosani@adnoc.ae", "+971 50 111 2222", "Tender", "Ruggedised tablets + laptops x200", 800000, "Proposal Sent", "2026-10-02", "2026-10-20", "Formal tender submitted — decision expected end of month"],
];

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema }) as any;

  console.log("🌱 ShopFlow Electronics — Google Sheets seed\n");

  const token = await getValidToken(db);
  console.log("✓ Got valid access token\n");

  // 1. Orders sheet
  console.log("Creating 'ShopFlow — Orders'...");
  const ordersId = await createSpreadsheet(token, "ShopFlow — Orders");
  await writeSheet(token, ordersId, "Sheet1!A1", ORDERS_DATA);
  await formatHeader(token, ordersId, 0);
  console.log(`  ✓ Orders sheet: https://docs.google.com/spreadsheets/d/${ordersId}`);

  // 2. Inventory sheet
  console.log("Creating 'ShopFlow — Inventory'...");
  const inventoryId = await createSpreadsheet(token, "ShopFlow — Inventory");
  await writeSheet(token, inventoryId, "Sheet1!A1", INVENTORY_DATA);
  await formatHeader(token, inventoryId, 0);
  console.log(`  ✓ Inventory sheet: https://docs.google.com/spreadsheets/d/${inventoryId}`);

  // 3. B2B Pipeline sheet
  console.log("Creating 'ShopFlow — B2B Pipeline'...");
  const pipelineId = await createSpreadsheet(token, "ShopFlow — B2B Pipeline");
  await writeSheet(token, pipelineId, "Sheet1!A1", PIPELINE_DATA);
  await formatHeader(token, pipelineId, 0);
  console.log(`  ✓ B2B Pipeline sheet: https://docs.google.com/spreadsheets/d/${pipelineId}`);

  // 4. Save sheet IDs as business memories so OPS and LEO know where to find them
  console.log("\nSaving sheet references as business memories...");

  const MEMORY_NAMES = ["shopflow_orders_sheet", "shopflow_inventory_sheet", "shopflow_pipeline_sheet"];
  const existing = await db
    .select()
    .from(schema.businessMemories)
    .where(eq(schema.businessMemories.businessId, BUSINESS_ID));

  for (const name of MEMORY_NAMES) {
    const found = existing.find((m: any) => m.content?.includes(name) || m.kind === "sop" && m.content?.includes(name));
    if (found) {
      await db.delete(schema.businessMemories).where(eq(schema.businessMemories.id, found.id));
    }
  }

  const memories = [
    {
      id: newId("bmem"),
      businessId: BUSINESS_ID,
      kind: "sop" as const,
      content: `shopflow_orders_sheet: The ShopFlow Electronics customer orders are tracked in this Google Sheet: https://docs.google.com/spreadsheets/d/${ordersId} (ID: ${ordersId}). Sheet name: Sheet1. Columns: Order ID, Date, Customer, Email, Product, SKU, Qty, Unit Price (AED), Total (AED), Status, Notes.`,
      source: "seed",
    },
    {
      id: newId("bmem"),
      businessId: BUSINESS_ID,
      kind: "sop" as const,
      content: `shopflow_inventory_sheet: The ShopFlow Electronics product inventory is tracked in this Google Sheet: https://docs.google.com/spreadsheets/d/${inventoryId} (ID: ${inventoryId}). Sheet name: Sheet1. Columns: SKU, Product Name, Category, In Stock, Reserved, Available, Reorder Threshold, Unit Cost (AED), Sell Price (AED), Supplier, Lead Time (days), Status. Status values: OK, LOW STOCK, CRITICAL, OUT OF STOCK.`,
      source: "seed",
    },
    {
      id: newId("bmem"),
      businessId: BUSINESS_ID,
      kind: "sop" as const,
      content: `shopflow_pipeline_sheet: The ShopFlow Electronics B2B sales pipeline is tracked in this Google Sheet: https://docs.google.com/spreadsheets/d/${pipelineId} (ID: ${pipelineId}). Sheet name: Sheet1. Columns: Lead ID, Company, Contact, Email, Phone, Deal Type, Products Interested, Est. Value (AED), Stage, Last Contact, Next Follow-up, Notes. Stage values: Qualification, Proposal Sent, Negotiation, Closed Won, Closed Lost.`,
      source: "seed",
    },
  ];

  for (const mem of memories) {
    await db.insert(schema.businessMemories).values(mem);
    console.log(`  ✓ Memory saved: ${mem.kind} — ${mem.content.slice(0, 60)}...`);
  }

  console.log("\n✅ Done! ShopFlow Google Sheets are live and linked to business memories.");
  console.log("\nSheet URLs:");
  console.log(`  Orders:    https://docs.google.com/spreadsheets/d/${ordersId}`);
  console.log(`  Inventory: https://docs.google.com/spreadsheets/d/${inventoryId}`);
  console.log(`  Pipeline:  https://docs.google.com/spreadsheets/d/${pipelineId}`);

  await client.end();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
