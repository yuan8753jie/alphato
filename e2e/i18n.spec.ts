import { test, expect } from "@playwright/test";

/**
 * Smoke test: every page should render without crashing in BOTH Chinese and English,
 * and the lang toggle in the sidebar should actually swap the visible text.
 */

const PAGES = [
  "/",
  "/topics",
  "/calendar",
  "/discover",
  "/history",
  "/assets",
  "/analytics",
  "/playground/seedance",
  "/eval",
  "/prompts",
  "/settings",
  "/setup",
];

test.describe("i18n smoke", () => {
  test("toggle in sidebar swaps language", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("lang-toggle-zh")).toBeVisible();
    await expect(page.getByTestId("lang-toggle-en")).toBeVisible();

    // Default is Chinese
    await expect(page.getByRole("link", { name: "工作台", exact: true })).toBeVisible();

    // Switch to English
    await page.getByTestId("lang-toggle-en").click();
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();

    // Switch back
    await page.getByTestId("lang-toggle-zh").click();
    await expect(page.getByRole("link", { name: "工作台", exact: true })).toBeVisible();
  });

  test("toggle persists across page navigation", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("lang-toggle-en").click();
    await page.goto("/topics");
    // Sidebar should still show English
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  });

  for (const path of PAGES) {
    test(`page ${path} renders in EN without crashing`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("pageerror", (err) => consoleErrors.push(err.message));

      await page.goto("/");
      await page.getByTestId("lang-toggle-en").click();
      await page.goto(path);
      // Wait briefly for client hydration
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      // Sidebar nav should be visible (i.e., layout didn't crash)
      await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
      expect(consoleErrors, `page errors on ${path}: ${consoleErrors.join("; ")}`).toHaveLength(0);
    });

    test(`page ${path} renders in ZH without crashing`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("pageerror", (err) => consoleErrors.push(err.message));

      await page.goto(path);
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await expect(page.getByRole("link", { name: "工作台", exact: true })).toBeVisible();
      expect(consoleErrors, `page errors on ${path}: ${consoleErrors.join("; ")}`).toHaveLength(0);
    });
  }
});
