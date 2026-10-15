import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb, workflows } from "@staffroom/db";
import { fireWorkflow } from "../workflows/engine";

const app = new Hono();

// POST /api/webhooks/:workflowId — unauthenticated
app.post("/:workflowId", async (c) => {
  const db = getDb();
  const [wfl] = await db.select().from(workflows).where(eq(workflows.id, c.req.param("workflowId")));
  if (!wfl || !wfl.enabled || wfl.triggerType !== "webhook") {
    return c.json({ ok: false, error: "Workflow not found or not a webhook trigger" }, 404);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await c.req.json();
  } catch {
    // body may be empty or non-JSON
  }

  // Fire and forget
  fireWorkflow(wfl.id, body).catch(() => {});
  return c.json({ ok: true, message: "Workflow triggered" });
});

export const webhookRoutes = app;
