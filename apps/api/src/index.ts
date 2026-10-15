import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import logger from "./lib/logger";
import {
    onError as gatewayOnError,
    requestIdMiddleware,
    requestLoggerMiddleware,
    securityHeadersMiddleware
} from "./middleware/gateway";
import { approvalRoutes } from "./routes/approvals";
import { authRoutes } from "./routes/auth";
import { businessMemoryRoutes } from "./routes/business-memories";
import { chatSessionRoutes } from "./routes/chat-sessions";
import { connectorRoutes } from "./routes/connectors";
import { employeeMemoryRoutes } from "./routes/employee-memories";
import { employeeRoutes } from "./routes/employees";
import { settingsRoutes } from "./routes/settings";
import { taskRoutes } from "./routes/tasks";
import { teamMemoryRoutes } from "./routes/team-memories";
import { workflowRoutes } from "./routes/workflows";
import { webhookRoutes } from "./routes/webhooks";
import { scheduleWorkflows } from "./workflows/engine";

const app = new Hono();

// ─── Gateway middleware (order matters) ───────────────────────────────────────
app.use("*", requestIdMiddleware);       // 1. attach X-Request-Id
app.use("*", securityHeadersMiddleware); // 2. security headers
app.use(                                 // 3. CORS
  "*",
  cors({
    origin: [process.env.CORS_ORIGIN ?? "http://localhost:5173", "http://localhost:5175", "http://localhost:5176"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
// app.use("*", rateLimiterMiddleware);     // 4. rate limiter (after CORS so preflights work)
app.use("*", requestLoggerMiddleware);   // 5. structured request logger

app.get("/health", (c) => c.json({ ok: true, service: "staffroom-api" }));

app.route("/api/auth", authRoutes);
app.route("/api/employees", employeeRoutes);
app.route("/api/employees", employeeMemoryRoutes);
app.route("/api/tasks", taskRoutes);
app.route("/api/approvals", approvalRoutes);
app.route("/api/connectors", connectorRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/business-memories", businessMemoryRoutes);
app.route("/api/team-memories", teamMemoryRoutes);
app.route("/api/chat-sessions", chatSessionRoutes);
app.route("/api/workflows", workflowRoutes);
app.route("/api/webhooks", webhookRoutes);

app.onError(gatewayOnError);

const port = Number(process.env.PORT ?? 3003);
logger.info(`API server running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });

// Schedule cron-based workflows after server starts
scheduleWorkflows().catch((err) => logger.error("Failed to schedule workflows", { error: (err as Error).message }));

export default app;
