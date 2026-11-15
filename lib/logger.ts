import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "feature-flag-management" },
  redact: {
    paths: ["password", "*.password", "sdkKey", "*.sdkKey", "email", "*.email", "context", "*.context", "authorization"],
    censor: "[redacted]",
  },
});
