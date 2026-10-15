import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, businesses } from "@staffroom/db";
import { requireAuth } from "../middleware/auth";
import { testLLMConnection } from "@staffroom/llm";
import type { AppEnv } from "../lib/types";

export const settingsRoutes = new Hono<AppEnv>();

settingsRoutes.use("*", requireAuth);

// ─── GET /api/settings ────────────────────────────────────────────────────────

settingsRoutes.get("/", async (c) => {
  const { businessId } = c.get("user");
  const db = getDb();

  const [biz] = await db
    .select({
      llmProvider: businesses.llmProvider,
      llmModel: businesses.llmModel,
      ollamaBaseUrl: businesses.ollamaBaseUrl,
      name: businesses.name,
      industry: businesses.industry,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!biz) return c.json({ ok: false, error: "Business not found" }, 404);

  return c.json({ ok: true, data: biz });
});

// ─── PATCH /api/settings ──────────────────────────────────────────────────────

const updateSchema = z.object({
  llmProvider: z.enum(["anthropic", "deepseek", "gemini", "ollama", "openrouter"]).optional(),
  llmModel: z.string().min(1).optional(),
  ollamaBaseUrl: z.string().url().nullable().optional(),
});

settingsRoutes.patch("/", zValidator("json", updateSchema), async (c) => {
  const { businessId } = c.get("user");
  const body = c.req.valid("json");
  const db = getDb();

  await db
    .update(businesses)
    .set({
      ...(body.llmProvider !== undefined && { llmProvider: body.llmProvider }),
      ...(body.llmModel !== undefined && { llmModel: body.llmModel }),
      ...(body.ollamaBaseUrl !== undefined && { ollamaBaseUrl: body.ollamaBaseUrl }),
    })
    .where(eq(businesses.id, businessId));

  return c.json({ ok: true, data: null });
});

// ─── POST /api/settings/test-llm ─────────────────────────────────────────────

const testSchema = z.object({
  provider: z.enum(["anthropic", "deepseek", "gemini", "ollama", "openrouter"]),
  model: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

settingsRoutes.post("/test-llm", zValidator("json", testSchema), async (c) => {
  const body = c.req.valid("json");

  const start = Date.now();
  const result = await testLLMConnection(body.provider, body.model, {
    ...(body.apiKey ? { apiKey: body.apiKey } : {}),
    ...(body.baseUrl ? { baseUrl: body.baseUrl } : {}),
  });
  const latencyMs = Date.now() - start;

  return c.json({ ok: true, data: { success: result.ok, latencyMs, error: result.error } });
});
