import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("Edit on a user row opens edit mode and stays there", async ({ page }) => {
  await login(page, "emma@acme.com");
  await page.goto("/settings/users");

  const row = page.getByRole("row", { name: /James Brown/ });
  await row.getByRole("button", { name: "Edit" }).click();

  // Regression: the Edit button used to turn into the Save (submit) button mid-click and close edit mode at once.
  await page.waitForTimeout(500);
  await expect(page.getByRole("textbox", { name: "Name" }).last()).toHaveValue("James Brown");
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
});
