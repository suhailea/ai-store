# Staffroom — UI Rules for Coding Agents

Source of truth for building the Staffroom web app (AI Workforce for Small Business). Follow these rules exactly. When something is not covered here, choose the most standard, quiet option and stay consistent with existing screens.

**Stack assumptions:** React + TypeScript, Tailwind or plain CSS using the CSS variables below. Icons: `lucide-react`. Fonts: Plus Jakarta Sans + JetBrains Mono (Google Fonts).

---

## 1. Non-negotiable rules

1. **No decorative animation.** Allowed motion: the loading spinner, and `120ms` transitions on `color`, `background-color`, `border-color` only. No slide-ins, fades on mount, bounces, scale on hover, animated counters, or skeleton shimmer.
2. **Modern standard UI.** Clean cards, clear hierarchy, conventional patterns (sidebar + top bar + content). No experimental layouts.
3. **Light icons.** Icons default to `--icon` (#8a94a6) beside a label, `--sidebar-icon` on the dark sidebar, or an accent colour on a light tint tile. Use `--icon-strong` only for icon-only buttons.
4. **Dark branding on white.** Page background is white (`--surface`). Brand is deep petrol: `--brand-900` sidebar, `--primary` for primary actions, links, active tabs and focus.
5. **Fixed type scale.** Only use the text styles in §3. Never invent font sizes.
6. **Comfortable line heights.** Body 14/20, headings per §3. Never `line-height: 1` on text.
7. **Same skeleton on every page** (§6): AppShell → PageHeader with breadcrumbs → summary row → body grid of Cards.
8. **Structured layout.** Everything sits in a grid; spacing only from the 4px scale (§4). No magic numbers.
9. **Always implement loader, breadcrumbs, empty, error and disabled states** (§9).
10. **Standard icon sizes only:** 14 / 16 / 20 / 24px. Stroke width `1.75`.
11. **No AI-design tropes:** no gradients, no glassmorphism, no emoji in UI, no coloured left-border stripes on cards, no purple-blue glow.
12. **Use tokens, never hex values in components.** Every colour, space, radius and shadow comes from a CSS variable.

---

## 2. Colour

White-first. One dark brand colour, one attention colour (amber), status colours as soft tint + ink, and one accent per AI employee.

### Rules
- Page and card background: `--surface`. Quiet fills (board columns, table headers, card footers, hover rows): `--surface-subtle`.
- Text: `--ink` (headings, body), `--ink-secondary` (table cells, descriptions), `--ink-muted` (meta, timestamps, helper text, placeholders).
- **Exactly one primary button per view** (`--primary` fill, `--on-primary` text).
- `--accent` (amber) means **"Waiting for you"** only: approvals counter, waiting status dot, waiting badges. Text on amber fill is `--brand-900`.
- Status = soft background + ink: `--success`/`--success-soft`, `--warning`/`--warning-soft`, `--danger`/`--danger-soft`, `--info`/`--info-soft`. Always pair colour with a word or icon.
- Employee accents (`--emp-*` + `--emp-*-soft`) only for that employee's avatar, icon tiles and tags — never for buttons or status.
- Borders: `--line` for cards/dividers (decorative), `--control-border` for inputs/checkboxes (meets 3:1).
- Contrast: text ≥ 4.5:1, icons/borders/focus ≥ 3:1. All text tokens are verified on `--surface` and `--surface-subtle`.

### Colour tokens
| Token | Value | Use |
| --- | --- | --- |
| `--surface` | `#ffffff` | Page and card background. The app is white-first: content, cards, modals, inputs. |
| `--surface-subtle` | `#f7f8fa` | Quiet fills: board columns, table headers, read-only fields, hover rows. |
| `--surface-sunken` | `#eef1f4` | Pressed rows, skeleton blocks, progress tracks. |
| `--line` | `#e4e7ec` | Hairlines: card borders, dividers, table rules. Decorative, never the only edge of a control. |
| `--line-strong` | `#d0d5dd` | Stronger dividers and the dashed border of drop zones. |
| `--control-border` | `#8a94a6` | Input, select, checkbox and secondary-button borders on surface (3.06:1). |
| `--ink` | `#101828` | Headings and body text on surface, surface-subtle and every *-soft tint. |
| `--ink-secondary` | `#475467` | Secondary text, table cells, descriptions, on surface and surface-subtle (7.2:1). |
| `--ink-muted` | `#667085` | Metadata, timestamps, helper text, placeholders, on surface and surface-subtle (4.7:1+). |
| `--icon` | `#8a94a6` | Default light icon colour on surface: nav, inputs, meta rows (3.06:1). Icons sit beside a label. |
| `--icon-strong` | `#475467` | Icons that carry meaning alone (icon-only buttons) on surface. |
| `--brand-900` | `#0b2530` | Brand ink: sidebar background, logo tile, dark headers. Text on it is sidebar-ink or white. |
| `--brand-800` | `#123642` | Sidebar hover and the active-item fill. |
| `--brand-700` | `#17404d` | Sidebar selected item; borders inside the sidebar. |
| `--primary` | `#0f5b6c` | Primary action fill, links, selected tab, focus ring; as text on surface or primary-soft (7.7:1). |
| `--primary-hover` | `#0b4a58` | Hover and pressed state of primary fills. |
| `--primary-soft` | `#e6f2f4` | Tinted background behind primary text and light primary icons; selected rows. |
| `--on-primary` | `#ffffff` | Text and icons on primary and brand fills. |
| `--sidebar-ink` | `#c9d6dc` | Nav labels on brand-900 (10.7:1) and brand-700 (7.5:1). |
| `--sidebar-icon` | `#8fb0bb` | Light nav icons and section labels on brand-900 (6.9:1). |
| `--accent` | `#f2a93b` | Attention: the approvals counter and 'waiting for you'. A fill only; text on it is brand-900. |
| `--accent-soft` | `#fef4e4` | Background of waiting-for-you cards and banners. |
| `--success` | `#157f4f` | Done, approved, working; as text on surface or success-soft. |
| `--success-soft` | `#e8f6ee` | Background of success badges and banners. |
| `--warning` | `#b45309` | Due soon, budget near limit, stale; as text on surface or warning-soft. |
| `--warning-soft` | `#fef4e4` | Background of warning badges and banners. |
| `--danger` | `#c0362c` | Rejected, blocked, injection attempts, destructive buttons; as text on surface or danger-soft. |
| `--danger-soft` | `#fdecea` | Background of danger badges and the blocked-attempt card. |
| `--info` | `#1d63c8` | Informational badges and notes; as text on surface or info-soft. |
| `--info-soft` | `#eaf1fc` | Background of info badges and banners. |
| `--status-working` | `#22a06b` | Status dot: employee is running a task (always with a label). |
| `--status-idle` | `#98a2b3` | Status dot: employee is idle. |
| `--status-waiting` | `#f2a93b` | Status dot: employee is waiting for the owner. |
| `--status-paused` | `#667085` | Status dot: employee is paused. |
| `--emp-layla` | `#b4366a` | Layla (Personal Assistant) accent: avatar, task-card stripe, text on emp-layla-soft. |
| `--emp-layla-soft` | `#fcebf2` | Layla's light tint: avatar ground, icon tiles. |
| `--emp-omar` | `#2f62c9` | Omar (Docs and Data) accent. |
| `--emp-omar-soft` | `#eaf0fc` | Omar's light tint. |
| `--emp-maya` | `#17774f` | Maya (Client Success) accent. |
| `--emp-maya-soft` | `#e6f5ee` | Maya's light tint. |
| `--emp-zayd` | `#a84c0a` | Zayd (Sales) accent. |
| `--emp-zayd-soft` | `#fdf0e6` | Zayd's light tint. |
| `--emp-noor` | `#5e4bc4` | Noor (Manager) accent. |
| `--emp-noor-soft` | `#efedfb` | Noor's light tint. |
| `--focus-ring` | `var(--primary)` | Keyboard focus: 2px solid ring, 2px offset in the page colour. |
| `--link` | `var(--primary)` | Inline links. |
| `--overlay` | `rgba(16, 24, 40, 0.48)` | Modal and drawer backdrop. |

### Employees
| Employee | Role | Accent | Tint |
| --- | --- | --- | --- |
| Noor | Manager | `--emp-noor` | `--emp-noor-soft` |
| Layla | Personal Assistant | `--emp-layla` | `--emp-layla-soft` |
| Omar | Docs and Data | `--emp-omar` | `--emp-omar-soft` |
| Maya | Client Success | `--emp-maya` | `--emp-maya-soft` |
| Zayd | Sales | `--emp-zayd` | `--emp-zayd-soft` |

Employee avatar = initial in `--emp-x` on a `--emp-x-soft` circle. Human avatar = initials in white on `--brand-900`.

---

## 3. Typography

- **Sans:** `"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` — all UI text.
- **Mono:** `"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace` — costs (`$0.04`), task IDs (`T-1284`), tool names (`board.assign`), run timestamps.
- Load: `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap`
- Base: `body { font: 400 14px/20px var(--font-sans); color: var(--ink); -webkit-font-smoothing: antialiased; }`

| Style | Family | Size | Line height | Weight | Letter spacing | Use |
| --- | --- | --- | --- | --- | --- | --- |
| `display` | sans | 30px | 38px | 700 | -0.02em | Landing and empty hero titles only. |
| `h1` | sans | 24px | 32px | 700 | -0.01em | Page title in PageHeader, one per page. |
| `h2` | sans | 18px | 28px | 600 | 0 | Section and modal titles. |
| `h3` | sans | 15px | 22px | 600 | 0 | Card titles, column titles, task titles. |
| `body-lg` | sans | 16px | 24px | 400 | 0 | Lead paragraphs, brief summaries. |
| `body` | sans | 14px | 20px | 400 | 0 | Default UI text, table cells, form inputs. |
| `body-strong` | sans | 14px | 20px | 600 | 0 | Labels, button text, emphasis. |
| `small` | sans | 13px | 18px | 400 | 0 | Helper text, metadata, secondary rows. |
| `caption` | sans | 12px | 16px | 500 | 0 | Badges, timestamps, chart labels. |
| `overline` | sans | 11px | 16px | 600 | 0.06em | Uppercase section labels in sidebar and cards. |
| `mono` | mono | 13px | 20px | 500 | 0 | Costs, task IDs, run steps, tool names. |
| `stat` | sans | 28px | 36px | 600 | -0.02em | KPI numbers in StatCard. |

### Weight rules
- 400: body text. 500: nav items, tabs, badges, labels in meta. 600: titles, buttons, form labels, table emphasis. 700: `h1`, `display`, logo only.
- One `h1` per page (inside PageHeader). Modal and section titles are `h2`. Card, column and task titles are `h3`.
- Overline = 11/16, 600, uppercase, `letter-spacing: 0.06em`, `--ink-muted`. Table headers: 12/16, 600, uppercase, `0.04em`.
- Sentence case everywhere (not Title Case). Numbers: tabular feel via mono where they are costs/IDs.

---

## 4. Spacing, radius, elevation, sizes

4px base grid. Use only these values.

### Spacing
| Token | Value | Use |
| --- | --- | --- |
| `--space-1` | `4px` | Icon-to-label gap, badge padding. |
| `--space-2` | `8px` | Gaps inside controls and small stacks. |
| `--space-3` | `12px` | Card internal stacks, list rows. |
| `--space-4` | `16px` | Card padding (compact), form field gaps. |
| `--space-5` | `20px` | Card padding (default). |
| `--space-6` | `24px` | Page gutter, gaps between cards. |
| `--space-8` | `32px` | Between page sections. |
| `--space-10` | `40px` | Page top padding on wide screens. |
| `--space-12` | `48px` | Empty-state padding. |

**Standard applications**
- Page padding: `24px` top, `32px` left/right, `40px` bottom. Content max width `--content-max` (1280px); board and wide tables are full width.
- Gap between page blocks and between cards: `--space-6` (24px). Gap between stat cards: `--space-4`.
- Card header padding: `16px 20px`; card body: `20px`; card footer: `12px 20px`.
- Form fields stacked: `--space-4`. Label → input: `6px`. Input → helper text: `6px`.
- Icon → label gap: `--space-2` (8px) in buttons/nav, `--space-1` (4px) in badges.

### Radius
| Token | Value | Use |
| --- | --- | --- |
| `--radius-sm` | `6px` | Badges, checkboxes, small buttons, kbd. |
| `--radius-md` | `8px` | Buttons, inputs, menu items, task cards. |
| `--radius-lg` | `12px` | Cards, modals, board columns. |
| `--radius-full` | `9999px` | Avatars, status dots, pills, switches. |

### Shadows
| Token | Value | Use |
| --- | --- | --- |
| `--shadow-xs` | `0 1px 2px rgba(16, 24, 40, 0.05)` | Cards, inputs, task cards at rest. |
| `--shadow-sm` | `0 1px 3px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04)` | Hovered task card, dropdowns. |
| `--shadow-lg` | `0 12px 24px -4px rgba(16, 24, 40, 0.12), 0 4px 8px -2px rgba(16, 24, 40, 0.06)` | Modals, popovers, toasts. |

Cards are border (`1px solid var(--line)`) + `--shadow-xs`. Never stack heavy shadows.

### Sizes
| Token | Value | Use |
| --- | --- | --- |
| `--icon-xs` | `14px` | Icons inside badges and captions. |
| `--icon-sm` | `16px` | Default icon in buttons, inputs, nav, tables. |
| `--icon-md` | `20px` | Icon tiles, page-header actions, empty states inline. |
| `--icon-lg` | `24px` | Empty-state and stat-card icons. |
| `--control-sm` | `32px` | Small buttons, inline table actions. |
| `--control-md` | `38px` | Default button, input and select height. |
| `--control-lg` | `44px` | Primary actions in forms and modals footers on touch. |
| `--sidebar-width` | `248px` | App sidebar width. |
| `--topbar-height` | `60px` | App top bar height. |
| `--content-max` | `1280px` | Max width of page content. |

### Z-index
| Token | Value | Use |
| --- | --- | --- |
| `--z-sticky` | `10` | Top bar, sticky table headers. |
| `--z-overlay` | `40` | Modal backdrop. |
| `--z-modal` | `50` | Modals and drawers. |
| `--z-toast` | `60` | Toasts. |

---

## 5. Iconography

- Library: **Lucide** (`lucide-react`), outline, `strokeWidth={1.75}`.
- Sizes: `xs` 14px (inside badges/captions), `sm` 16px (**default** — buttons, inputs, nav, tables, meta), `md` 20px (icon tiles, modal header), `lg` 24px (empty states, large tiles).
- Colour: `--icon` next to text; `--sidebar-icon` on sidebar (active item: white); `--icon-strong` in icon-only buttons; accent colour inside a tinted tile.
- **Icon tile** (used in card headers, stat cards, empty states): 36×36 (`48×48` large), `radius-md`, soft tint background + matching ink icon, e.g. `--primary-soft` + `--primary`.
- Icon-only buttons always have `aria-label` and a tooltip/title.
- Common mapping: Office `layout-dashboard`, Board `square-kanban`, Approvals `circle-check`, Chat `message-square`, Team `users`, Settings `settings`, Email `mail`, Calendar `calendar`, Sheets `file-spreadsheet`, Drive `folder`, CRM `database`, Recording `mic`, Budget `wallet`, Blocked `shield-alert`, Access `key-round`, Memory `brain`, Time `clock`.

---

## 6. Layout — page skeleton (every screen)

```
┌──────────────┬────────────────────────────────────────────────────────┐
│ Sidebar 248  │ Topbar 60 (sticky): search ⌘K · Approvals [4] · Today $1.84/$10 · bell · user │
│ brand-900    ├────────────────────────────────────────────────────────┤
│ Logo         │ PageHeader: Breadcrumbs → h1 → description   [secondary][primary] │
│ Business     │ Summary row: 4 × StatCard  (or filter toolbar)          │
│ Nav (6)      │ Body grid of Cards:                                     │
│ EMPLOYEES    │   main 2fr + side 1fr | list 380px + detail | 3-col grid │
│ 5 + status   │                                                         │
│ Hire (foot)  │                                                         │
└──────────────┴────────────────────────────────────────────────────────┘
```

- **Sidebar** (`--brand-900`, width 248): logo, business switcher, nav: Office, Team board, Approvals (amber count), Chat, Team, Settings; section "EMPLOYEES" with avatar + name + role + status dot; "Hire or rehire" at bottom. Nav item 38px high, `radius-md`, hover `--brand-800`, active `--brand-700` + white text.
- **Topbar** (white, bottom border `--line`, sticky, `--z-sticky`).
- **PageHeader**: breadcrumbs (first crumb with home icon, last crumb not a link, `aria-current="page"`), `h1`, one-line description in `--ink-muted`, actions right-aligned (max one primary, primary last).
- **Grids**: `grid-4` for KPIs; `grid-main` = `minmax(0,2fr) minmax(300px,1fr)`; `grid-split` = `minmax(300px,380px) minmax(0,1fr)`; `grid-3` for cards. All with `align-items: start` (cards never stretch to fill).
- **Responsive**: < 1100px → grids collapse to 1 col (KPIs 2 col); < 760px → sidebar hidden (use a menu button), KPIs 1 col, form rows 1 col, page padding 16px.

### Screens and their structure
| Screen | Route | Structure |
| --- | --- | --- |
| Office (dashboard) | `/` | 4 KPIs → main: Noor's daily brief, Live activity · side: Approvals (3 items), Team status, budget alert |
| Team board | `/board` | Filter toolbar (search, employee, tool, avatar filters) → 4 columns: Assigned, Working, Waiting for you, Done |
| Approvals | `/approvals` | Tabs (Pending/Approved/Rejected/Expired) → split: list of approvals · ApprovalCard detail |
| Team | `/team` | Tabs (AI employees/People) → 3-col EmployeeCards → People table |
| Employee profile | `/team/:id` | Header with xl avatar + status + actions → tabs → 4 KPIs → main: instructions, recent work · side: budget, access badge, memory, details |
| Task / run view | `/tasks/:id` | Header with status, owner, Stop/Retry → tabs → main: run timeline · side: details, cost |
| Create task | modal on `/board` | Modal lg: title, assignee radio cards, details, due/priority, spend cap, schedule switch |
| Hire employee | `/hire/:role` | 4-step progress → Card with FormSections → footer Back / Skip / Continue |
| Invite staff, Approval rule | modals in Settings | Modal md with fields + info/warning alert |

---

## 7. Components (spec)

### Button
| Variant | Style | Use |
| --- | --- | --- |
| primary | `--primary` bg, white text, `shadow-xs`; hover `--primary-hover` | The one main action |
| secondary | white bg, `1px --line-strong`, `--ink` text | Default |
| ghost | transparent, `--ink-secondary`; hover `--surface-subtle` | Low emphasis, card headers |
| danger | `--danger` bg, white | Stop run, Let go, Delete |
| dark | `--brand-900` bg, white | Marketing CTA only |

Heights: sm 32 / md 38 / lg 44. Padding x: 12 / 16 / 20. Font 14px 600 (sm 13px). Radius `radius-md`. Icon 16px, gap 8px. Loading: spinner replaces icon, button disabled, label in present tense ("Approving…"). Disabled: `opacity: .55`, `cursor: not-allowed`. Labels: verb first, sentence case, 1–3 words.

### Inputs (TextField, TextArea, Select)
- Height 38, padding x 12, `1px solid --control-border`, `radius-md`, white, `shadow-xs`, 14/20.
- Label above: 13/18, 600, `--ink`. Required marker `*` in `--danger`. "Optional" right-aligned 12px `--ink-muted`.
- Helper below: 12/16 `--ink-muted`. Error replaces helper: 12/16 `--danger` with `circle-x` icon; border `--danger`; `aria-invalid`.
- Focus: border `--primary` + 2px `--primary-soft` outline.
- Leading icon 16px `--icon`; suffix unit in `--ink-muted` (e.g. "USD / month").
- Select: native `<select>`, chevron icon right 12px.
- Checkbox 18px, `radius-sm`; checked = `--primary` fill. Switch 36×20 track (for settings that apply instantly). Radio cards for choices that need a description; selected = `--primary` border + `--primary-soft` bg.
- Long forms → full page with **FormSection** (left 280px: h3 + description; right: fields). Short create flows → **Modal**.

### Card
White, `1px --line`, `radius-lg`, `shadow-xs`. Header: icon tile + title (h3) + subtitle (13/18 muted) + actions. Body padding 20 (or 0 for lists/tables). Footer `--surface-subtle`.

### StatCard
Label 13/18 500 `--ink-secondary` · icon tile top-right · value 28/36 600 · foot 12/16 (delta in success/danger with trend icon + hint in muted).

### Badge
Height 22, padding x 8, `radius-sm`, 12/16 500, soft tint + ink. Optional 6px dot or 14px icon. Fixed vocabulary: Assigned, Working, Waiting for you (accent + dot), Done (success + check), Blocked (danger + lock), Paused, Idle, Expires in Xh (warning + clock), Read (info), Write · via approval (accent).

### Status dot
8px circle: working `--status-working`, idle `--status-idle`, waiting `--status-waiting`, paused = hollow ring `--status-paused`. Always with visible label or `aria`/title text.

### Avatar
Sizes xs 22 / sm 30 / md 36 / lg 48 / xl 64. Status dot 12px at bottom-right with 2px white ring.

### Breadcrumbs
13/18, `--ink-muted` links, `--ink` 500 current page, `chevron-right` 14px separators, home icon on first item. Present on every page.

### Tabs
Underline tabs, 40px high, 14px 500 `--ink-muted`; active `--primary` 600 with 2px bottom border. Count pill 20px high.

### Table
Header: `--surface-subtle`, 12/16 uppercase 600 `--ink-muted`, padding 10×16. Rows: 14/20 `--ink-secondary`, padding 12×16, `1px --line` rules, hover `--surface-subtle`. IDs and money in mono, money right-aligned. Loading → 3 skeleton rows. Empty → compact EmptyState. Pagination in footer.

### Modal
Overlay `--overlay`. Widths sm 440 / md 560 / lg 720. Header: icon tile + h2 + description + close. Body padding 24, fields gap 16. Footer `--surface-subtle`, actions right-aligned, primary last. Esc closes; focus trapped; returns focus to trigger.

### Toast
380px, bottom-right, `shadow-lg`, auto-dismiss 5s, no slide animation. For results only — decisions use Alerts/Modals.

### Alert
Inline banner, `radius-md`, padding 12×16, soft tint bg, icon 16px. Tones: info (tips), success (after action), warning (budget, expiry), danger (blocked, failed).

### Domain components
- **TaskCard**: ID (mono, muted) + badges → title (14/20 600) → optional "Handed off by Noor" → progress bar when working → footer: employee chip, tool, cost (mono), due. Blocked = `--danger-soft` bg + `--danger` border. Selected = `--primary` ring. No coloured stripe.
- **BoardColumn**: `--surface-subtle` bg, `radius-lg`, header with 8px colour dot, title, count, add button.
- **ApprovalCard**: header (kind icon tile in employee tint, title, "requested by", ID, "Expires in" badge) → "Why {employee} wants to do this" box → **Exact preview** (email with To/Subject/body, or field diff table: old in danger-soft strikethrough, new in success-soft) → Sources chips → footer: Reject with note (ghost) · spacer · Edit, then approve (secondary) · Approve (primary). After approving: success alert "Approved and sent once".
- **ActivityItem**: avatar + title (bold employee name) + detail + meta (badge + time). **Blocked injection** variant: `--danger-soft` card with `--danger` border, shield-alert icon, says what was attempted and "No action taken".
- **BriefCard** (Noor's daily brief): summary 16/24, then one row per employee: chip · what happened · badge.
- **EmployeeCard**: lg avatar + status, name, role, status label, one-line job, tool badges, 2 stats, BudgetMeter, Message/Profile buttons. Paused = `--surface-subtle` bg.
- **AccessBadge**: tool icon tile, tool name, Read / Write · via approval / No access, Connected badge or Connect button.
- **RunStep / Timeline**: 32px circular marker (primary-soft; running = spinner; pending = muted; failed = danger) on a 1px vertical line; title, tool name in mono code chip, cost + time right; detail box `--surface-subtle`.
- **BudgetMeter / ProgressBar**: 6px track `--surface-sunken`, fill `--primary`; auto `--warning` at ≥75%, `--danger` at ≥90% with "Near limit" badge.

---

## 8. Content & copy

- Sentence case. Verb-first buttons: "Approve", "Edit, then approve", "Reject with note", "Assign task", "Hire employee", "Stop run".
- Address the owner as "you". Employees explain in first person ("I did not send it on my own").
- Name employees, never "the AI" / "the agent".
- Concrete numbers: "$0.04", "Expires in 22h", "37 emails". 24-hour time "07:30". Dates "Thu 8 Oct".
- Fixed status words: Assigned, Working, Waiting for you, Done, Blocked, Paused, Idle.
- Empty states: true title ("You're all caught up") + one sentence + one action.
- Errors say what is affected ("Gmail disconnected — only Layla is affected").

---

## 9. States (required on every screen)

| State | Implementation |
| --- | --- |
| Loading (page/section) | Skeleton blocks shaped like the content, rendered immediately (static `--surface-sunken`, no shimmer). PageLoader (32px spinner + label) only for a whole section. Never a blank screen. First visible feedback < 3s. |
| Loading (action) | Spinner inside the triggering button, button disabled, label "Approving…". Other actions in the same group disabled. |
| Empty | EmptyState: 48px icon tile, h3 title, 13px description, optional action. |
| Error | Danger Alert inline with what failed + a recovery action ("Reconnect"). |
| Blocked / security | Danger card in activity feed; Blocked badge on task. |
| Disabled | `opacity .55`, `cursor: not-allowed`, keep tooltip explaining why. |
| Hover | Colour change only (bg/border), 120ms. |
| Focus | `outline: 2px solid var(--focus-ring); outline-offset: 2px;` on every interactive element (`:focus-visible`). |
| Selected | `--primary-soft` bg (lists) or `--primary` ring (cards). |

---

## 10. Accessibility

- Keyboard navigable; logical tab order; visible focus ring everywhere.
- Every icon-only button has `aria-label`; decorative icons `aria-hidden`.
- Status never conveyed by colour alone (dot + label, badge + word/icon).
- Modals: `role="dialog"`, `aria-modal`, labelled by title, focus trap, Esc to close.
- Breadcrumbs in `<nav aria-label="Breadcrumb">` with `<ol>`; tabs use `role="tablist"` / `role="tab"` / `aria-selected`.
- Progress bars: `role="progressbar"` with `aria-valuenow/min/max`.
- Spinners: `role="status"` with an `aria-label`.
- Respect `prefers-reduced-motion` (slow the spinner).
- Works at mobile width (sidebar collapses, single column).

---

## 11. CSS variables (copy into `globals.css`)

```css
:root {
  --surface: #ffffff;
  --surface-subtle: #f7f8fa;
  --surface-sunken: #eef1f4;
  --line: #e4e7ec;
  --line-strong: #d0d5dd;
  --control-border: #8a94a6;
  --ink: #101828;
  --ink-secondary: #475467;
  --ink-muted: #667085;
  --icon: #8a94a6;
  --icon-strong: #475467;
  --brand-900: #0b2530;
  --brand-800: #123642;
  --brand-700: #17404d;
  --primary: #0f5b6c;
  --primary-hover: #0b4a58;
  --primary-soft: #e6f2f4;
  --on-primary: #ffffff;
  --sidebar-ink: #c9d6dc;
  --sidebar-icon: #8fb0bb;
  --accent: #f2a93b;
  --accent-soft: #fef4e4;
  --success: #157f4f;
  --success-soft: #e8f6ee;
  --warning: #b45309;
  --warning-soft: #fef4e4;
  --danger: #c0362c;
  --danger-soft: #fdecea;
  --info: #1d63c8;
  --info-soft: #eaf1fc;
  --status-working: #22a06b;
  --status-idle: #98a2b3;
  --status-waiting: #f2a93b;
  --status-paused: #667085;
  --emp-layla: #b4366a;
  --emp-layla-soft: #fcebf2;
  --emp-omar: #2f62c9;
  --emp-omar-soft: #eaf0fc;
  --emp-maya: #17774f;
  --emp-maya-soft: #e6f5ee;
  --emp-zayd: #a84c0a;
  --emp-zayd-soft: #fdf0e6;
  --emp-noor: #5e4bc4;
  --emp-noor-soft: #efedfb;
  --focus-ring: var(--primary);
  --link: var(--primary);
  --overlay: rgba(16, 24, 40, 0.48);
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
  --shadow-xs: 0 1px 2px rgba(16, 24, 40, 0.05);
  --shadow-sm: 0 1px 3px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04);
  --shadow-lg: 0 12px 24px -4px rgba(16, 24, 40, 0.12), 0 4px 8px -2px rgba(16, 24, 40, 0.06);
  --icon-xs: 14px;
  --icon-sm: 16px;
  --icon-md: 20px;
  --icon-lg: 24px;
  --control-sm: 32px;
  --control-md: 38px;
  --control-lg: 44px;
  --sidebar-width: 248px;
  --topbar-height: 60px;
  --content-max: 1280px;
  --z-sticky: 10;
  --z-overlay: 40;
  --z-modal: 50;
  --z-toast: 60;
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --text-display: 700 30px/38px var(--font-sans);
  --text-h1: 700 24px/32px var(--font-sans);
  --text-h2: 600 18px/28px var(--font-sans);
  --text-h3: 600 15px/22px var(--font-sans);
  --text-body-lg: 400 16px/24px var(--font-sans);
  --text-body: 400 14px/20px var(--font-sans);
  --text-body-strong: 600 14px/20px var(--font-sans);
  --text-small: 400 13px/18px var(--font-sans);
  --text-caption: 500 12px/16px var(--font-sans);
  --text-overline: 600 11px/16px var(--font-sans);
  --text-mono: 500 13px/20px var(--font-mono);
  --text-stat: 600 28px/36px var(--font-sans);
}
```

Tailwind: map these in `theme.extend` (e.g. `colors.primary = 'var(--primary)'`, `spacing['4'] = 'var(--space-4)'`, `borderRadius.lg = 'var(--radius-lg)'`) and do not use Tailwind's default palette in components.

---

## 12. Do / Don't

| Do | Don't |
| --- | --- |
| White surfaces, petrol brand, amber only for "waiting for you" | Gradients, glass effects, neon glows |
| Light icons at 14/16/20/24px, stroke 1.75 | Random icon sizes or filled/duotone mixes |
| One primary button per view | Two primary buttons side by side |
| Breadcrumbs + h1 on every page | Pages without a header or title |
| Skeletons + button spinners | Full-screen spinners, shimmer, fade-in animations |
| Tokens for every value | Hard-coded hex, px values off the 4px grid |
| Cards aligned to a grid, `align-items: start` | Stretched cards with empty space |
| Employee colour for identity only | Employee colours on buttons or status |
| Exact previews in approvals | Hiding what an action will do |
