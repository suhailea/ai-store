import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, humanUsers, businesses } from "@staffroom/db";
import { signToken } from "../lib/jwt";
import { newId } from "../lib/id";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../lib/types";

export const authRoutes = new Hono<AppEnv>();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  businessName: z.string().min(1),
  industry: z.string().min(1),
  teamSize: z.number().int().min(1).max(1000),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRoutes.post("/signup", zValidator("json", signupSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb();

  const existing = await db
    .select()
    .from(humanUsers)
    .where(eq(humanUsers.email, body.email))
    .limit(1);

  if (existing.length > 0) {
    return c.json({ ok: false, error: "Email already in use" }, 409);
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const userId = newId("usr");
  const businessId = newId("biz");

  await db.insert(businesses).values({
    id: businessId,
    name: body.businessName,
    industry: body.industry,
    teamSize: body.teamSize,
    ownerUserId: userId,
    demoMode: false,
  });

  await db.insert(humanUsers).values({
    id: userId,
    businessId,
    email: body.email,
    name: body.name,
    role: "owner",
    passwordHash,
  });

  const token = await signToken({ userId, businessId, role: "owner" });
  return c.json({ ok: true, data: { token, userId, businessId } }, 201);
});

authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb();

  const [user] = await db
    .select()
    .from(humanUsers)
    .where(eq(humanUsers.email, body.email))
    .limit(1);

  if (!user) {
    return c.json({ ok: false, error: "Invalid credentials" }, 401);
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ ok: false, error: "Invalid credentials" }, 401);
  }

  const token = await signToken({
    userId: user.id,
    businessId: user.businessId,
    role: user.role,
  });

  return c.json({ ok: true, data: { token, userId: user.id, businessId: user.businessId } });
});

// Demo login — returns a token for the seeded demo business
authRoutes.post("/demo", async (c) => {
  const db = getDb();
  const [demo] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.demoMode, true))
    .limit(1);

  if (!demo) {
    return c.json({ ok: false, error: "Demo not available" }, 404);
  }

  const [owner] = await db
    .select()
    .from(humanUsers)
    .where(eq(humanUsers.businessId, demo.id))
    .limit(1);

  const token = await signToken({
    userId: owner.id,
    businessId: demo.id,
    role: owner.role,
  });

  return c.json({ ok: true, data: { token, userId: owner.id, businessId: demo.id, demo: true } });
});

// Get current user + business
authRoutes.get("/me", requireAuth, async (c) => {
  const { userId, businessId } = c.get("user");
  const db = getDb();

  const [user] = await db.select().from(humanUsers).where(eq(humanUsers.id, userId)).limit(1);
  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);

  if (!user || !business) return c.json({ ok: false, error: "Not found" }, 404);

  return c.json({
    ok: true,
    data: {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      business: { id: business.id, name: business.name, industry: business.industry, demoMode: business.demoMode },
    },
  });
});
