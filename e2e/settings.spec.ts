import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("Edit on a user row opens edit mode and stays there", async ({ page }) => {
  await login(page, "emma@acme.com");
  await page.goto("/settings/users");

  const row = page.getByRole("row", { name: /James Brown/ });
  await row.getByRole("button", { name: "Edit" }).click();

  await page.waitForTimeout(500);
  await expect(page.getByRole("textbox", { name: "Name" }).last()).toHaveValue("James Brown");
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
});
