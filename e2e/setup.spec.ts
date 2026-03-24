import { test, expect } from "@playwright/test";
import path from "path";

test.describe("账号工作区", () => {
  test("首页能加载", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("AlphaTo");
  });

  test("setup 页面能加载并保存", async ({ page }) => {
    await page.goto("/setup");
    await expect(page.locator("h1")).toContainText("账号工作区设置");

    // Fill brand info
    await page.fill("#accountName", "测试账号");
    await page.fill("#brandName", "测试品牌");
    await page.fill("#industry", "测试行业");
    await page.fill("#tone", "测试调性描述");

    // Save
    await page.click("text=保存设置");
    await expect(page.locator("text=已保存")).toBeVisible();
  });

  test("上传品牌资料图片并调用 Gemini 提取", async ({ page }) => {
    await page.goto("/setup");

    // Upload test image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.join(__dirname, "../public/test-assets/nano-banana-test.jpg")
    );

    // Wait for extraction (may take a while due to API call)
    await expect(page.locator("text=AI 识别中...")).toBeVisible();

    // Wait for result (up to 30s for Gemini API)
    await expect(
      page.locator(".bg-muted.rounded-md")
    ).toBeVisible({ timeout: 30000 });
  });

  test("保存后首页显示账号信息", async ({ page }) => {
    // First save account info
    await page.goto("/setup");
    await page.fill("#accountName", "E2E测试号");
    await page.fill("#brandName", "E2E品牌");
    await page.fill("#industry", "电商");
    await page.click("text=保存设置");
    await expect(page.locator("text=已保存")).toBeVisible();

    // Go to homepage and check
    await page.goto("/");
    await expect(page.locator("text=E2E测试号")).toBeVisible();
    await expect(page.locator("text=E2E品牌")).toBeVisible();
  });
});
