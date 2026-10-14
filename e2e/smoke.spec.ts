import { test, expect } from "@playwright/test";

test.describe("homepage", () => {
  test("redirects to English by default", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page).toHaveTitle(/CRAT/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("CRAT");
  });

  test.describe("with a German browser", () => {
    test.use({ locale: "de-DE" });

    test("redirects to German", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/de$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "de");
    });
  });

  test("switches language via the header", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("link", { name: "Deutsch" }).click();
    await expect(page).toHaveURL(/\/de$/);
    await expect(page.getByText(/Beantworte Compliance-Fragen/)).toBeVisible();
  });
});
