import * as Sentry from "@sentry/nextjs";
import { registerOTel } from "@vercel/otel";

export async function register() {
  registerOTel({ serviceName: "feature-flag-management" });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startServerStatus } = await import("./lib/server-status");
    startServerStatus();
  }

  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [] },
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
