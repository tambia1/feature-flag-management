import pino from "pino";

/**
 * Structured JSON logs (shipped to Loki in production).
 * Never log secrets or personal data: passwords, SDK keys, emails and user context are redacted.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "feature-flag-management" },
  redact: {
    paths: ["password", "*.password", "sdkKey", "*.sdkKey", "email", "*.email", "context", "*.context", "authorization"],
    censor: "[redacted]",
  },
});
