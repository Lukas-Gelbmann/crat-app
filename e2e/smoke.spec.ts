import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/CRAT/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("CRAT");
});
