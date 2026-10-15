import { createMiddleware } from "hono/factory";
import { verifyToken } from "../lib/jwt";
import type { AppEnv } from "../lib/types";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const queryToken = c.req.query("token");
  const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : queryToken;
  if (!rawToken) {
    return c.json({ ok: false, error: "Unauthorized" }, 401);
  }
  const token = rawToken;
  try {
    const payload = await verifyToken(token);
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ ok: false, error: "Invalid token" }, 401);
  }
});
