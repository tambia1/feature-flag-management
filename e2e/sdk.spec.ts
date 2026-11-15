import { expect, test } from "@playwright/test";

test("the SDK rejects unknown keys", async ({ request }) => {
  const response = await request.post("/api/sdk/evaluate", {
    headers: { Authorization: "sdk-not-a-real-key" },
    data: { context: { key: "user-1" } },
  });
  expect(response.status()).toBe(401);
});

test("health check is up", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok" });
});
