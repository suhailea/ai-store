/**
 * API Gateway middleware
 *
 * Applied globally in index.ts in this order:
 *   1. requestIdMiddleware    — attach X-Request-Id to every request
 *   2. securityHeadersMiddleware — set security headers on every response
 *   3. cors()                 — already in index.ts, unchanged
 *   4. rateLimiterMiddleware  — sliding window, per businessId or IP
 *   5. requestLoggerMiddleware — structured JSON log per request
 *
 * onError is exported for app.onError() — replaces the inline handler.
 */

import { createMiddleware } from "hono/factory";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { HTTPException } from "hono/http-exception";
import { nanoid } from "nanoid";
import { verifyToken } from "../lib/jwt";
import logger from "../lib/logger";
import type { AppEnv } from "../lib/types";
import type { Context } from "hono";

// ─── 1. Request ID ────────────────────────────────────────────────────────────

export const requestIdMiddleware = requestId({
  generator: () => nanoid(21),
  headerName: "X-Request-Id",
});

// ─── 2. Security Headers ──────────────────────────────────────────────────────

export const securityHeadersMiddleware = secureHeaders({
  xContentTypeOptions: "nosniff",
  xFrameOptions: "DENY",
  referrerPolicy: "strict-origin-when-cross-origin",
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: false, // enable in production with HTTPS
});

// ─── 3. Rate Limiter (sliding window, in-memory) ──────────────────────────────

const WINDOW_MS = 60_000; // 1 minute
const LIMIT_AUTHENTICATED = 60; // req/min per businessId
const LIMIT_UNAUTHENTICATED = 10; // req/min per IP

interface Bucket {
  timestamps: number[];
}

const store = new Map<string, Bucket>();

// Sweep stale buckets every minute to prevent unbounded map growth
setInterval(() => {
  const windowStart = Date.now() - WINDOW_MS;
  for (const [key, bucket] of store) {
    bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);
    if (bucket.timestamps.length === 0) store.delete(key);
  }
}, WINDOW_MS);

function isAllowed(key: string, limit: number): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const bucket = store.get(key) ?? { timestamps: [] };

  // Evict old timestamps (sliding window)
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= limit) {
    store.set(key, bucket);
    return false;
  }

  bucket.timestamps.push(now);
  store.set(key, bucket);
  return true;
}

async function getRateLimitKey(c: Context): Promise<{ key: string; limit: number }> {
  const authHeader = c.req.header("Authorization");
  const queryToken = c.req.query("token");
  const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : queryToken;

  if (rawToken) {
    try {
      const payload = await verifyToken(rawToken);
      return { key: `biz:${payload.businessId}`, limit: LIMIT_AUTHENTICATED };
    } catch {
      // Invalid token — fall through to IP-based limiting
    }
  }

  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown";
  return { key: `ip:${ip}`, limit: LIMIT_UNAUTHENTICATED };
}

export const rateLimiterMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const { key, limit } = await getRateLimitKey(c);

  if (!isAllowed(key, limit)) {
    const reqId = c.get("requestId") ?? "unknown";
    logger.warn("Rate limit exceeded", { requestId: reqId, key });
    return c.json(
      { ok: false, error: "Too many requests — slow down", requestId: reqId },
      429,
      { "Retry-After": "60" }
    );
  }

  await next();
});

// ─── 4. Request Logger ────────────────────────────────────────────────────────

export const requestLoggerMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const start = Date.now();
  await next();

  const status = c.res.status;
  const durationMs = Date.now() - start;
  const user = c.get("user");

  const meta = {
    requestId: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    status,
    durationMs,
    businessId: user?.businessId ?? null,
  };

  if (status >= 500) {
    logger.error("", meta);
  } else if (status >= 400) {
    logger.warn("", meta);
  } else {
    logger.http("", meta);
  }
});

// ─── 5. Structured Error Handler ──────────────────────────────────────────────

export function onError(err: Error, c: Context): Response {
  const requestId = c.get("requestId") ?? "unknown";

  if (err instanceof HTTPException) {
    const status = err.status;
    const defaultMessages: Record<number, string> = {
      400: "Bad request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not found",
      422: "Unprocessable entity",
      429: "Too many requests",
    };
    return c.json(
      {
        ok: false,
        error: defaultMessages[status] ?? err.message,
        requestId,
      },
      status
    );
  }

  logger.error(err.message, { requestId, stack: err.stack });
  return c.json({ ok: false, error: "Internal server error", requestId }, 500);
}
