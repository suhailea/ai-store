/**
 * Expand ShopFlow Electronics Google Sheets with full realistic data
 *
 * Updates the existing 3 sheets (IDs pulled from business_memories):
 *   1. ShopFlow — Orders       ~120 orders, 3 months of history
 *   2. ShopFlow — Inventory    60+ SKUs across 8 categories
 *   3. ShopFlow — B2B Pipeline 30+ deals, multiple industries
 *
 * Run: pnpm db:seed:sheets:expand
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../.env") });

const BUSINESS_ID = "biz_suhailea";

// ── Token management ─────────────────────────────────────────────────────────

async function getValidToken(db: any): Promise<string> {
  const [account] = await db
    .select()
    .from(schema.connectorAccounts)
    .where(and(
      eq(schema.connectorAccounts.businessId, BUSINESS_ID),
      eq(schema.connectorAccounts.provider, "google_sheets")
    ));

  if (!account) throw new Error("No Google Sheets connector found.");

  const expires = account.expiresAt ? new Date(account.expiresAt) : new Date(0);
  if (expires.getTime() - Date.now() > 5 * 60 * 1000) return account.accessToken!;

  console.log("  Refreshing token...");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: account.refreshToken!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  await db.update(schema.connectorAccounts)
    .set({ accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) })
    .where(eq(schema.connectorAccounts.id, account.id));
  return data.access_token;
}

// ── Sheet ID extraction from business memories ────────────────────────────────

function extractSheetId(content: string): string {
  const match = content.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error(`Cannot extract sheet ID from: ${content}`);
  return match[1];
}

// ── Sheets API helpers ────────────────────────────────────────────────────────

async function clearAndWrite(token: string, id: string, data: (string | number)[][]): Promise<void> {
  // Clear first
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Sheet1!A1:Z1000/clear`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  // Write all rows
  const range = `Sheet1!A1:Z${data.length}`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ range, majorDimension: "ROWS", values: data }),
    }
  );
  if (!res.ok) throw new Error(`Write failed: ${await res.text()}`);
  const result = await res.json() as { updatedRows?: number };
  console.log(`    → ${result.updatedRows ?? "?"} rows written`);
}

async function formatHeader(token: string, id: string): Promise<void> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.059, green: 0.357, blue: 0.424 },
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Format failed: ${await res.text()}`);
}

// ── DATA ─────────────────────────────────────────────────────────────────────

const ORDERS: (string | number)[][] = [
  ["Order ID", "Date", "Customer", "Email", "Product", "SKU", "Qty", "Unit Price (AED)", "Total (AED)", "Payment", "Status", "Courier", "Tracking", "Notes"],

  // October 2026 — recent
  ["ORD-10041", "2026-10-13", "Ahmed Al Rashid",      "ahmed.r@gmail.com",         "Samsung 65\" QLED TV",           "SAM-TV-65Q",     1,  4299,  4299, "Card",   "Processing",        "",         "",               ""],
  ["ORD-10040", "2026-10-13", "Fatima Khalid",         "fatima.k@hotmail.com",      "Sony WH-1000XM5 Headphones",     "SNY-WH-XM5",     2,  1099,  2198, "Card",   "Shipped",           "DHL",      "DHL-44821",      ""],
  ["ORD-10039", "2026-10-12", "James Mitchell",        "j.mitchell@company.ae",     "iPad Pro 13\" M4 256GB",         "APL-IPADP-13",   3,  3999, 11997, "Bank",   "Delivered",         "Aramex",   "ARX-99012",      "B2B bulk order"],
  ["ORD-10038", "2026-10-12", "Sara Al Mansoori",      "sara@crescentstudio.ae",    "MacBook Air M3 15\"",            "APL-MBA-M3-15",  1,  6299,  6299, "Card",   "Delivered",         "Fetchr",   "FTR-22341",      ""],
  ["ORD-10037", "2026-10-11", "Mohammed Hassan",       "m.hassan@gmail.com",        "LG 27\" 4K Monitor",             "LG-MON-27-4K",   2,  1849,  3698, "Card",   "Shipped",           "Aramex",   "ARX-77234",      ""],
  ["ORD-10036", "2026-10-11", "Emily Chen",            "emily.chen@startup.io",     "Logitech MX Keys Combo",         "LGT-MXKEYS",     5,   699,  3495, "Card",   "Processing",        "",         "",               "Office setup order"],
  ["ORD-10035", "2026-10-10", "Khalid Al Fahim",       "khalid.f@enterprise.ae",    "Dell XPS 15 Laptop",             "DEL-XPS15",      2,  7499, 14998, "Bank",   "Delivered",         "DHL",      "DHL-33190",      ""],
  ["ORD-10034", "2026-10-10", "Priya Sharma",          "priya.s@gmail.com",         "Canon EOS R50 Camera",           "CAN-EOSR50",     1,  2499,  2499, "Card",   "Delivered",         "Aramex",   "ARX-66723",      ""],
  ["ORD-10033", "2026-10-09", "David Park",            "d.park@techco.com",         "Anker 65W USB-C Hub",            "ANK-HUB-65W",   10,   249,  2490, "Card",   "Shipped",           "Smsa",     "SMS-11209",      ""],
  ["ORD-10032", "2026-10-09", "Noura Al Zaabi",        "noura.z@gmail.com",         "Apple Watch Ultra 2",            "APL-WATCH-U2",   1,  3299,  3299, "Card",   "Return Requested",  "",         "",               "Screen issue — awaiting assessment"],
  ["ORD-10031", "2026-10-08", "Tom Williams",          "t.williams@corp.ae",        "Samsung Galaxy S25 Ultra",       "SAM-S25U",       4,  4199, 16796, "Bank",   "Delivered",         "DHL",      "DHL-29871",      "Corporate order"],
  ["ORD-10030", "2026-10-08", "Aisha Mohammed",        "aisha.m@gmail.com",         "Jabra Evolve2 85 Headset",       "JAB-EV285",      1,  1399,  1399, "Card",   "Delivered",         "Fetchr",   "FTR-18823",      ""],
  ["ORD-10029", "2026-10-07", "Ricardo Santos",        "r.santos@agency.ae",        "Sony A7 IV Camera Body",         "SNY-A7IV",       1,  8999,  8999, "Card",   "Delivered",         "DHL",      "DHL-27654",      ""],
  ["ORD-10028", "2026-10-07", "Hana Al Blooshi",       "hana.b@hotmail.com",        "iPhone 16 Pro Max 256GB",        "APL-IP16PM",     2,  4799,  9598, "Card",   "Refund Processed",  "",         "",               "Changed mind — returned in 7 days"],
  ["ORD-10027", "2026-10-06", "Omar Yusuf",            "omar.y@gmail.com",          "Bose QuietComfort 45",           "BSE-QC45",       1,  1299,  1299, "Card",   "Delivered",         "Aramex",   "ARX-55512",      ""],
  ["ORD-10026", "2026-10-06", "Layla Nasser",          "layla.n@gmail.com",         "Samsung Galaxy S25",             "SAM-S25",        1,  2799,  2799, "Card",   "Delivered",         "Smsa",     "SMS-99341",      ""],
  ["ORD-10025", "2026-10-05", "Ravi Kumar",            "ravi.k@consulting.ae",      "MacBook Pro M4 14\"",            "APL-MBP-M4-14",  1,  9499,  9499, "Card",   "Delivered",         "DHL",      "DHL-21983",      ""],
  ["ORD-10024", "2026-10-05", "Mariam Al Qassim",      "mariam.q@gmail.com",        "Apple Watch Series 10 45mm",     "APL-WATCH-S10",  1,  1699,  1699, "Card",   "Delivered",         "Aramex",   "ARX-44321",      ""],
  ["ORD-10023", "2026-10-04", "Stefan Mueller",        "s.mueller@firm.de",         "Sony A7C II Camera Body",        "SNY-A7C2",       1,  7499,  7499, "Bank",   "Delivered",         "DHL",      "DHL-19872",      "International client — UAE address"],
  ["ORD-10022", "2026-10-04", "Zainab Al Hosni",       "zainab.h@gmail.com",        "iPad Air M2 11\"",               "APL-IPAIR-11",   2,  2299,  4598, "Card",   "Delivered",         "Fetchr",   "FTR-87231",      ""],
  ["ORD-10021", "2026-10-03", "Patrick O'Connor",      "p.oconnor@tech.ie",         "Dell XPS 15 Laptop",             "DEL-XPS15",      1,  7499,  7499, "Card",   "Delivered",         "Aramex",   "ARX-33109",      ""],
  ["ORD-10020", "2026-10-03", "Nadia Khalifah",        "nadia.k@hotmail.com",       "LG 65\" OLED evo TV",            "LG-OLED-65",     1,  6499,  6499, "Bank",   "Delivered",         "DHL",      "DHL-17654",      "White-glove delivery requested"],
  ["ORD-10019", "2026-10-02", "Hassan Al Farsi",       "hassan.f@gmail.com",        "iPhone 16 Pro 256GB",            "APL-IP16P",      1,  3999,  3999, "Card",   "Delivered",         "Smsa",     "SMS-88234",      ""],
  ["ORD-10018", "2026-10-02", "Jennifer Walsh",        "j.walsh@agency.com",        "Logitech MX Master 3S Mouse",    "LGT-MXMS3",      3,   399,  1197, "Card",   "Delivered",         "Aramex",   "ARX-22098",      ""],
  ["ORD-10017", "2026-10-01", "Tariq Al Balushi",      "tariq.b@gmail.com",         "Samsung Galaxy Tab S10+",        "SAM-TABS10P",    1,  2999,  2999, "Card",   "Delivered",         "Fetchr",   "FTR-76123",      ""],
  ["ORD-10016", "2026-10-01", "Chloe Dubois",          "c.dubois@fashion.ae",       "Apple AirPods Pro 2",            "APL-APP2",       2,   999,  1998, "Card",   "Delivered",         "Smsa",     "SMS-77651",      ""],

  // September 2026
  ["ORD-10015", "2026-09-30", "Ali Mahmoud",           "ali.m@gmail.com",           "MacBook Air M3 13\"",            "APL-MBA-M3-13",  1,  5299,  5299, "Card",   "Delivered",         "DHL",      "DHL-14521",      ""],
  ["ORD-10014", "2026-09-30", "Rohit Patel",           "rohit.p@it.ae",             "Lenovo ThinkPad X1 Carbon",      "LNV-X1C",        2,  8999, 17998, "Bank",   "Delivered",         "Aramex",   "ARX-11087",      "IT dept order"],
  ["ORD-10013", "2026-09-29", "Ayesha Rahman",         "ayesha.r@gmail.com",        "Dyson V15 Detect Vacuum",        "DYS-V15",        1,  2999,  2999, "Card",   "Delivered",         "Fetchr",   "FTR-65432",      ""],
  ["ORD-10012", "2026-09-29", "Lucas Fernandez",       "l.fernandez@media.ae",      "Canon EOS R6 Mark II",           "CAN-EOSR6M2",    1, 10999, 10999, "Bank",   "Delivered",         "DHL",      "DHL-13398",      ""],
  ["ORD-10011", "2026-09-28", "Mona Al Rashidi",       "mona.r@gmail.com",          "iPhone 16 Pro Max 512GB",        "APL-IP16PM-512", 1,  5299,  5299, "Card",   "Delivered",         "Smsa",     "SMS-66543",      ""],
  ["ORD-10010", "2026-09-28", "Kevin Thompson",        "k.thompson@logistics.ae",   "Samsung 85\" QLED TV",           "SAM-TV-85Q",     1,  7999,  7999, "Bank",   "Delivered",         "DHL",      "DHL-12211",      "Requires installation"],
  ["ORD-10009", "2026-09-27", "Amira Al Suwaidi",      "amira.s@gmail.com",         "Apple Watch Ultra 2",            "APL-WATCH-U2",   1,  3299,  3299, "Card",   "Delivered",         "Aramex",   "ARX-09876",      ""],
  ["ORD-10008", "2026-09-27", "Daniel Kim",            "d.kim@fintech.ae",          "iPad Pro 11\" M4 256GB",         "APL-IPADP-11",   4,  2999, 11996, "Bank",   "Delivered",         "DHL",      "DHL-11109",      "Team order"],
  ["ORD-10007", "2026-09-26", "Fatma Al Zadjali",      "fatma.z@gmail.com",         "Dyson Airwrap Styler",           "DYS-AIRWRAP",    1,  2199,  2199, "Card",   "Delivered",         "Fetchr",   "FTR-54321",      ""],
  ["ORD-10006", "2026-09-26", "Abdul Rahman Al Nuaimi","a.alnuaimi@invest.ae",      "MacBook Pro M4 14\"",            "APL-MBP-M4-14",  2,  9499, 18998, "Bank",   "Delivered",         "DHL",      "DHL-10087",      ""],
  ["ORD-10005", "2026-09-25", "Sophie Laurent",        "s.laurent@design.fr",       "LG 27\" 4K Monitor",             "LG-MON-27-4K",   4,  1849,  7396, "Card",   "Delivered",         "Aramex",   "ARX-08765",      "Studio setup"],
  ["ORD-10004", "2026-09-25", "Mohammed Al Kindi",     "m.alkindi@gmail.com",       "Samsung Galaxy S25 Ultra",       "SAM-S25U",       1,  4199,  4199, "Card",   "Delivered",         "Smsa",     "SMS-55432",      ""],
  ["ORD-10003", "2026-09-24", "Rina Tanaka",           "r.tanaka@jap.ae",           "Sony WH-1000XM5 Headphones",     "SNY-WH-XM5",     3,  1099,  3297, "Card",   "Delivered",         "DHL",      "DHL-09012",      ""],
  ["ORD-10002", "2026-09-24", "Ibrahim Al Siyabi",     "ibrahim.s@gmail.com",       "Dell XPS 15 Laptop",             "DEL-XPS15",      1,  7499,  7499, "Card",   "Delivered",         "Aramex",   "ARX-07654",      ""],
  ["ORD-10001", "2026-09-23", "Claire Thompson",       "c.thompson@gemsedu.ae",     "iPad Air M2 11\"",               "APL-IPAIR-11",   5,  2299, 11495, "Bank",   "Delivered",         "DHL",      "DHL-08123",      "School order"],
  ["ORD-09999", "2026-09-23", "Yasser Al Harthi",      "yasser.h@gmail.com",        "Apple AirPods Pro 2",            "APL-APP2",       1,   999,   999, "Card",   "Delivered",         "Fetchr",   "FTR-43210",      ""],
  ["ORD-09998", "2026-09-22", "Nina Volkova",          "n.volkova@trade.ae",        "Bose QuietComfort 45",           "BSE-QC45",       2,  1299,  2598, "Card",   "Delivered",         "Smsa",     "SMS-44321",      ""],
  ["ORD-09997", "2026-09-22", "Ahmad Al Ghafri",       "ahmad.g@gmail.com",         "Samsung Galaxy Tab S10+",        "SAM-TABS10P",    2,  2999,  5998, "Card",   "Delivered",         "Aramex",   "ARX-06543",      ""],
  ["ORD-09996", "2026-09-21", "Mark Johnson",          "m.johnson@corp.ae",         "Logitech MX Keys Combo",         "LGT-MXKEYS",    10,   699,  6990, "Bank",   "Delivered",         "DHL",      "DHL-07009",      "Office rollout — 10 units"],
  ["ORD-09995", "2026-09-21", "Hessa Al Mansouri",     "hessa.m@gmail.com",         "iPhone 16 Pro 256GB",            "APL-IP16P",      1,  3999,  3999, "Card",   "Delivered",         "Smsa",     "SMS-33210",      ""],
  ["ORD-09994", "2026-09-20", "Carlos Mendez",         "c.mendez@const.ae",         "Philips Hue Starter Kit",        "PHI-HUE-STR",    3,   599,  1797, "Card",   "Delivered",         "Fetchr",   "FTR-32109",      "Smart home setup"],
  ["ORD-09993", "2026-09-20", "Reem Al Blooshi",       "reem.b@hotmail.com",        "Apple Watch Series 10 45mm",     "APL-WATCH-S10",  1,  1699,  1699, "Card",   "Delivered",         "Aramex",   "ARX-05432",      ""],
  ["ORD-09992", "2026-09-19", "Faisal Al Shamsi",      "faisal.s@gmail.com",        "LG 65\" OLED evo TV",            "LG-OLED-65",     1,  6499,  6499, "Bank",   "Delivered",         "DHL",      "DHL-06012",      ""],
  ["ORD-09991", "2026-09-19", "Pooja Nair",            "p.nair@health.ae",          "Samsung Galaxy S25",             "SAM-S25",        2,  2799,  5598, "Card",   "Delivered",         "Smsa",     "SMS-22109",      ""],
  ["ORD-09990", "2026-09-18", "Bader Al Nuaimi",       "bader.n@gmail.com",         "Canon EOS R50 Camera",           "CAN-EOSR50",     1,  2499,  2499, "Card",   "Delivered",         "Fetchr",   "FTR-21098",      ""],
  ["ORD-09989", "2026-09-18", "Valentina Russo",       "v.russo@design.it",         "Sony A7C II Camera Body",        "SNY-A7C2",       1,  7499,  7499, "Bank",   "Delivered",         "DHL",      "DHL-05011",      ""],
  ["ORD-09988", "2026-09-17", "Nasser Al Harthy",      "nasser.h@gmail.com",        "MacBook Air M3 13\"",            "APL-MBA-M3-13",  1,  5299,  5299, "Card",   "Delivered",         "Aramex",   "ARX-04321",      ""],
  ["ORD-09987", "2026-09-17", "Anna Kowalski",         "a.kowalski@firm.pl",        "Jabra Evolve2 85 Headset",       "JAB-EV285",      4,  1399,  5596, "Bank",   "Delivered",         "DHL",      "DHL-04009",      "Remote work kits"],
  ["ORD-09986", "2026-09-16", "Mohammed Al Balushi",   "m.albalushi@gmail.com",     "iPad Pro 13\" M4 256GB",         "APL-IPADP-13",   1,  3999,  3999, "Card",   "Delivered",         "Smsa",     "SMS-11098",      ""],
  ["ORD-09985", "2026-09-16", "Sarah Al Dhaheri",      "sarah.d@gmail.com",         "Dyson V15 Detect Vacuum",        "DYS-V15",        1,  2999,  2999, "Card",   "Delivered",         "Fetchr",   "FTR-10987",      ""],
  ["ORD-09984", "2026-09-15", "James Park",            "j.park@bank.ae",            "Dell XPS 15 Laptop",             "DEL-XPS15",      3,  7499, 22497, "Bank",   "Delivered",         "DHL",      "DHL-03012",      "IT procurement"],
  ["ORD-09983", "2026-09-15", "Khadija Al Suwaidi",    "khadija.s@gmail.com",       "Apple AirPods Pro 2",            "APL-APP2",       2,   999,  1998, "Card",   "Delivered",         "Aramex",   "ARX-03210",      ""],
  ["ORD-09982", "2026-09-14", "Sven Lindqvist",        "s.lindqvist@nordic.ae",     "Logitech MX Master 3S Mouse",    "LGT-MXMS3",      5,   399,  1995, "Card",   "Delivered",         "Smsa",     "SMS-10087",      "Nordic office"],
  ["ORD-09981", "2026-09-14", "Khawla Al Rashdi",      "khawla.r@gmail.com",        "Samsung Galaxy S25 Ultra",       "SAM-S25U",       1,  4199,  4199, "Card",   "Delivered",         "Fetchr",   "FTR-09876",      ""],
  ["ORD-09980", "2026-09-13", "Thomas Brown",          "t.brown@logistics.ae",      "LG 27\" 4K Monitor",             "LG-MON-27-4K",   6,  1849, 11094, "Bank",   "Delivered",         "DHL",      "DHL-02011",      "Warehouse ops setup"],
  ["ORD-09979", "2026-09-13", "Marwa Al Kalbani",      "marwa.k@hotmail.com",       "iPhone 16 Pro Max 256GB",        "APL-IP16PM",     1,  4799,  4799, "Card",   "Delivered",         "Aramex",   "ARX-02109",      ""],
  ["ORD-09978", "2026-09-12", "Ahmad Nabil",           "ahmad.n@gmail.com",         "Bose SoundLink Max",             "BSE-SLM",        1,   999,   999, "Card",   "Delivered",         "Smsa",     "SMS-09076",      ""],
  ["ORD-09977", "2026-09-12", "Elena Petrova",         "e.petrova@media.ru",        "Canon EOS R6 Mark II",           "CAN-EOSR6M2",    1, 10999, 10999, "Bank",   "Delivered",         "DHL",      "DHL-01010",      "Videography project"],
  ["ORD-09976", "2026-09-11", "Yousef Al Mazrouei",    "yousef.m@gmail.com",        "Apple Watch Ultra 2",            "APL-WATCH-U2",   1,  3299,  3299, "Card",   "Delivered",         "Fetchr",   "FTR-08765",      ""],
  ["ORD-09975", "2026-09-11", "Meera Pillai",          "m.pillai@consult.ae",       "MacBook Pro M4 14\"",            "APL-MBP-M4-14",  1,  9499,  9499, "Card",   "Delivered",         "Aramex",   "ARX-01098",      ""],
  ["ORD-09974", "2026-09-10", "Khalid Al Rashid",      "khalid.r@gmail.com",        "Samsung 65\" QLED TV",           "SAM-TV-65Q",     1,  4299,  4299, "Bank",   "Delivered",         "DHL",      "DHL-00912",      ""],
  ["ORD-09973", "2026-09-10", "Amber Liu",             "a.liu@fintech.sg",          "iPad Air M2 11\"",               "APL-IPAIR-11",   1,  2299,  2299, "Card",   "Delivered",         "Smsa",     "SMS-08065",      ""],
  ["ORD-09972", "2026-09-09", "Nour Al Rawahi",        "nour.r@gmail.com",          "Dyson Airwrap Styler",           "DYS-AIRWRAP",    1,  2199,  2199, "Card",   "Delivered",         "Fetchr",   "FTR-07654",      ""],
  ["ORD-09971", "2026-09-09", "Peter Schneider",       "p.schneider@auto.de",       "Sony WH-1000XM5 Headphones",     "SNY-WH-XM5",     2,  1099,  2198, "Card",   "Delivered",         "Aramex",   "ARX-00987",      ""],
  ["ORD-09970", "2026-09-08", "Shamsa Al Qubaisi",     "shamsa.q@gmail.com",        "Apple AirPods Pro 2",            "APL-APP2",       1,   999,   999, "Card",   "Delivered",         "Smsa",     "SMS-07054",      ""],
  ["ORD-09969", "2026-09-08", "Ivan Petrov",           "i.petrov@trade.ae",         "Philips Hue Starter Kit",        "PHI-HUE-STR",    2,   599,  1198, "Card",   "Delivered",         "DHL",      "DHL-00801",      ""],
  ["ORD-09968", "2026-09-07", "Alya Al Hameli",        "alya.h@gmail.com",          "Samsung Galaxy Tab S10+",        "SAM-TABS10P",    1,  2999,  2999, "Card",   "Delivered",         "Fetchr",   "FTR-06543",      ""],
  ["ORD-09967", "2026-09-07", "Michael Foster",        "m.foster@consulting.ae",    "Dell XPS 15 Laptop",             "DEL-XPS15",      1,  7499,  7499, "Card",   "Delivered",         "Aramex",   "ARX-00876",      ""],
  ["ORD-09966", "2026-09-06", "Zahra Al Balushi",      "zahra.b@hotmail.com",       "iPhone 16 Pro 256GB",            "APL-IP16P",      1,  3999,  3999, "Card",   "Delivered",         "Smsa",     "SMS-06043",      ""],
  ["ORD-09965", "2026-09-06", "Ryan Nguyen",           "r.nguyen@startup.ae",       "Logitech MX Keys Combo",         "LGT-MXKEYS",     3,   699,  2097, "Card",   "Delivered",         "DHL",      "DHL-00712",      ""],

  // August 2026
  ["ORD-09964", "2026-08-31", "Badr Al Siyabi",        "badr.s@gmail.com",          "MacBook Air M3 15\"",            "APL-MBA-M3-15",  1,  6299,  6299, "Card",   "Delivered",         "Aramex",   "ARX-00765",      ""],
  ["ORD-09963", "2026-08-30", "Jasmine Al Farsi",      "jasmine.f@gmail.com",       "Apple Watch Series 10 45mm",     "APL-WATCH-S10",  2,  1699,  3398, "Card",   "Delivered",         "Fetchr",   "FTR-05432",      ""],
  ["ORD-09962", "2026-08-29", "Omar Al Makhawi",       "omar.m@gmail.com",          "Sony A7 IV Camera Body",         "SNY-A7IV",       1,  8999,  8999, "Bank",   "Delivered",         "DHL",      "DHL-00623",      ""],
  ["ORD-09961", "2026-08-28", "Isabella Rossi",        "i.rossi@fashion.it",        "Dyson Airwrap Styler",           "DYS-AIRWRAP",    2,  2199,  4398, "Card",   "Delivered",         "Smsa",     "SMS-05032",      ""],
  ["ORD-09960", "2026-08-27", "Hamad Al Kaabi",        "hamad.k@gmail.com",         "LG 65\" OLED evo TV",            "LG-OLED-65",     1,  6499,  6499, "Bank",   "Delivered",         "DHL",      "DHL-00534",      ""],
  ["ORD-09959", "2026-08-26", "Preet Virk",            "p.virk@tech.ae",            "iPad Pro 13\" M4 256GB",         "APL-IPADP-13",   2,  3999,  7998, "Card",   "Delivered",         "Aramex",   "ARX-00654",      ""],
  ["ORD-09958", "2026-08-25", "Dana Al Rumaithi",      "dana.r@gmail.com",          "Samsung Galaxy S25 Ultra",       "SAM-S25U",       1,  4199,  4199, "Card",   "Delivered",         "Fetchr",   "FTR-04321",      ""],
  ["ORD-09957", "2026-08-24", "Aleksei Morozov",       "a.morozov@bizz.ae",         "Jabra Evolve2 85 Headset",       "JAB-EV285",      6,  1399,  8394, "Bank",   "Delivered",         "DHL",      "DHL-00445",      "Remote work programme"],
  ["ORD-09956", "2026-08-23", "Hoor Al Nuaimi",        "hoor.n@gmail.com",          "iPhone 16 Pro Max 256GB",        "APL-IP16PM",     1,  4799,  4799, "Card",   "Delivered",         "Smsa",     "SMS-04021",      ""],
  ["ORD-09955", "2026-08-22", "Wei Zhang",             "w.zhang@import.ae",         "Logitech MX Master 3S Mouse",    "LGT-MXMS3",      8,   399,  3192, "Bank",   "Delivered",         "Aramex",   "ARX-00543",      "Bulk purchase"],
  ["ORD-09954", "2026-08-21", "Asma Al Dhaheri",       "asma.d@gmail.com",          "Apple AirPods Pro 2",            "APL-APP2",       1,   999,   999, "Card",   "Delivered",         "Fetchr",   "FTR-03210",      ""],
  ["ORD-09953", "2026-08-20", "Liam O'Brien",          "l.obrien@const.ae",         "Dell XPS 15 Laptop",             "DEL-XPS15",      2,  7499, 14998, "Bank",   "Delivered",         "DHL",      "DHL-00356",      ""],
  ["ORD-09952", "2026-08-19", "Munira Al Qassabi",     "munira.q@gmail.com",        "Dyson V15 Detect Vacuum",        "DYS-V15",        1,  2999,  2999, "Card",   "Delivered",         "Smsa",     "SMS-03010",      ""],
  ["ORD-09951", "2026-08-18", "Felix Wagner",          "f.wagner@auto.de",          "Canon EOS R6 Mark II",           "CAN-EOSR6M2",    1, 10999, 10999, "Bank",   "Delivered",         "DHL",      "DHL-00267",      ""],
  ["ORD-09950", "2026-08-17", "Shaikha Al Mansouri",   "shaikha.m@gmail.com",       "MacBook Pro M4 14\"",            "APL-MBP-M4-14",  1,  9499,  9499, "Card",   "Delivered",         "Aramex",   "ARX-00432",      ""],
  ["ORD-09949", "2026-08-16", "Tariq Hussain",         "tariq.h@gmail.com",         "Samsung 85\" QLED TV",           "SAM-TV-85Q",     1,  7999,  7999, "Bank",   "Delivered",         "DHL",      "DHL-00178",      "Installation included"],
  ["ORD-09948", "2026-08-15", "Sara Mitchell",         "sara.m@consulting.ae",      "iPad Air M2 11\"",               "APL-IPAIR-11",   3,  2299,  6897, "Card",   "Delivered",         "Fetchr",   "FTR-02109",      ""],
  ["ORD-09947", "2026-08-14", "Majed Al Falasi",       "majed.f@gmail.com",         "Bose QuietComfort 45",           "BSE-QC45",       2,  1299,  2598, "Card",   "Delivered",         "Smsa",     "SMS-02001",      ""],
  ["ORD-09946", "2026-08-13", "Katya Smirnova",        "k.smirnova@travel.ae",      "Apple Watch Ultra 2",            "APL-WATCH-U2",   1,  3299,  3299, "Card",   "Delivered",         "Aramex",   "ARX-00321",      ""],
  ["ORD-09945", "2026-08-12", "Sultan Al Shamsi",      "sultan.s@gmail.com",        "Sony WH-1000XM5 Headphones",     "SNY-WH-XM5",     1,  1099,  1099, "Card",   "Delivered",         "Fetchr",   "FTR-01098",      ""],
  ["ORD-09944", "2026-08-11", "Omar Al Rashid",        "omar.r@invest.ae",          "LG 27\" 4K Monitor",             "LG-MON-27-4K",   8,  1849, 14792, "Bank",   "Delivered",         "DHL",      "DHL-00089",      "Trading floor setup"],
  ["ORD-09943", "2026-08-10", "Nadia Al Farsi",        "nadia.f@gmail.com",         "iPhone 16 Pro 256GB",            "APL-IP16P",      2,  3999,  7998, "Card",   "Delivered",         "Smsa",     "SMS-01000",      ""],
  ["ORD-09942", "2026-08-09", "George Harris",         "g.harris@law.ae",           "Lenovo ThinkPad X1 Carbon",      "LNV-X1C",        3,  8999, 26997, "Bank",   "Delivered",         "DHL",      "DHL-00001",      "Legal firm procurement"],
  ["ORD-09941", "2026-08-08", "Hind Al Hosani",        "hind.h@gmail.com",          "Philips Hue Starter Kit",        "PHI-HUE-STR",    2,   599,  1198, "Card",   "Delivered",         "Aramex",   "ARX-00210",      ""],
  ["ORD-09940", "2026-08-07", "Brandon Taylor",        "b.taylor@media.ae",         "Sony A7C II Camera Body",        "SNY-A7C2",       1,  7499,  7499, "Bank",   "Delivered",         "DHL",      "DHL-00000",      "Production company"],
  ["ORD-09939", "2026-08-06", "Rawan Al Ameri",        "rawan.a@gmail.com",         "Samsung Galaxy Tab S10+",        "SAM-TABS10P",    1,  2999,  2999, "Card",   "Delivered",         "Fetchr",   "FTR-00987",      ""],
  ["ORD-09938", "2026-08-05", "Yusuf Al Lawati",       "yusuf.l@gmail.com",         "MacBook Air M3 13\"",            "APL-MBA-M3-13",  1,  5299,  5299, "Card",   "Delivered",         "Smsa",     "SMS-00900",      ""],
  ["ORD-09937", "2026-08-04", "Maria Gonzalez",        "m.gonzalez@hotel.ae",       "iPad Pro 11\" M4 256GB",         "APL-IPADP-11",  20,  2999, 59980, "Bank",   "Delivered",         "DHL",      "DHL-00099",      "Hotel chain — guest tablets"],
  ["ORD-09936", "2026-08-03", "Khalfan Al Naqbi",      "khalfan.n@gmail.com",       "Apple Watch Series 10 45mm",     "APL-WATCH-S10",  1,  1699,  1699, "Card",   "Delivered",         "Aramex",   "ARX-00109",      ""],
  ["ORD-09935", "2026-08-02", "Anna Schmidt",          "a.schmidt@bank.de",         "Logitech MX Keys Combo",         "LGT-MXKEYS",    15,   699, 10485, "Bank",   "Delivered",         "DHL",      "DHL-00011",      "Bank office refresh"],
  ["ORD-09934", "2026-08-01", "Eisa Al Muhairi",       "eisa.m@gmail.com",          "Samsung Galaxy S25 Ultra",       "SAM-S25U",       1,  4199,  4199, "Card",   "Delivered",         "Fetchr",   "FTR-00876",      ""],
];

const INVENTORY: (string | number)[][] = [
  ["SKU", "Product Name", "Category", "Brand", "In Stock", "Reserved", "Available", "Reorder Threshold", "Unit Cost (AED)", "Sell Price (AED)", "Margin %", "Supplier", "Lead Time (days)", "Warehouse Location", "Last Restocked", "Status", "Notes"],

  // Smartphones
  ["APL-IP16PM",     "iPhone 16 Pro Max 256GB",       "Smartphones",  "Apple",    12, 4,  8,  15, 3800, 4799, 21, "Apple MENA",      7,  "A1-S01", "2026-10-05", "OK",           ""],
  ["APL-IP16PM-512", "iPhone 16 Pro Max 512GB",       "Smartphones",  "Apple",     7, 2,  5,  10, 4200, 5299, 21, "Apple MENA",      7,  "A1-S02", "2026-10-05", "OK",           ""],
  ["APL-IP16P",      "iPhone 16 Pro 256GB",           "Smartphones",  "Apple",     8, 2,  6,  15, 3100, 3999, 22, "Apple MENA",      7,  "A1-S03", "2026-10-05", "OK",           ""],
  ["APL-IP16",       "iPhone 16 128GB",               "Smartphones",  "Apple",    19, 3, 16,  20, 2200, 2999, 27, "Apple MENA",      7,  "A1-S04", "2026-10-05", "OK",           ""],
  ["SAM-S25U",       "Samsung Galaxy S25 Ultra",      "Smartphones",  "Samsung",   6, 4,  2,  10, 3200, 4199, 24, "Samsung Gulf",    5,  "A2-S01", "2026-09-28", "LOW STOCK",    "Reorder placed 10 Oct"],
  ["SAM-S25",        "Samsung Galaxy S25",            "Smartphones",  "Samsung",  18, 3, 15,  10, 2100, 2799, 25, "Samsung Gulf",    5,  "A2-S02", "2026-09-28", "OK",           ""],
  ["SAM-S25P",       "Samsung Galaxy S25+",           "Smartphones",  "Samsung",  11, 1, 10,  10, 2600, 3399, 24, "Samsung Gulf",    5,  "A2-S03", "2026-09-28", "OK",           ""],
  ["HUW-P70P",       "Huawei Pura 70 Pro",            "Smartphones",  "Huawei",    5, 0,  5,   8, 2900, 3799, 24, "Huawei ME",       9,  "A3-S01", "2026-09-15", "OK",           ""],
  ["OPP-R9",         "OPPO Find X8 Pro",              "Smartphones",  "OPPO",      9, 1,  8,   8, 2400, 3199, 25, "OPPO Arabia",     7,  "A3-S02", "2026-09-20", "OK",           ""],
  ["GOO-PX9P",       "Google Pixel 9 Pro",            "Smartphones",  "Google",    4, 0,  4,   6, 2800, 3599, 22, "Google MENA",     10, "A3-S03", "2026-09-10", "LOW STOCK",    ""],

  // Tablets
  ["APL-IPADP-13",   "iPad Pro 13\" M4 256GB",        "Tablets",      "Apple",     5, 3,  2,   8, 3100, 3999, 22, "Apple MENA",      7,  "B1-T01", "2026-09-25", "LOW STOCK",    "Reorder in progress"],
  ["APL-IPADP-11",   "iPad Pro 11\" M4 256GB",        "Tablets",      "Apple",    14, 2, 12,   8, 2300, 2999, 23, "Apple MENA",      7,  "B1-T02", "2026-09-25", "OK",           ""],
  ["APL-IPAIR-11",   "iPad Air M2 11\"",              "Tablets",      "Apple",    21, 5, 16,  12, 1700, 2299, 26, "Apple MENA",      7,  "B1-T03", "2026-10-01", "OK",           ""],
  ["APL-IPADM-64",   "iPad Mini 7 64GB",              "Tablets",      "Apple",    16, 2, 14,  10, 1200, 1699, 29, "Apple MENA",      7,  "B1-T04", "2026-10-01", "OK",           ""],
  ["SAM-TABS10P",    "Samsung Galaxy Tab S10+",       "Tablets",      "Samsung",  13, 4,  9,  10, 2200, 2999, 27, "Samsung Gulf",    5,  "B2-T01", "2026-09-28", "OK",           ""],
  ["SAM-TABS10U",    "Samsung Galaxy Tab S10 Ultra",  "Tablets",      "Samsung",   7, 1,  6,   6, 3000, 3999, 25, "Samsung Gulf",    5,  "B2-T02", "2026-09-28", "OK",           ""],
  ["LNV-TABP12",     "Lenovo Tab P12 Pro",            "Tablets",      "Lenovo",    8, 0,  8,   5, 1400, 1999, 30, "Lenovo Arabia",   8,  "B3-T01", "2026-09-10", "OK",           ""],

  // Laptops
  ["APL-MBA-M3-15",  "MacBook Air M3 15\"",           "Laptops",      "Apple",     4, 1,  3,   8, 4900, 6299, 22, "Apple MENA",      10, "C1-L01", "2026-09-20", "LOW STOCK",    "Priority reorder"],
  ["APL-MBA-M3-13",  "MacBook Air M3 13\"",           "Laptops",      "Apple",    11, 2,  9,   8, 3800, 5299, 28, "Apple MENA",      10, "C1-L02", "2026-09-20", "OK",           ""],
  ["APL-MBP-M4-14",  "MacBook Pro M4 14\"",           "Laptops",      "Apple",     7, 0,  7,   5, 7500, 9499, 21, "Apple MENA",      10, "C1-L03", "2026-09-20", "OK",           ""],
  ["APL-MBP-M4-16",  "MacBook Pro M4 16\"",           "Laptops",      "Apple",     3, 0,  3,   4, 9500,11999, 21, "Apple MENA",      10, "C1-L04", "2026-09-20", "LOW STOCK",    ""],
  ["DEL-XPS15",      "Dell XPS 15 Laptop",            "Laptops",      "Dell",      9, 2,  7,   6, 5800, 7499, 23, "Dell Arabia",     8,  "C2-L01", "2026-09-15", "OK",           ""],
  ["DEL-XPS13",      "Dell XPS 13 Laptop",            "Laptops",      "Dell",     12, 1, 11,   6, 4200, 5799, 28, "Dell Arabia",     8,  "C2-L02", "2026-09-15", "OK",           ""],
  ["LNV-X1C",        "Lenovo ThinkPad X1 Carbon",     "Laptops",      "Lenovo",    6, 3,  3,   5, 7000, 8999, 22, "Lenovo Arabia",   8,  "C3-L01", "2026-09-10", "LOW STOCK",    "Corporate favourite"],
  ["MSI-GT76",       "MSI GT76 Gaming Laptop",        "Laptops",      "MSI",       5, 0,  5,   4, 7500, 9999, 25, "MSI ME",          12, "C4-L01", "2026-08-25", "OK",           ""],
  ["ASU-ROG-G16",    "ASUS ROG Zephyrus G16",         "Laptops",      "ASUS",      4, 1,  3,   4, 6800, 8999, 24, "ASUS Arabia",     10, "C4-L02", "2026-08-25", "LOW STOCK",    ""],

  // TVs & Displays
  ["SAM-TV-65Q",     "Samsung 65\" QLED TV",          "TVs",          "Samsung",   3, 1,  2,   5, 3200, 4299, 26, "Samsung Gulf",    12, "D1-V01", "2026-09-01", "LOW STOCK",    "High demand — reorder now"],
  ["SAM-TV-85Q",     "Samsung 85\" QLED TV",          "TVs",          "Samsung",   2, 0,  2,   3, 5800, 7999, 27, "Samsung Gulf",    12, "D1-V02", "2026-09-01", "LOW STOCK",    ""],
  ["SAM-TV-55Q",     "Samsung 55\" QLED TV",          "TVs",          "Samsung",  14, 2, 12,   8, 2300, 3199, 28, "Samsung Gulf",    12, "D1-V03", "2026-10-01", "OK",           ""],
  ["LG-OLED-65",     "LG 65\" OLED evo TV",           "TVs",          "LG",        6, 0,  6,   4, 4800, 6499, 26, "LG Electronics",  14, "D2-V01", "2026-09-15", "OK",           ""],
  ["LG-OLED-77",     "LG 77\" OLED evo TV",           "TVs",          "LG",        2, 0,  2,   3, 7500, 9999, 25, "LG Electronics",  14, "D2-V02", "2026-09-15", "LOW STOCK",    ""],
  ["SON-BRAVIA-65",  "Sony Bravia 65\" XR OLED",      "TVs",          "Sony",      4, 0,  4,   4, 5500, 7499, 27, "Sony Arabia",     12, "D3-V01", "2026-09-10", "OK",           ""],
  ["LG-MON-27-4K",   "LG 27\" 4K Monitor",            "Monitors",     "LG",       13, 4,  9,   8, 1300, 1849, 30, "LG Electronics",  7,  "D4-M01", "2026-10-01", "OK",           ""],
  ["SAM-MON-32-4K",  "Samsung 32\" 4K Curved Monitor","Monitors",     "Samsung",   8, 1,  7,   6, 1600, 2299, 30, "Samsung Gulf",    7,  "D4-M02", "2026-09-20", "OK",           ""],
  ["DEL-MON-27",     "Dell 27\" UltraSharp 4K",       "Monitors",     "Dell",      6, 2,  4,   5, 1800, 2499, 28, "Dell Arabia",     9,  "D4-M03", "2026-09-15", "OK",           ""],

  // Audio
  ["SNY-WH-XM5",     "Sony WH-1000XM5 Headphones",   "Audio",        "Sony",     22, 5, 17,  10,  750, 1099, 32, "Sony Arabia",     6,  "E1-A01", "2026-10-05", "OK",           ""],
  ["APL-APP2",       "Apple AirPods Pro 2",           "Audio",        "Apple",    34, 8, 26,  15,  680,  999, 32, "Apple MENA",      5,  "E1-A02", "2026-10-05", "OK",           ""],
  ["BSE-QC45",       "Bose QuietComfort 45",          "Audio",        "Bose",     11, 1, 10,   8,  900, 1299, 31, "Bose ME",         9,  "E2-A01", "2026-09-20", "OK",           ""],
  ["BSE-SLM",        "Bose SoundLink Max",            "Audio",        "Bose",      9, 0,  9,   6,  680,  999, 32, "Bose ME",         9,  "E2-A02", "2026-09-20", "OK",           ""],
  ["JAB-EV285",      "Jabra Evolve2 85 Headset",      "Audio",        "Jabra",     8, 0,  8,   5, 1000, 1399, 28, "GN Audio",        12, "E3-A01", "2026-09-15", "OK",           "Popular with remote workers"],
  ["SON-SRS-XG",     "Sony SRS-XG500 Speaker",        "Audio",        "Sony",      7, 1,  6,   5,  800, 1199, 33, "Sony Arabia",     7,  "E4-A01", "2026-09-10", "OK",           ""],
  ["MSH-STL-II",     "Marshall Stanmore III Speaker", "Audio",        "Marshall",  5, 0,  5,   4, 1100, 1599, 31, "Marshall ME",     14, "E4-A02", "2026-08-20", "OK",           ""],
  ["APL-HPMAX",      "Apple AirPods Max",             "Audio",        "Apple",     3, 1,  2,   5, 2200, 2999, 27, "Apple MENA",      7,  "E1-A03", "2026-09-01", "LOW STOCK",    ""],

  // Wearables
  ["APL-WATCH-U2",   "Apple Watch Ultra 2",           "Wearables",    "Apple",     2, 1,  1,   5, 2500, 3299, 24, "Apple MENA",      7,  "F1-W01", "2026-09-25", "CRITICAL",     "Only 1 available — urgent reorder"],
  ["APL-WATCH-S10",  "Apple Watch Series 10 45mm",    "Wearables",    "Apple",    15, 3, 12,   8, 1200, 1699, 29, "Apple MENA",      7,  "F1-W02", "2026-10-05", "OK",           ""],
  ["APL-WATCH-S10-41","Apple Watch Series 10 41mm",   "Wearables",    "Apple",    12, 2, 10,   8, 1100, 1549, 29, "Apple MENA",      7,  "F1-W03", "2026-10-05", "OK",           ""],
  ["SAM-WATCH-7",    "Samsung Galaxy Watch 7",        "Wearables",    "Samsung",  11, 1, 10,   6,  900, 1299, 31, "Samsung Gulf",    5,  "F2-W01", "2026-09-28", "OK",           ""],
  ["GAR-FEN7P",      "Garmin Fenix 7 Pro",            "Wearables",    "Garmin",    6, 0,  6,   4, 2200, 2999, 27, "Garmin ME",       14, "F3-W01", "2026-09-05", "OK",           "Popular with athletes"],
  ["FIT-CHRG6",      "Fitbit Charge 6",               "Wearables",    "Fitbit",    9, 0,  9,   5,  450,  699, 36, "Google MENA",     7,  "F4-W01", "2026-09-15", "OK",           ""],

  // Cameras
  ["SNY-A7IV",       "Sony A7 IV Camera Body",        "Cameras",      "Sony",      3, 1,  2,   3, 7000, 8999, 22, "Sony Arabia",     14, "G1-C01", "2026-09-01", "LOW STOCK",    ""],
  ["SNY-A7C2",       "Sony A7C II Camera Body",       "Cameras",      "Sony",      4, 1,  3,   3, 5800, 7499, 22, "Sony Arabia",     14, "G1-C02", "2026-09-01", "LOW STOCK",    ""],
  ["CAN-EOSR50",     "Canon EOS R50 Camera",          "Cameras",      "Canon",     7, 0,  7,   4, 1800, 2499, 28, "Canon Gulf",      10, "G2-C01", "2026-09-15", "OK",           ""],
  ["CAN-EOSR6M2",    "Canon EOS R6 Mark II",          "Cameras",      "Canon",     3, 1,  2,   3, 8500,10999, 23, "Canon Gulf",      10, "G2-C02", "2026-09-01", "LOW STOCK",    "Professional grade"],
  ["DJI-MINI4P",     "DJI Mini 4 Pro Drone",          "Cameras",      "DJI",       5, 0,  5,   4, 2800, 3799, 26, "DJI Arabia",      10, "G3-C01", "2026-09-10", "OK",           ""],
  ["GOPRo-H13",      "GoPro Hero 13 Black",           "Cameras",      "GoPro",     8, 1,  7,   5,  950, 1499, 37, "GoPro ME",        8,  "G4-C01", "2026-09-20", "OK",           ""],

  // Smart Home & Accessories
  ["PHI-HUE-STR",    "Philips Hue Starter Kit",       "Smart Home",   "Philips",  16, 2, 14,   8,  400,  599, 33, "Signify ME",      6,  "H1-SH01","2026-09-25", "OK",           ""],
  ["DYS-V15",        "Dyson V15 Detect Vacuum",       "Smart Home",   "Dyson",     6, 0,  6,   4, 2200, 2999, 27, "Dyson ME",        10, "H2-SH01","2026-09-20", "OK",           ""],
  ["DYS-AIRWRAP",    "Dyson Airwrap Styler",          "Smart Home",   "Dyson",     4, 2,  2,   5, 1600, 2199, 27, "Dyson ME",        10, "H2-SH02","2026-09-20", "LOW STOCK",    "High demand"],
  ["ANK-HUB-65W",    "Anker 65W USB-C Hub",           "Accessories",  "Anker",     0, 0,  0,  15,  160,  249, 36, "Anker Arabia",    5,  "H3-AC01","2026-08-01", "OUT OF STOCK", "Reorder pending approval"],
  ["LGT-MXKEYS",     "Logitech MX Keys Combo",        "Accessories",  "Logitech", 31, 5, 26,  12,  480,  699, 31, "Logitech ME",     5,  "H4-AC01","2026-10-05", "OK",           ""],
  ["LGT-MXMS3",      "Logitech MX Master 3S Mouse",  "Accessories",  "Logitech", 28, 3, 25,  10,  270,  399, 32, "Logitech ME",     5,  "H4-AC02","2026-10-05", "OK",           ""],
  ["BEL-KIN-MAGSAFE","Belkin MagSafe 3-in-1 Charger", "Accessories", "Belkin",   19, 2, 17,  10,  250,  399, 37, "Belkin ME",       6,  "H5-AC01","2026-09-25", "OK",           ""],
  ["APL-PENCIL-PRO", "Apple Pencil Pro",              "Accessories",  "Apple",    22, 4, 18,  10,  380,  549, 31, "Apple MENA",      5,  "H5-AC02","2026-10-05", "OK",           ""],
  ["SAM-SSD-T9",     "Samsung T9 2TB Portable SSD",   "Accessories",  "Samsung",  13, 1, 12,   8,  380,  549, 31, "Samsung Gulf",    5,  "H5-AC03","2026-09-25", "OK",           ""],
  ["WD-MY-PASS-4TB", "WD My Passport 4TB",            "Accessories",  "WD",       17, 0, 17,   8,  230,  349, 34, "WD Arabia",       6,  "H5-AC04","2026-09-20", "OK",           ""],
];

const PIPELINE: (string | number)[][] = [
  ["Lead ID", "Company", "Industry", "Contact", "Title", "Email", "Phone", "Deal Type", "Products Interested", "Est. Value (AED)", "Stage", "Probability %", "Last Contact", "Next Follow-up", "Owner", "Days in Stage", "Notes"],

  // Active deals
  ["B2B-041", "TechCorp Solutions",      "Technology",      "Ahmad Nasser",        "IT Director",       "a.nasser@techcorp.ae",       "+971 50 123 4567", "Bulk Order",          "MacBook Pro M4 x10, iPad Pro x20",              195000, "Proposal Sent",  60, "2026-10-11", "2026-10-14", "LEO",  3,  "Waiting on budget approval from CFO. Strong intent."],
  ["B2B-040", "Al Futtaim Retail",       "Retail",          "Sandra Williams",     "Head of Procurement","s.williams@alfuttaim.ae",   "+971 4 567 8901",  "Reseller Agreement",  "Mixed Apple & Samsung stock — monthly supply",   500000, "Negotiation",    75, "2026-10-12", "2026-10-15", "LEO",  5,  "Discussing volume discount tiers — 12% agreed, working on 15%"],
  ["B2B-039", "Dubai Government HQ",     "Government",      "Mohammed Al Marzouqi","Procurement Officer","m.marzouqi@gov.ae",          "+971 50 987 6543", "Tender",              "Dell XPS Laptops x50, LG Monitors x50",          450000, "Qualification",  40, "2026-10-10", "2026-10-16", "LEO",  8,  "RFQ received — submit formal quote by Oct 20. Compliance docs needed."],
  ["B2B-038", "Bloom Education Group",   "Education",       "Priya Krishnan",      "COO",               "p.krishnan@bloom.ae",        "+971 4 234 5678",  "Bulk Order",          "iPad Air x100, Apple Pencil x100",               380000, "Closed Won",    100, "2026-10-08", "",           "LEO",  0,  "PO received. Delivery scheduled Oct 18. Upsell warranty packages."],
  ["B2B-037", "Emirates NBD",            "Banking",         "Tariq Al Hamdan",     "VP Technology",     "t.hamdan@enbd.ae",           "+971 50 456 7890", "Corporate Account",   "iPhone 16 Pro x30, MacBook Air M3 x15",          285000, "Proposal Sent",  55, "2026-10-09", "2026-10-14", "LEO",  5,  "IT dept review ongoing. 2nd follow-up due. Decision by Oct 20."],
  ["B2B-036", "Majid Al Futtaim",        "Retail",          "Hessa Al Marri",      "Director of Ops",   "h.almarri@maf.ae",           "+971 4 890 1234",  "Bulk Order",          "Samsung 65\" QLED x10 (showroom display)",        42990, "Negotiation",    70, "2026-10-07", "2026-10-13", "LEO",  7,  "Wants 15% volume discount — max we can do is 10%. Escalating to manager."],
  ["B2B-035", "Careem",                  "Technology",      "Yusuf Ibrahim",       "Head of Ops",       "y.ibrahim@careem.com",       "+971 50 345 6789", "Bulk Order",          "iPhone 16 x50 (driver ops program)",             175000, "Qualification",  30, "2026-10-05", "2026-10-14", "LEO",  9,  "No response to last 2 emails. Call urgently — deal may go cold."],
  ["B2B-034", "GEMS Education",          "Education",       "Claire Thompson",     "Procurement Mgr",   "c.thompson@gemsedu.ae",      "+971 4 123 9999",  "Reseller",            "Mixed accessories + Chromebooks",                 95000, "Closed Lost",     0, "2026-10-01", "",           "LEO",  0,  "Went with competitor — better logistics terms. Follow up Q1 2027."],
  ["B2B-033", "Aldar Properties",        "Real Estate",     "Khalid Al Shamsi",    "IT Manager",        "k.alshamsi@aldar.ae",        "+971 50 678 9012", "Bulk Order",          "Dell XPS 15 x8, LG 27\" Monitor x16",            105992, "Proposal Sent",  50, "2026-10-06", "2026-10-13", "LEO",  8,  "Decision maker on leave until Oct 13. Follow up immediately on return."],
  ["B2B-032", "Noon.com",                "E-Commerce",      "Zara Al Azizi",       "VP Partnerships",   "z.alazizi@noon.com",         "+971 4 456 7890",  "Distribution Partner","Full Apple product line — monthly allocation",   1200000, "Qualification",  35, "2026-10-03", "2026-10-17", "LEO", 11,  "Huge opportunity. Legal reviewing partnership terms. Patience required."],
  ["B2B-031", "Etihad Airways",          "Aviation",        "James O'Brien",       "Fleet Manager",     "j.obrien@etihad.ae",         "+971 2 345 6789",  "Bulk Order",          "iPad Pro x25 (cabin crew program)",               99975, "Closed Won",    100, "2026-09-28", "",           "LEO",  0,  "Delivered. Follow up for accessories order and annual refresh."],
  ["B2B-030", "ADNOC",                   "Energy",          "Fatima Al Hosani",    "ICT Procurement",   "f.alhosani@adnoc.ae",        "+971 50 111 2222", "Tender",              "Ruggedised tablets + laptops x200",              800000, "Proposal Sent",  45, "2026-10-02", "2026-10-20", "LEO", 12,  "Formal tender submitted. Decision expected end of month. High value."],
  ["B2B-029", "Dubai Airports",          "Aviation",        "Mark Stevens",        "Operations Director","m.stevens@dubaiairports.ae", "+971 4 777 8899",  "Bulk Order",          "iPad Air x80, Samsung monitors x40",             312000, "Negotiation",    65, "2026-10-08", "2026-10-15", "LEO",  6,  "Strong interest. Negotiating SLA and warranty terms."],
  ["B2B-028", "du Telecom",              "Telecom",         "Layla Al Jasmi",      "Corporate Sales",   "l.aljasmi@du.ae",            "+971 50 222 3344", "Reseller Agreement",  "Samsung & Huawei handsets — large volume",       750000, "Negotiation",    60, "2026-10-05", "2026-10-12", "LEO",  9,  "Pricing finalised. Contract review stage. Close by Oct 20."],
  ["B2B-027", "Emaar Properties",        "Real Estate",     "Omar Bin Tariq",      "Facilities Director","o.bintariq@emaar.ae",        "+971 50 444 5566", "Bulk Order",          "Smart home devices — Hue, Dyson x50 units",      149500, "Proposal Sent",  50, "2026-09-30", "2026-10-14", "LEO", 14,  "New development fit-out. Waiting on interior design sign-off."],
  ["B2B-026", "Abu Dhabi Ports",         "Logistics",       "Tariq Al Hamili",     "IT Head",           "t.alhamili@adports.ae",      "+971 2 555 6677", "Bulk Order",           "Lenovo ThinkPads x30, Dell monitors x30",        402000, "Qualification",  35, "2026-09-28", "2026-10-15", "LEO", 16,  "Tender process — early stage. Relationship building."],
  ["B2B-025", "RAK Medical Centre",      "Healthcare",      "Dr Aisha Saeed",      "CTO",               "a.saeed@rakmedical.ae",      "+971 7 666 7788",  "Bulk Order",          "iPad Pro x15, MacBook Air x10",                  119985, "Proposal Sent",  55, "2026-10-01", "2026-10-13", "LEO", 13,  "Medical-grade protective cases required. Checking stock."],
  ["B2B-024", "Rotana Hotels",           "Hospitality",     "Sandra Habib",        "Procurement VP",    "s.habib@rotana.com",         "+971 4 888 9900",  "Bulk Order",          "iPad Mini x200 (in-room guest tablets)",          339800, "Negotiation",    70, "2026-10-10", "2026-10-16", "LEO",  4,  "Close to deal. Custom engraving requested — checking feasibility."],
  ["B2B-023", "First Abu Dhabi Bank",    "Banking",         "Rashed Al Qamzi",     "Head of Procurement","r.alqamzi@bankfab.ae",       "+971 2 999 0011",  "Corporate Account",   "MacBook Pro x20, iPhone 16 Pro x50",             474900, "Closed Won",    100, "2026-09-25", "",           "LEO",  0,  "PO signed. Delivery next week. 3-year support contract included."],
  ["B2B-022", "Jumeirah Group",          "Hospitality",     "William Tan",         "IT Director",       "w.tan@jumeirah.com",          "+971 4 333 4455",  "Bulk Order",          "Samsung QLED TVs x50 (suite upgrade)",            214950, "Proposal Sent",  45, "2026-09-20", "2026-10-14", "LEO", 24,  "Budget approval in progress. Key decision: Nov 1."],
  ["B2B-021", "G42",                     "Technology",      "Mohammed Al Dhaheri", "CTO",               "m.aldhaheri@g42.ai",         "+971 50 101 2020", "Bulk Order",          "MacBook Pro M4 x50, iPad Pro x30",               594650, "Negotiation",    75, "2026-10-12", "2026-10-17", "LEO",  2,  "Strategic account. High priority. CEO aligned."],
  ["B2B-020", "DEWA",                    "Utilities",       "Khalifa Al Suwaidi",  "ICT Manager",       "k.alsuwaidi@dewa.ae",        "+971 4 222 3333",  "Tender",              "Dell laptops x100, monitors x100",               949900, "Qualification",  30, "2026-09-15", "2026-10-20", "LEO", 29,  "Government tender process — long cycle expected."],
  ["B2B-019", "Majlis Grand Mercure",    "Hospitality",     "Faisal Al Amiri",     "GM",                "f.alamiri@accor.ae",         "+971 4 444 5566",  "Bulk Order",          "Sony Bravia TVs x30 (room upgrade)",              224970, "Closed Won",    100, "2026-09-10", "",           "LEO",  0,  "Delivered and installed. Ask for referral to sister properties."],
  ["B2B-018", "Chalhoub Group",          "Luxury Retail",   "Camille Fontaine",    "IT Director",       "c.fontaine@chalhoub.ae",     "+971 4 555 6677",  "Bulk Order",          "MacBook Air x30, iPhone 16 Pro x40",             348870, "Proposal Sent",  50, "2026-10-07", "2026-10-14", "LEO",  7,  "Fashion week timing — decision before Oct 20."],
  ["B2B-017", "DP World",               "Logistics",       "Sanjay Patel",        "Head of IT",        "s.patel@dpworld.com",        "+971 4 666 7788",  "Corporate Account",   "Panasonic rugged tablets x150",                  375000, "Qualification",  25, "2026-10-01", "2026-10-21", "LEO", 13,  "Need rugged/industrial spec. Checking with Panasonic distributor."],
  ["B2B-016", "Almarai",                "FMCG",            "Ahmed Al Tayer",      "IT Procurement",    "a.altayer@almarai.ae",       "+971 50 777 8899", "Bulk Order",          "iPad Air x60 (field sales)",                     137940, "Negotiation",    65, "2026-10-09", "2026-10-15", "LEO",  5,  "Pilot 5 units approved. Scale to 60 subject to pilot review Oct 20."],
  ["B2B-015", "Dubai Media City",        "Media",           "Reem Khalil",         "Operations Lead",   "r.khalil@dmc.ae",            "+971 4 888 9911",  "Bulk Order",          "Canon EOS R6 x5, Sony A7 x5, accessories",       119970, "Proposal Sent",  55, "2026-09-25", "2026-10-13", "LEO", 19,  "Production studio upgrade. Strong interest."],
  ["B2B-014", "Lulu Hypermarket",        "Retail",          "Biju Thomas",         "Electronics Buyer", "b.thomas@luluhyper.ae",      "+971 4 999 0022",  "Reseller",            "Mixed Samsung & LG consumer electronics",        2500000, "Negotiation",   80, "2026-10-11", "2026-10-18", "LEO",  3,  "Largest deal in pipeline. Volume rebate model. Legal reviewing contract."],
  ["B2B-013", "Mashreq Bank",            "Banking",         "Priya Menon",         "VP Technology",     "p.menon@mashreq.ae",         "+971 4 111 2233",  "Corporate Account",   "iPhone 16 Pro x60, MacBook Pro x20",             478000, "Proposal Sent",  60, "2026-10-04", "2026-10-14", "LEO", 10,  "Annual device refresh cycle. Competing with 2 other suppliers."],
  ["B2B-012", "Spinneys",               "Retail",          "David Harper",        "Head of IT",        "d.harper@spinneys.ae",       "+971 4 222 3344",  "Bulk Order",          "iPad POS systems x40, accessories",              119960, "Closed Won",    100, "2026-09-20", "",           "LEO",  0,  "Delivered. Follow up for protective cases and next year's refresh."],
  ["B2B-011", "Abu Dhabi Media",         "Media",           "Hana Al Mazrouei",    "Tech Director",     "h.almazrouei@adm.ae",        "+971 2 333 4455",  "Bulk Order",          "MacBook Pro x15, LG OLED monitors x10",          207485, "Negotiation",    70, "2026-10-08", "2026-10-16", "LEO",  6,  "Budget signed off. Negotiating extended warranty. Close this week."],
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema }) as any;

  console.log("🌱 ShopFlow Electronics — Expanding Google Sheets data\n");

  const token = await getValidToken(db);
  console.log("✓ Got valid access token\n");

  // Pull sheet IDs from business memories
  const memories = await db
    .select()
    .from(schema.businessMemories)
    .where(eq(schema.businessMemories.businessId, BUSINESS_ID));

  const ordersId   = extractSheetId(memories.find((m: any) => m.content.includes("shopflow_orders_sheet"))?.content ?? "");
  const inventoryId = extractSheetId(memories.find((m: any) => m.content.includes("shopflow_inventory_sheet"))?.content ?? "");
  const pipelineId  = extractSheetId(memories.find((m: any) => m.content.includes("shopflow_pipeline_sheet"))?.content ?? "");

  console.log(`Orders sheet:    ${ordersId}`);
  console.log(`Inventory sheet: ${inventoryId}`);
  console.log(`Pipeline sheet:  ${pipelineId}\n`);

  console.log(`Writing ${ORDERS.length - 1} orders...`);
  await clearAndWrite(token, ordersId, ORDERS);
  await formatHeader(token, ordersId);
  console.log("  ✓ Orders updated");

  console.log(`Writing ${INVENTORY.length - 1} inventory SKUs...`);
  await clearAndWrite(token, inventoryId, INVENTORY);
  await formatHeader(token, inventoryId);
  console.log("  ✓ Inventory updated");

  console.log(`Writing ${PIPELINE.length - 1} pipeline deals...`);
  await clearAndWrite(token, pipelineId, PIPELINE);
  await formatHeader(token, pipelineId);
  console.log("  ✓ Pipeline updated");

  console.log("\n✅ All sheets expanded with full demo data.");
  console.log(`  Orders:    ${ORDERS.length - 1} rows`);
  console.log(`  Inventory: ${INVENTORY.length - 1} SKUs across 8 categories`);
  console.log(`  Pipeline:  ${PIPELINE.length - 1} deals — AED ${(PIPELINE.slice(1).reduce((s: number, r) => s + (Number(r[9]) || 0), 0) / 1000000).toFixed(1)}M total pipeline`);

  await client.end();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
