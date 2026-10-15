# AI Workforce for Small Business — BRD

Oct 6, 2026 · @Muhammed Suhail Ea

## Overview

**Staffroom** (working name) lets a small business owner hire a team of five AI employees that work inside the tools the business already uses. Each employee has a name, a job, an access badge, a budget and a manager, and the owner manages them the way they would manage real staff.

**The problem.** A business with 2 to 20 people cannot afford an assistant, an operations analyst, a client success lead and a sales coordinator. The owner does all four jobs at night, and things slip: follow-ups go unsent, feedback goes unread, spreadsheets go stale.

**The vision.** The owner talks to one manager, sees every employee's work on one board, and approves anything that leaves the business. The employees do the work in between.

**One line:** hire an AI team, give them access, approve their work, review their performance.

This is a learning and portfolio project, built and published like a real product. It is not for sale, so pricing in the app is simulated.

## Goals and non-goals

The product goal is that an owner hands off real recurring work in the first week. The learning goal is that every core AI engineering concept appears in a place where it is genuinely needed.

**Product goals**

- An owner goes from sign-up to a first piece of finished work in under 10 minutes.
- Every action that leaves the business (email, message, shared file, CRM change) is approved by a human.
- The owner can see at any time what each employee did, why, and what it cost.

**Learning and portfolio goals**

- Cover the core concepts end to end: agent harness, tool calling, MCP, RBAC, background jobs, HITL, memory, RAG, multi-agent, guardrails, evals and observability.
- A public demo mode that anyone on LinkedIn can try without connecting real accounts.
- One LinkedIn post per milestone, each with a short screen recording.

**Non-goals**

- Billing, payments and real subscriptions. "Hiring" is simulated.
- Live phone calls in the first releases. Sales works from uploaded recordings and transcripts.
- Custom employees built by the owner. The five roles are fixed in v1.
- Mobile apps. The web app is responsive.
- Enterprise features: SSO, multi-region, large teams.

## Audience

The primary user is the owner of a service business with 2 to 20 people who sells to clients, runs on email, spreadsheets and calls, and has no operations staff. The secondary audience is LinkedIn viewers: hiring managers and engineers who watch the demo.

| Persona | Who they are | What they want from the team | What worries them |
| --- | --- | --- | --- |
| **Sara, agency owner** | Runs a 6-person marketing agency in Dubai, 15 active clients | Client feedback tracked and acted on, follow-ups never missed | An AI emailing a client something wrong |
| **Ahmed, consultant** | Solo IT consultant, many sales calls a week | Call notes, CRM updates and proposals done for him | Losing control of his pipeline data |
| **Priya, office manager** | Staff member Sara invites to help run the team | Approve routine work, check the docs employee's reports | Seeing financial data she should not see |
| **LinkedIn viewer** | Recruiter or engineer, 60 seconds of attention | To see something that works and looks real | Nothing; they scroll on if the demo is slow |

The app is designed for Sara first. If Sara can hire, onboard and trust the team in one sitting, the demo works for everyone else.

## The five employees

The team is five fixed roles: four specialists and one manager who coordinates them. Default names are below; the owner can rename any employee during hiring.

| Employee | Role | Daily work | Connects to | Needs owner approval for |
| --- | --- | --- | --- | --- |
| **Layla** | Personal Assistant | Inbox triage, morning brief, scheduling, reminders, reply drafts | Email, calendar | Sending any email, accepting or creating meetings with outsiders |
| **Omar** | Docs and Data | Keeps spreadsheets current, answers questions about the numbers, builds weekly reports, finds files | Drive / OneDrive, Sheets / Excel | Sharing a file outside the business, overwriting a sheet |
| **Maya** | Client Success | Collects feedback from email and forms, tags it by client and theme, flags unhappy clients, proposes an action plan | Email, feedback forms, task board | Replying to a client, creating tasks assigned to human staff |
| **Zayd** | Sales | Processes call recordings: summary, objections, next steps, CRM update, follow-up and proposal drafts | Recording upload, CRM, email | Sending follow-ups and proposals, changing a deal stage |
| **Noor** | Manager | Turns the owner's goals into tasks for the team, hands work between employees, resolves conflicts, writes the weekly team report | The other four employees, task board | Assigning work that crosses into a write action owned by another employee |

**How Noor works with the team.** The owner gives Noor a goal, such as "Client X is unhappy, fix it this week". Noor asks Maya for the feedback history, Omar for the account numbers and Zayd for the latest call notes. Noor then proposes a plan, and each step is carried out by the employee who owns it.

**Rule:** employees never borrow each other's access. Noor can ask Layla to draft an email, but Noor cannot read the inbox.

## Owner journey

The journey runs in five stages: discover, hire, onboard, first task, then daily use. The first three stages take under 10 minutes together.

**1. Discover (landing page)**

1. The owner lands on a page that shows the team as staff cards: photo-style avatar, name, role, a one-line job description.
2. Two buttons: **Hire your team** and **Try the demo company** (seeded fake business, no sign-up).

**2. Hire (sign-up and team setup)**

1. The owner signs up and names the business, its industry and team size.
2. The hiring screen shows each employee as a candidate profile: job description, skills, tools they need, sample work.
3. The owner hires all five or a subset (the Manager requires at least two others), renames anyone, and sets a monthly budget per employee.
4. A simulated "contract" screen confirms the team. No payment.

**3. Onboard (one employee at a time, like a first day)**

1. Each employee asks for its access badge: the PA asks to connect email and calendar, Omar asks for a Drive folder, and so on. The owner grants access per employee through OAuth.
2. Each employee asks three to five onboarding questions in chat: "Which clients are VIP?", "Who can I book meetings with without asking?", "Which spreadsheet is the source of truth for revenue?"
3. The answers become that employee's standing instructions, editable later on its profile page.
4. The owner can skip onboarding for any employee and come back later.

**4. First task (the moment the product proves itself)**

1. Noor proposes a first task for each employee, based on what was connected: "Layla: brief you on today's inbox", "Maya: summarise last month's client feedback".
2. The owner accepts. Work starts in the background and appears live on the board.
3. Within minutes the first result lands in the **Approvals** inbox or as a finished report.

**5. Daily use**

1. **Morning:** the owner opens the app to Noor's daily brief: what each employee did overnight, what needs approval, what is blocked.
2. **During the day:** the owner messages Noor or an employee directly, approves or edits drafts, and drops in call recordings for Zayd.
3. **Weekly:** Noor posts a team report, and each employee gets a performance card: tasks done, approvals rejected, cost, time saved.
4. **Anytime:** the owner can pause an employee, revoke a badge, change a budget, or let one go.

## How the app looks

The app should feel like a small office, not a chatbot: people, a task board and an inbox of things to sign. Visual direction is calm and professional, with one accent colour per employee so their work is recognisable everywhere.

**Layout.** A left sidebar lists the five employees with a status dot (working, idle, waiting for you, paused). The main area holds the selected screen. A top bar shows the approval count and today's total spend.

| Screen | What the owner sees | Main actions |
| --- | --- | --- |
| **Office (home)** | Noor's daily brief, a live activity feed ("Zayd updated the CRM for Acme"), approvals waiting, blocked tasks | Open an approval, message Noor |
| **Team board** | Kanban of tasks across all employees: Assigned, Working, Waiting for you, Done. Each card shows the employee's avatar | Create a task, reassign, cancel |
| **Approvals inbox** | Each pending action shown as a preview: the email as it will be sent, the sheet diff, the CRM change, with the employee's reason | Approve, edit then approve, reject with a note |
| **Employee profile** | Job description, standing instructions, access badges, memory (what it has learned), budget, performance card, work history | Edit instructions, revoke a badge, pause, let go |
| **Chat** | One thread with Noor plus one thread per employee. Answers show which tools were used and cite sources | Ask, assign, correct |
| **Run view** | The step-by-step trace of one task: thoughts summarised, tools called, results, cost, time | Stop the run, retry |
| **Hiring** | Candidate cards for each role, then the team summary and simulated contract | Hire, rename, set budget |
| **Settings** | Business profile, connected apps, human users and roles, audit log, data export and delete | Invite staff, disconnect apps, delete data |

**Signature moments for the demo:** the overnight brief appearing on the Office screen, an email draft waiting in Approvals with a clear reason, and a blocked prompt-injection attempt shown as a red card in the activity feed.

## Functional requirements

Requirements are grouped by area, and each has an ID for tracing into the system design. "Must" ships in the first public release; "Should" ships before the final demo.

| ID | Requirement | Priority |
| --- | --- | --- |
| **Hiring and team** |  |  |
| FR-01 | Owner can hire, rename, pause and let go of each of the five employees | Must |
| FR-02 | Owner sets a monthly budget per employee; work stops cleanly when it runs out, with a notice | Must |
| FR-03 | Each employee has editable standing instructions captured during onboarding | Must |
| **Access** |  |  |
| FR-04 | Owner grants each employee access to specific connected apps (email, calendar, drive, CRM), separately | Must |
| FR-05 | An employee can only use tools inside its own badge; requests outside it are refused and logged | Must |
| FR-06 | Owner can invite human staff with a role and revoke them | Should |
| **Work and tasks** |  |  |
| FR-07 | Owner can assign a task to any employee by chat or on the board | Must |
| FR-08 | Tasks run in the background, survive app restarts, and show live progress | Must |
| FR-09 | Scheduled work: Layla's morning brief, Maya's daily feedback sweep, Noor's weekly report | Must |
| FR-10 | Owner can stop any running task immediately | Must |
| FR-11 | Noor can break a goal into tasks for other employees and pass results between them | Must |
| **Approvals** |  |  |
| FR-12 | Every external action (send, share, CRM write, client reply) waits for owner approval | Must |
| FR-13 | Approvals show an exact preview, the reason, and allow edit before approval | Must |
| FR-14 | An approved action runs exactly once, even if clicked twice or retried after a failure | Must |
| FR-15 | Pending approvals expire after a set time and the task is marked stale | Should |
| FR-16 | Owner can create standing approval rules, such as "Layla may accept internal meetings" | Should |
| **Employee skills** |  |  |
| FR-17 | Layla: inbox triage with categories, morning brief, reply drafts, scheduling proposals | Must |
| FR-18 | Omar: answer questions about connected spreadsheets, update rows, weekly report | Must |
| FR-19 | Maya: collect and tag feedback by client and theme, flag at-risk clients, propose action plans | Must |
| FR-20 | Zayd: process an uploaded call recording into summary, objections, next steps and CRM update | Must |
| FR-21 | Answers that use business documents cite the source file or message | Must |
| FR-22 | Each employee remembers corrections and preferences and shows that memory on its profile | Should |
| **Visibility** |  |  |
| FR-23 | Every task has a run view: steps, tools used, cost and duration | Must |
| FR-24 | Weekly performance card per employee: tasks done, approval rejection rate, cost | Should |
| FR-25 | Full audit log of who did what, human or employee, filterable by employee | Must |
| **Demo** |  |  |
| FR-26 | Demo company with seeded fake inbox, sheets, clients and calls, resettable, no sign-up | Must |

## Roles and permissions

Permissions work on two layers: what each human can do, and what each AI employee can touch. An employee acting for a human can never do more than that human is allowed to do.

**Human roles**

| Role | Can do | Cannot do |
| --- | --- | --- |
| **Owner** | Everything: hire, budgets, badges, approvals, invite staff, delete data | Nothing restricted |
| **Admin** (e.g. office manager) | Assign tasks, approve routine actions, view reports | Change budgets, grant badges, see Omar's financial sheets unless shared |
| **Viewer** (e.g. accountant) | Read reports and the board | Approve, assign or chat with employees |

**Employee badges**

| Employee | Read | Write (always via approval) | Never |
| --- | --- | --- | --- |
| Layla | Email, calendar | Send email, create events | Drive files, CRM |
| Omar | Chosen Drive folders and sheets | Update sheets, share files | Email inbox |
| Maya | Feedback sources, client list | Client replies, tasks for humans | Financial sheets |
| Zayd | Uploaded calls, CRM | CRM updates, follow-up emails | Calendar, Drive |
| Noor | Task board, other employees' finished outputs | Assign tasks to employees | Any connected app directly |

**Two rules hold everywhere.** Effective access is the human's role intersected with the employee's badge. Content an employee reads from outside (emails, feedback, transcripts) can never grant it new access or trigger an action on its own.

## Non-functional requirements

These are product-level targets; how they are met belongs in the system design.

| Area | Requirement |
| --- | --- |
| **Security** | Connected-app tokens encrypted at rest, never shown in the UI, logs or prompts. Every tool call checked against the employee's badge. |
| **Untrusted content** | Emails, feedback, documents and transcripts are treated as data. A known injection test set is blocked before release. |
| **Privacy** | Business data is never used beyond the business that owns it. Owner can export or delete all data, including memory, search indexes and logs. UAE PDPL is the reference regime. |
| **Reliability** | A task survives a server restart and resumes. A failed connected app affects only the employee using it. |
| **Responsiveness** | First visible progress on a task within 3 seconds. Chat answers start streaming within 2 seconds. |
| **Cost** | Per-employee budget enforced, not just reported. Spend visible per task, employee and day. |
| **Quality** | Each skill has a test set; a release does not ship if a skill's score drops. |
| **Accessibility** | Keyboard navigable, readable contrast, works at mobile width. |

## Concept coverage

Every core concept from the AI engineering handbook has a product feature that needs it. Fine-tuning and model serving are the only gaps, by choice.

| Concept | Product feature that needs it | Handbook module |
| --- | --- | --- |
| Agent harness | Every employee's task run: steps, limits, stop, resume | M16 |
| Tool calling + structured output | Email drafts, sheet updates, CRM fields, feedback tags | M09, M16 |
| MCP | Connected apps per employee; one internal server for business data | M18 |
| RBAC | Human roles plus employee badges (FR-04 to FR-06) | M16, M25 |
| Background jobs | Scheduled briefs, feedback sweeps, call processing (FR-08, FR-09) | M11, M16 |
| Human in the loop | Approvals inbox (FR-12 to FR-16) | M16 |
| Memory | Standing instructions and learned preferences (FR-03, FR-22) | M17 |
| Multi-agent | Noor delegating and passing results (FR-11) | M18 |
| RAG | Cited answers over files, feedback and call notes (FR-21) | M19, M20 |
| Data questions | Omar answering questions over sheets (FR-18) | M22 |
| Speech to text | Zayd's call recordings (FR-20) | M10, M21 |
| Security + guardrails | Untrusted inputs, approval rules, budget stops | M23, M24 |
| Gateway, routing, cost | Per-employee budgets, cheap vs strong model per task | M12, M32 |
| Evals | Skill test sets and performance cards (FR-24) | M13, M14 |
| Observability | Run view and audit log (FR-23, FR-25) | M15 |
| LLMOps | Changing an employee's instructions or model without breaking it | M33 |

## Release scope

The product ships in four releases, each usable on its own and each ending in a LinkedIn post with a demo clip.

| Release | What the owner gets | LinkedIn story |
| --- | --- | --- |
| **R1: First hire** | Hiring flow, Layla only, approvals inbox, demo company | "I hired my first AI employee" |
| **R2: The specialists** | Omar, Maya and Zayd; badges per employee; scheduled work | "Three employees, three access badges, nothing leaves without my approval" |
| **R3: The manager** | Noor, team board, handoffs between employees, weekly report | "My AI manager runs the team" |
| **R4: Trust** | Performance cards, run view, injection defence shown in the feed, budgets enforced | "How I made AI employees safe to trust" |

**Demo mode** ships in R1 and grows with each release. It uses a seeded fictional business: an inbox of about 40 emails, 3 spreadsheets, 10 clients with feedback, and 4 call recordings. One email carries a prompt-injection attempt so viewers can watch it get blocked. The demo resets nightly.

## Success metrics

Success is measured in the demo company and in your own use, since there are no paying customers.

| Metric | Target |
| --- | --- |
| Time from sign-up to first finished task | Under 10 minutes |
| Approvals accepted without edits | 70% or more |
| Layla triage accuracy on the test inbox | 90% or more |
| Zayd CRM fields extracted correctly per call | 90% or more |
| Injection test set blocked | 100% |
| Actions executed twice | Zero |
| Average cost per task | Shown per employee; target set after R1 |
| Demo visitors who finish one task | Tracked from R1 |

## Risks

The biggest risk is scope: five employees is five products. Releases are ordered so each one is complete before the next starts.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Scope too big; project stalls mid-way | High | Four releases, each publishable alone; Layla first |
| An employee sends something wrong to a client | High | Approval on every external action; preview with exact content |
| Injection through an email or feedback form | High | Untrusted-content rule; blocked attempts shown in the feed |
| Google and Microsoft OAuth review limits for real accounts | Medium | Demo company for public use; real accounts for personal testing only |
| Noor adds cost and confusion instead of value | Medium | Noor only coordinates; R3 must show a task one employee alone could not do |
| Overlap with Anvil and Personal Ops Assistant | Medium | Decide whether Layla replaces the Personal Ops project (open decision) |
| LLM cost during demo traffic | Low | Per-employee budgets; cheap model by default in demo mode |

## Open decisions

These are product decisions to settle before the system design starts.

- [ ] Product name (Staffroom is a working name)
- [ ] Does Layla replace the Personal Ops Assistant project, or stay thin here?
- [ ] Google Workspace, Microsoft 365, or both for the first release
- [ ] Which CRM to connect for Zayd, or a built-in simple CRM
- [ ] Where client feedback comes from: email only, or also a form the business shares
- [ ] Whether owners can chat with employees directly, or only through Noor
- [ ] Default employee names and avatar style
