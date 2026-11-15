import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Standalone output for a small Docker image (see Dockerfile).
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["pino", "pino-pretty", "ioredis", "prom-client"],
  async headers() {
    return [
      {
        source: "/((?!api/sdk).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

// Sentry only uploads source maps when SENTRY_AUTH_TOKEN is set (CI); otherwise it just wraps the config.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
});
