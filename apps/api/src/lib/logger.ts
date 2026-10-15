import winston from "winston";

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

const isDev = process.env.NODE_ENV !== "production";

// ─── Dev format ───────────────────────────────────────────────────────────────
// Pretty, coloured, human-readable — like Morgan/Hono logger but with levels

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, requestId, method, path, status, durationMs, businessId, stack, ...rest }) => {
    let line = `${timestamp} [${level}]`;

    if (requestId) line += ` [${requestId}]`;
    if (method && path) line += ` ${method} ${path}`;
    if (status) line += ` → ${status}`;
    if (durationMs !== undefined) line += ` (${durationMs}ms)`;
    if (businessId) line += ` biz=${businessId}`;
    if (message) line += ` ${message}`;

    // Append remaining extra fields (skip empty objects)
    const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
    if (extra !== " {}") line += extra;

    // Stack trace for errors
    if (stack) line += `\n${stack}`;

    return line;
  })
);

// ─── Production format ────────────────────────────────────────────────────────
// Structured JSON — ingested by Datadog, CloudWatch, Logtail, etc.

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  format: isDev ? devFormat : prodFormat,
  transports: [
    new winston.transports.Console(),
  ],
});

export default logger;
