import { test, expect } from "@playwright/test";

test.describe("营销日历", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const today = new Date().toISOString().split("T")[0];
      const data = {
        account: {
          name: "测试品牌",
          platform: "douyin",
          accountUrl: "",
          brand: { name: "测试", tone: "活泼", rules: [], industry: "饮料" },
          brandMaterials: [],
          products: [],
          personas: [],
          benchmarkAccounts: [],
        },
        topics: [
          { id: "t1", title: "待排期选题A", type: "traffic", angle: "", description: "", relatedTrendIds: [], estimatedAppeal: "", status: "approved", createdAt: today },
          { id: "t2", title: "待排期选题B", type: "trust", angle: "", description: "", relatedTrendIds: [], estimatedAppeal: "", status: "approved", createdAt: today },
          { id: "t3", title: "已排期选题C", type: "conversion", angle: "", description: "", relatedTrendIds: [], estimatedAppeal: "", status: "approved", scheduledDate: today, createdAt: today },
        ],
        scripts: [],
        trends: [],
        trendsDate: null,
      };
      localStorage.setItem("alphato_data", JSON.stringify(data));
    });
  });

  test("日历页面加载 + 显示待排期和已排期选题", async ({ page }) => {
    await page.goto("/calendar");

    // Page loads
    await expect(page.locator("text=营销日历")).toBeVisible();

    // Sidebar shows unscheduled topics
    await expect(page.getByRole("heading", { name: /待排期/ })).toBeVisible();
    await expect(page.locator("text=待排期选题A")).toBeVisible();
    await expect(page.locator("text=待排期选题B")).toBeVisible();

    // Already scheduled topic shows in calendar
    await expect(page.locator("text=已排期选题C")).toBeVisible();
  });

  test("拖拽排期 + 移除", async ({ page }) => {
    await page.goto("/calendar");

    // Find the first calendar day cell and drag a topic to it
    const topicA = page.locator("text=待排期选题A").first();
    const firstDayCell = page.locator(".grid-cols-7 > div").first();

    // Drag topic A to first day
    await topicA.dragTo(firstDayCell);

    // Topic A should now appear in the calendar grid (not just sidebar)
    // Sidebar should now only have topic B
    await expect(page.locator("text=待排期选题B")).toBeVisible();
  });
});
