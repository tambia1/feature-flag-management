import * as Sentry from "@sentry/nextjs";
import { registerOTel } from "@vercel/otel";

/** Runs once when the server starts: tracing (OpenTelemetry → Tempo) and error reporting (Sentry). */
export async function register() {
  // Traces are exported only when OTEL_EXPORTER_OTLP_ENDPOINT is set.
  registerOTel({ serviceName: "feature-flag-management" });

  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      // Privacy: no user details, cookies, headers or request bodies.
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [] },
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
