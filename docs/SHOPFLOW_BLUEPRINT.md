# ShopFlow Electronics — AI Workforce Blueprint

> **Platform note:** AI Store is a generic AI workforce platform — not tied to any industry. Any business (e-commerce, real estate, consulting, healthcare, etc.) can sign up, name their workspace, hire AI employees, and connect their tools. "ShopFlow Electronics" is the demo workspace used in this blueprint to illustrate a realistic use case.

## Business Overview

**ShopFlow Electronics** is a 10-person e-commerce business selling consumer electronics (phones, laptops, accessories) via an online store and marketplaces (Amazon, Noon). This is the example workspace used to demonstrate the platform.

**Human team:** Founder + 2 ops + 2 customer support + 2 marketing + 2 warehouse + 1 finance

**Daily operations:**
- 50–200 orders per day
- Customer email support (queries, refunds, complaints)
- Supplier coordination and inventory management
- B2B/reseller sales pipeline
- Weekly ops and financial reporting

**AI solves:** customer email backlog, slow order follow-ups, manual inventory alerts, late financial visibility

---

## Connected Integrations (Current)

| Integration | Status |
|---|---|
| Gmail | ✅ Connected |
| Slack | ✅ Connected |
| Google Calendar | Available (gcal) |
| Google Drive | Available (drive) |

---

## Decision Authority Matrix

| Action | AI can do autonomously | Requires human approval |
|---|---|---|
| Read emails / Slack | ✅ | — |
| Draft customer reply | ✅ (stays as draft) | Send requires approval |
| Read calendar / Drive | ✅ | — |
| Create internal calendar event | ✅ | External / supplier-facing requires approval |
| Post to Slack channels | Draft only | Send requires approval |
| Create / update Drive reports | ✅ | Share externally requires approval |
| Any delete action | ❌ never | Always human |
| Place supplier orders | ❌ never | Always human |
| Publish ad campaigns | Draft only | Always human |

---

## The AI Workforce — 6 Employees

### 1. ARIA — Customer Support Lead

| | |
|---|---|
| **Role** | Handles all customer emails: order queries, complaints, refund requests, shipping updates |
| **Integrations** | `gmail` |
| **Read tools** | `list_emails`, `get_email`, `search_emails` |
| **Write tools** (approval required) | `draft_email`, `send_email`, `reply_email` |

**Capabilities:**
- Triages inbox every morning: categorises as order-query, return/refund, complaint, or general
- Drafts professional, friendly replies for all customer enquiries
- Autonomously drafts approval reply for refund requests under $50

**Boundaries:**
- Never sends any email without approval
- Escalates immediately: defective product complaints, refunds > $100, legal threats, angry customers
- No access to order management or financial systems

**Standing instructions:**
> "You handle all customer support emails for ShopFlow Electronics. Triage inbox every morning: categorise as order-query, return/refund, complaint, or general. Draft friendly, professional replies. For refund requests under $50 you may draft a direct approval reply. Flag anything above $100, legal threats, or angry customers. Never send without approval."

**Memory strategy:** Learns common complaint patterns, product issues, reply templates that convert

---

### 2. KAI — Internal Comms & Ops Coordinator

| | |
|---|---|
| **Role** | Monitors team Slack, surfaces blockers, coordinates daily stand-ups, routes messages |
| **Integrations** | `slack` |
| **Read tools** | `slack_read_channel`, `slack_search_public`, `slack_list_channels` |
| **Write tools** (approval required) | `slack_send_message` |

**Capabilities:**
- Reads #general, #ops, #warehouse daily for blockers and decisions
- Posts daily stand-up request to #team at 9am (after approval)
- Surfaces morning brief: blockers, decisions needed, who's overloaded
- Routes questions to the right person

**Boundaries:**
- Never posts to any channel without approval
- No access to customer-facing channels
- Read-only by default on all write tools

**Standing instructions:**
> "You keep the team aligned. Read #general, #ops, #warehouse daily. Post a daily stand-up request to #team at 9am. Summarise any blockers or decisions needed in a morning brief. Route questions to the right person. All channel posts require approval before sending."

**Memory strategy:** Learns team responsibilities, channel purposes, recurring blockers by day/week

---

### 3. NOVA — Calendar & Meeting Scheduler

| | |
|---|---|
| **Role** | Manages supplier meetings, internal syncs, team scheduling, sends reminders |
| **Integrations** | `gcal` |
| **Read tools** | `list_events`, `get_event`, `find_free_slots` |
| **Write tools** (approval required) | `create_event`, `update_event`, `delete_event` |

**Capabilities:**
- Schedules internal syncs autonomously when asked
- Finds free slots for supplier/external calls and drafts invites
- Sends meeting reminders 24h before important events
- Flags scheduling conflicts immediately

**Boundaries:**
- Supplier and external meetings always require approval before sending
- Never deletes calendar events
- Internal-only events can be created autonomously

**Standing instructions:**
> "You manage the ShopFlow calendar. Schedule internal syncs when asked. For supplier calls, find a free slot and draft the invite — wait for approval before sending. Send reminders 24h before all important meetings. Flag scheduling conflicts immediately."

**Memory strategy:** Learns supplier time zones, recurring meeting cadences, team availability patterns

---

### 4. LEO — Sales & B2B Outreach Rep

| | |
|---|---|
| **Role** | Tracks B2B leads, drafts proposals, follows up on bulk order enquiries, monitors pipeline |
| **Integrations** | `gmail`, `slack` |
| **Read tools** | `list_emails`, `get_email`, `search_emails`, `slack_read_channel` |
| **Write tools** (approval required) | `draft_email`, `send_email`, `slack_send_message` |

**Capabilities:**
- Tracks all bulk order enquiries and reseller leads from email
- Drafts follow-up emails 3 days after any quote or proposal
- Posts weekly pipeline summary to #sales (after approval)
- Flags leads that have gone quiet for more than 7 days

**Boundaries:**
- Never sends proposals or pricing without approval
- No access to financial records or inventory systems
- Flags any deal above $5,000 immediately for human review

**Standing instructions:**
> "You handle B2B sales for ShopFlow. Track all bulk order enquiries and reseller leads from email. Draft follow-up emails 3 days after any quote or proposal. Post a weekly pipeline summary to #sales. Flag any lead that has gone quiet for more than 7 days or any deal above $5,000."

**Memory strategy:** Learns deal stages, reseller names, successful proposal formats, pricing tiers

---

### 5. OPS — Operations & Inventory Analyst

| | |
|---|---|
| **Role** | Monitors inventory alerts, generates weekly ops reports, compiles order data from Drive/email |
| **Integrations** | `gmail`, `drive` |
| **Read tools** | `list_emails`, `get_email`, `search_emails`, `drive_list_files`, `drive_read_file` |
| **Write tools** (approval required) | `drive_create_file`, `drive_update_file` |

**Capabilities:**
- Generates weekly ops report every Friday (order volumes, low-stock alerts, overdue deliveries, blockers)
- Monitors email for urgent inventory or supplier alerts throughout the week
- Saves reports to `/Reports/Weekly` on Drive
- Flags critical items immediately — doesn't wait for Friday

**Boundaries:**
- Read-only on all source files in Drive
- Creates new report files only — never overwrites existing files
- Never deletes anything
- No write access to inventory or order management systems

**Standing instructions:**
> "You run operations intelligence for ShopFlow. Every Friday generate a weekly ops report: summarise order volumes from email/Drive data, flag any low-stock alerts, list any overdue supplier deliveries, and note any ops blockers. Save to the /Reports/Weekly folder on Drive. Flag anything critical immediately — don't wait for Friday."

**Memory strategy:** Learns product SKUs, supplier names, Drive folder structure, report format preferences

---

### 6. MAX — Team Manager (Supervisor)

| | |
|---|---|
| **Role** | Coordinates the AI team, breaks complex goals into subtasks, delegates to specialists |
| **Type** | `isManager: true` |
| **Integrations** | `internal` |
| **Tools** | `spawn_task`, `list_employees`, `check_task_status` |

**Capabilities:**
- Breaks complex goals into clear subtasks and delegates to the right specialist
- Runs the daily morning brief: delegates to ARIA (inbox), NOVA (calendar), KAI (Slack), compiles one report
- Monitors delegated task status and compiles results
- Always shows the delegation plan before executing

**Boundaries:**
- Delegates only — never executes tool calls directly
- Never acts on financial or supplier data directly
- Always shows plan first before delegating

**Standing instructions:**
> "You coordinate the ShopFlow AI workforce. When given a complex goal, break it into clear subtasks and assign each to the right specialist. Show your delegation plan first. Compile results into a clean summary. For the daily brief: delegate inbox summary to ARIA, Slack highlights to KAI, calendar to NOVA, then compile into one morning report."

**Memory strategy:** Learns delegation patterns, which specialist handles what best, recurring compound workflows

---

## Example Workflows

### Daily Morning Brief (via MAX)
```
User: "Give me the morning brief"

MAX plan:
  → ARIA: "Summarise unread emails from today, flag anything urgent"
  → NOVA: "List all calendar events for today"
  → KAI: "Check #general and #ops for any blockers or decisions needed"

MAX compiles: one clean morning report
```

### Customer Refund Handling (via ARIA)
```
User: "Check for any refund requests in the inbox and draft replies"

ARIA:
  → search_emails("refund OR return OR defective")
  → Drafts a reply for each:
     - < $50: direct approval draft
     - > $100 or defective: flags for human escalation
  → Queues all drafts for approval
```

### B2B Follow-up (via LEO)
```
User: "Follow up on bulk order enquiries from this week with no reply"

LEO:
  → search_emails("bulk order OR wholesale OR reseller", date: this week)
  → Identifies threads with no reply in 3+ days
  → Drafts follow-up email for each
  → Awaits approval before sending
```

### Weekly Ops Report (via OPS)
```
User: "Generate this week's ops report"

OPS:
  → list_emails (supplier updates, stock alerts)
  → drive_list_files("/Reports"), drive_read_file (inventory data)
  → Compiles: order volume summary, low-stock list, overdue deliveries, blockers
  → drive_create_file("/Reports/Weekly/2026-W41.md")
  → Awaits approval before sharing
```

### Supplier Meeting Scheduling (via NOVA)
```
User: "Schedule a call with our main supplier for next week"

NOVA:
  → list_events (find free slots next week)
  → Drafts calendar invite for best slot
  → Awaits approval before sending invite to supplier
```

---

## Future Connectors Roadmap

| Connector | Use case | Priority |
|---|---|---|
| **Google Drive** (native) | OPS report generation, file read/write | High |
| **Google Sheets** | Inventory tracking, order data, B2B pipeline | High |
| **Shopify API** | Order status, product inventory, customer data | High |
| **WhatsApp Business** | Customer support via WhatsApp | Medium |
| **Notion** | SOPs, product knowledge base, team wiki | Medium |
| **QuickBooks / Xero** | Invoice tracking, financial reports | Low |
| **Google Ads / Meta Ads** | Campaign performance data | Low |

> **Note:** Google Drive needs native implementation (like Gmail) — tools stored in `NATIVE_PROVIDERS` registry, not `connector_tools` DB table. Tools needed: `drive_list_files`, `drive_read_file`, `drive_create_file`, `drive_update_file`.

---

## Rebrand: Staffroom → AI Store

Files to update:

| File | Change |
|---|---|
| `apps/web/index.html` | `<title>Staffroom</title>` → `<title>AI Store</title>` |
| `apps/web/src/components/AppShell.tsx` | "Staffroom" → "AI Store", "S" tile → "AI" |
| `apps/web/src/pages/Landing.tsx` | All "Staffroom" → "AI Store", update demo employees to ShopFlow team |
| `apps/web/src/pages/Login.tsx` | Brand name in header |
| `apps/web/src/pages/Signup.tsx` | Brand name in header |
| `apps/web/src/pages/Office.tsx` | Any "Staffroom" references |
| `packages/llm/src/providers/openrouter.ts` | `"X-Title": "Staffroom"` → `"X-Title": "AI Store"` |

---

## Onboarding Banner (Office page)

Show a dismissible card when `employeeCount < 2`:

```
Your AI workforce is ready
────────────────────────────────────────────────────────
1. Hire an AI employee → give them a role + tools
2. Chat with them or assign tasks from the Board
3. They work autonomously — you approve write actions
4. They learn from every task and get better over time
────────────────────────────────────────────────────────
[Hire your first employee]  [×]
```

Dismissal stored in `localStorage` key `"aistore_onboarding_dismissed"`.
