import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { getDb, employees, badges, memories, employeeToolGrants, connectorTools, connectorAccounts } from "@staffroom/db";
import { requireAuth } from "../middleware/auth";
import { requireOwner } from "../middleware/owner";
import { newId } from "../lib/id";
import { isNativeProvider, getNativeToolDefs } from "../agent/tools/index";
import type { AppEnv } from "../lib/types";

export const employeeRoutes = new Hono<AppEnv>();

employeeRoutes.use("*", requireAuth);

const hireSchema = z.object({
  displayName: z.string().min(1),
  roleDescription: z.string().min(1),
  integrations: z.array(z.enum(["gmail", "gcal", "drive", "crm", "upload", "internal", "slack"])),
  budgetMonthlyUsd: z.number().positive(),
  isManager: z.boolean().default(false),
  instructions: z.record(z.string()).default({}),
  toolGrants: z.array(z.object({
    provider: z.string().min(1),
    toolName: z.string().min(1),
  })).default([]),
  llmProvider: z.enum(["anthropic", "deepseek", "ollama", "openrouter"]).nullable().optional(),
  llmModel: z.string().nullable().optional(),
});

const onboardingSchema = z.object({
  answers: z.record(z.string()),
});

// List employees for the business
employeeRoutes.get("/", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();

  const rows = await db
    .select()
    .from(employees)
    .where(eq(employees.businessId, businessId));

  return c.json({ ok: true, data: rows });
});

// Hire a new employee
employeeRoutes.post("/", requireOwner, zValidator("json", hireSchema), async (c) => {
  const { businessId } = c.get("user");
  const body = c.req.valid("json");
  const db = getDb();

  // Tool access is explicit: an integration badge never grants every tool.
  const providerIntegrations: Record<string, string> = {
    gmail: "gmail",
    google_calendar: "gcal",
    google_drive: "drive",
    hubspot: "crm",
  };
  if (body.isManager && body.toolGrants.length > 0) {
    return c.json({ ok: false, error: "Managers delegate to employees and cannot receive external tool grants." }, 422);
  }
  const grants = [...new Map(body.toolGrants.map((g) => [JSON.stringify([g.provider, g.toolName]), g])).values()];
  for (const grant of grants) {
    if (!body.integrations.includes(providerIntegrations[grant.provider] as typeof body.integrations[number])) {
      return c.json({ ok: false, error: `Select the integration for "${grant.provider}" before granting its tools.` }, 422);
    }
    const [tool] = await db.select({ id: connectorTools.id }).from(connectorTools)
      .innerJoin(connectorAccounts, and(
        eq(connectorAccounts.businessId, connectorTools.businessId),
        eq(connectorAccounts.provider, connectorTools.provider)
      ))
      .where(and(
        eq(connectorTools.businessId, businessId),
        eq(connectorTools.provider, grant.provider),
        eq(connectorTools.toolName, grant.toolName)
      )).limit(1);
    if (!tool) {
      return c.json({ ok: false, error: `Tool "${grant.toolName}" is unavailable. Reconnect or refresh "${grant.provider}" and try again.` }, 422);
    }
  }

  // Save the employee and selected grants together so hiring cannot partially succeed.
  const employee = await db.transaction(async (tx) => {
    const id = newId("emp");
    const [created] = await tx.insert(employees).values({
      id,
      businessId,
      displayName: body.displayName,
      roleDescription: body.roleDescription,
      integrations: body.integrations,
      budgetMonthlyUsd: body.budgetMonthlyUsd,
      isManager: body.isManager,
      instructionsJson: body.instructions,
      llmProvider: body.llmProvider ?? null,
      llmModel: body.llmModel ?? null,
      status: "active",
    }).returning();

    for (const integration of body.integrations) {
      await tx.insert(badges).values({
        id: newId("bdg"), employeeId: id, integration, oauthTokenRef: null,
      });
    }
    for (const grant of grants) {
      await tx.insert(employeeToolGrants).values({
        id: newId("etg"), employeeId: id, businessId, ...grant,
      });
    }
    for (const [key, value] of Object.entries(body.instructions)) {
      await tx.insert(memories).values({
        id: newId("mem"), employeeId: id, kind: "instruction",
        content: `${key}: ${value}`, source: "hiring",
      });
    }
    return created;
  });

  return c.json({ ok: true, data: employee }, 201);
});

// Get a single employee
employeeRoutes.get("/:id", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();

  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, c.req.param("id")), eq(employees.businessId, businessId)));

  if (!employee) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true, data: employee });
});

// Update employee (rename, pause, change budget, update instructions)
employeeRoutes.patch("/:id", requireOwner, async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();
  const body = await c.req.json();

  const allowed = ["displayName", "roleDescription", "status", "budgetMonthlyUsd", "instructionsJson", "isManager", "integrations", "llmProvider", "llmModel"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ ok: false, error: "No valid fields to update" }, 400);
  }

  await db
    .update(employees)
    .set(updates)
    .where(and(eq(employees.id, c.req.param("id")), eq(employees.businessId, businessId)));

  const [updated] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, c.req.param("id")), eq(employees.businessId, businessId)));

  if (!updated) return c.json({ ok: false, error: "Employee not found" }, 404);
  return c.json({ ok: true, data: updated });
});

// Fire an employee
employeeRoutes.delete("/:id", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();

  await db
    .update(employees)
    .set({ status: "fired" })
    .where(and(eq(employees.id, c.req.param("id")), eq(employees.businessId, businessId)));

  return c.json({ ok: true, data: null });
});

// Save onboarding answers as instruction memories
employeeRoutes.post("/:id/onboarding", requireOwner, zValidator("json", onboardingSchema), async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();
  const body = c.req.valid("json");
  const empId = c.req.param("id");

  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, empId), eq(employees.businessId, businessId)));

  if (!employee) return c.json({ ok: false, error: "Not found" }, 404);

  const memoryRows = Object.entries(body.answers).map(([question, answer]) => ({
    id: newId("mem"),
    employeeId: empId,
    kind: "instruction" as const,
    content: `Q: ${question}\nA: ${answer}`,
    source: "onboarding",
  }));

  if (memoryRows.length > 0) {
    await db.insert(memories).values(memoryRows);
  }

  // Update instructionsJson on the employee record too
  await db
    .update(employees)
    .set({ instructionsJson: body.answers })
    .where(eq(employees.id, empId));

  return c.json({ ok: true, data: { saved: memoryRows.length } });
});

// Get employee memories
employeeRoutes.get("/:id/memories", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();
  const empId = c.req.param("id");

  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, empId), eq(employees.businessId, businessId)));

  if (!employee) return c.json({ ok: false, error: "Not found" }, 404);

  const rows = await db.select().from(memories).where(eq(memories.employeeId, empId));
  return c.json({ ok: true, data: rows });
});

// Grant a badge
employeeRoutes.post("/:id/badges", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();
  const body = await c.req.json();
  const empId = c.req.param("id");

  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, empId), eq(employees.businessId, businessId)));

  if (!employee) return c.json({ ok: false, error: "Not found" }, 404);

  const id = newId("bdg");
  await db.insert(badges).values({
    id,
    employeeId: empId,
    integration: body.integration,
    oauthTokenRef: body.oauthTokenRef ?? null,
  });

  const [badge] = await db.select().from(badges).where(eq(badges.id, id));
  return c.json({ ok: true, data: badge }, 201);
});

// ─── Tool grants ──────────────────────────────────────────────────────────────

const toolGrantsSchema = z.object({
  grants: z.array(
    z.object({
      provider: z.string().min(1),
      toolName: z.string().min(1),
    })
  ),
});

// GET /api/employees/:id/tool-grants
// List all active tool grants for an employee.
employeeRoutes.get("/:id/tool-grants", async (c) => {
  const { businessId } = c.get("user");
  const empId = c.req.param("id");
  const db = getDb();

  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, empId), eq(employees.businessId, businessId)));

  if (!employee) return c.json({ ok: false, error: "Not found" }, 404);

  const grants = await db
    .select()
    .from(employeeToolGrants)
    .where(and(eq(employeeToolGrants.employeeId, empId), isNull(employeeToolGrants.revokedAt)));

  return c.json({ ok: true, data: grants });
});

// PUT /api/employees/:id/tool-grants
// Full-replace: sets exactly which tools this employee is allowed to call.
// Revokes grants not in the new list; creates new grants for tools not yet granted.
employeeRoutes.put("/:id/tool-grants", zValidator("json", toolGrantsSchema), async (c) => {
  const { businessId } = c.get("user");
  const empId = c.req.param("id");
  const body = c.req.valid("json");
  const db = getDb();

  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, empId), eq(employees.businessId, businessId)));

  if (!employee) return c.json({ ok: false, error: "Not found" }, 404);

  // Verify each (provider, toolName) exists — native tools are validated against
  // the code registry; MCP tools must exist in connector_tools for this business.
  for (const g of body.grants) {
    if (isNativeProvider(g.provider)) {
      const defs = getNativeToolDefs(g.provider);
      if (!defs.some((d) => d.name === g.toolName)) {
        return c.json(
          { ok: false, error: `Tool "${g.toolName}" is not a valid native tool for "${g.provider}".` },
          422
        );
      }
    } else {
      const [tool] = await db
        .select({ id: connectorTools.id })
        .from(connectorTools)
        .where(
          and(
            eq(connectorTools.businessId, businessId),
            eq(connectorTools.provider, g.provider),
            eq(connectorTools.toolName, g.toolName)
          )
        )
        .limit(1);

      if (!tool) {
        return c.json(
          { ok: false, error: `Tool "${g.toolName}" from "${g.provider}" has not been discovered for this business.` },
          422
        );
      }
    }
  }

  // Load current active grants
  const activeGrants = await db
    .select()
    .from(employeeToolGrants)
    .where(and(eq(employeeToolGrants.employeeId, empId), isNull(employeeToolGrants.revokedAt)));

  const requestedSet = new Set(body.grants.map((g) => `${g.provider}::${g.toolName}`));
  const activeSet    = new Set(activeGrants.map((g) => `${g.provider}::${g.toolName}`));

  // Revoke grants no longer in the list
  for (const grant of activeGrants) {
    if (!requestedSet.has(`${grant.provider}::${grant.toolName}`)) {
      await db
        .update(employeeToolGrants)
        .set({ revokedAt: new Date() })
        .where(eq(employeeToolGrants.id, grant.id));
    }
  }

  // Create new grants not yet active
  for (const g of body.grants) {
    if (!activeSet.has(`${g.provider}::${g.toolName}`)) {
      await db.insert(employeeToolGrants).values({
        id:         newId("etg"),
        employeeId: empId,
        businessId,
        provider:   g.provider,
        toolName:   g.toolName,
      });
    }
  }

  const updated = await db
    .select()
    .from(employeeToolGrants)
    .where(and(eq(employeeToolGrants.employeeId, empId), isNull(employeeToolGrants.revokedAt)));

  return c.json({ ok: true, data: updated });
});

// Revoke a badge
employeeRoutes.delete("/:id/badges/:badgeId", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();
  const empId = c.req.param("id");

  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, empId), eq(employees.businessId, businessId)));

  if (!employee) return c.json({ ok: false, error: "Not found" }, 404);

  await db
    .update(badges)
    .set({ revokedAt: new Date() })
    .where(eq(badges.id, c.req.param("badgeId")));

  return c.json({ ok: true, data: null });
});
