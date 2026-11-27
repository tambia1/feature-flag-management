import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import "dotenv/config";

function testDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    return "";
  }

  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname.replace(/_test$/, "")}_test`;
  return url.toString();
}

const exclude = ["node_modules", ".next", "e2e", "sdk/node_modules", "docs"];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["**/*.test.{ts,tsx}"],
          exclude: [...exclude, "**/*.db.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["**/*.db.test.ts"],
          exclude,
          environment: "node",
          globalSetup: ["test/db-setup.ts"],
          setupFiles: ["test/db-mocks.ts"],
          env: {
            DATABASE_URL: testDatabaseUrl(),
            FLAGS_REDIS_URL: "",
            STATUS_REDIS_URL: "",
            NEXT_PUBLIC_POSTHOG_KEY: "",
            LOG_LEVEL: "silent",
          },
        },
      },
    ],
  },
});
