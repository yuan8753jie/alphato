import { test, expect } from "@playwright/test";

test.describe("脚本生成", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const data = {
        account: {
          name: "测试品牌抖音号",
          platform: "douyin",
          accountUrl: "",
          brand: {
            name: "雪碧",
            tone: "年轻活泼，清爽",
            rules: ["不提竞品"],
            industry: "饮料",
          },
          brandMaterials: [],
          products: [{ name: "雪碧", description: "经典柠檬味碳酸饮料", sellingPoints: ["清爽解渴", "经典口味"], imagePaths: [], links: [] }],
          personas: [],
          benchmarkAccounts: [],
        },
        topics: [
          {
            id: "test-topic-1",
            title: "爆汗5公里，雪碧回血只用3秒",
            type: "traffic",
            angle: "运动后喝雪碧的爽感",
            description: "拍一条运动后喝雪碧的短视频，展现运动后的疲惫和喝到雪碧的满足感对比",
            relatedTrendIds: [],
            estimatedAppeal: "运动人群共鸣",
            status: "approved",
            createdAt: "2026-03-30",
          },
        ],
        scripts: [],
        trends: [],
        trendsDate: null,
      };
      localStorage.setItem("alphato_data", JSON.stringify(data));
    });
  });

  test("生成脚本 → 展示分镜表 + Kling 提示词", async ({ page }) => {
    await page.goto("/topics/test-topic-1");

    // Verify topic info loaded
    await expect(page.locator("text=爆汗5公里")).toBeVisible();

    // Click generate
    await page.click("text=生成脚本");

    // Wait for script to fully render - check for voiceover section which comes last
    await expect(page.locator("text=完整口播稿")).toBeVisible({ timeout: 60000 });

    // Verify storyboard rendered
    await expect(page.locator("text=分镜表")).toBeVisible();
  });
});
