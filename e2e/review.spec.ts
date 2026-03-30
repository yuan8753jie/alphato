import { test, expect } from "@playwright/test";

test.describe("AI Review 评审流程", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const data = {
        account: {
          name: "测试品牌抖音号",
          platform: "douyin",
          accountUrl: "",
          brand: {
            name: "测试饮料品牌",
            tone: "年轻活泼",
            rules: [],
            industry: "饮料",
          },
          brandMaterials: [],
          products: [{ name: "气泡水", description: "0糖气泡水", sellingPoints: ["0糖"], imagePaths: [], links: [] }],
          personas: [],
          benchmarkAccounts: [],
        },
        topics: [
          { id: "t1", title: "测试选题一", type: "traffic", angle: "角度", description: "描述", relatedTrendIds: [], estimatedAppeal: "", status: "pending", createdAt: "2026-03-30" },
          { id: "t2", title: "测试选题二", type: "trust", angle: "角度", description: "描述", relatedTrendIds: [], estimatedAppeal: "", status: "pending", createdAt: "2026-03-30" },
        ],
        scripts: [],
        trends: [{ id: "tr1", title: "热点", description: "desc", category: "platform_hot", section: "global", source: "test", heatScore: 8, relevance: "", fetchedAt: "2026-03-30" }],
        trendsDate: "2026-03-30",
      };
      localStorage.setItem("alphato_data", JSON.stringify(data));
    });
  });

  test("Review 抽屉打开、宽度正确、显示评审过程", async ({ page }) => {
    await page.goto("/topics");

    // Click AI Review
    await page.click("text=AI Review");

    // Drawer should open immediately
    const drawer = page.locator('[data-slot="sheet-content"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Verify drawer width is approximately 50% of viewport
    const viewportWidth = page.viewportSize()?.width || 1280;
    const drawerBox = await drawer.boundingBox();
    expect(drawerBox).toBeTruthy();
    const drawerWidth = drawerBox!.width;
    // Allow some tolerance (45-55% of viewport)
    expect(drawerWidth).toBeGreaterThan(viewportWidth * 0.4);
    expect(drawerWidth).toBeLessThan(viewportWidth * 0.6);

    // Step 1: Should show persona generation in progress
    await expect(page.locator("text=正在分析品牌受众")).toBeVisible();

    // Wait for personas to appear (up to 30s)
    await expect(page.locator("text=审稿团就位")).toBeVisible({ timeout: 30000 });

    // Step 2: Should show reviewing in progress
    await expect(page.locator("text=正在评审")).toBeVisible();

    // Wait for review to complete (up to 60s)
    await expect(page.getByRole("heading", { name: "评审完成" })).toBeVisible({ timeout: 60000 });

    // Drawer should contain review scores
    await expect(page.locator('text=/\\d+\\.\\d/').first()).toBeVisible();
  });
});
