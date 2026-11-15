import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("flags", () => {
  test("an editor creates a flag, turns it on and archives it", async ({ page }) => {
    const key = `e2e-${Date.now()}`;
    await login(page, "emma@acme.com");

    await page.goto("/projects/web-app/flags/new?env=dev");
    await page.getByLabel("Key · used in code, can't change later").fill(key);
    await page.getByLabel("Name").fill("E2E flag");
    await page.getByRole("button", { name: "Create flag" }).click();

    await expect(page.getByRole("heading", { name: key })).toBeVisible();
    await expect(page.getByText("Off — serving the off value")).toBeVisible();

    await page.getByRole("switch", { name: `${key} in development` }).click();
    await expect(page.getByText("On — serving the rules below")).toBeVisible();

    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Archive flag" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();
    await expect(page).toHaveURL(/\/archived/);
    await expect(page.getByRole("link", { name: key })).toBeVisible();
  });

  test("turning a flag on in production asks to confirm", async ({ page }) => {
    await login(page, "emma@acme.com");
    await page.goto("/projects/web-app/flags?env=prod");
    await page.getByRole("switch", { name: "max-upload-mb in production" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /in production\?/ })).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe("permissions", () => {
  test("a member with no team sees the no-access message and no settings", async ({ page }) => {
    await login(page, "liam@acme.com");
    await expect(page.getByText("You don't have access to this project's flags")).toBeVisible();
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);

    await page.goto("/settings/users");
    await expect(page).not.toHaveURL(/\/settings\/users/);
  });

  test("a viewer can't toggle in production", async ({ page }) => {
    await login(page, "james@acme.com");
    await page.goto("/projects/web-app/flags?env=prod");
    await expect(page.getByRole("switch", { name: "new-checkout in production" })).toBeDisabled();
  });
});
