import { test, expect } from "@playwright/test";

test.describe("热点抓取 + 选题生成", () => {
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
            tone: "年轻活泼，喜欢玩梗",
            rules: ["不提竞品"],
            industry: "饮料",
          },
          brandMaterials: [],
          products: [
            {
              name: "气泡水",
              description: "0糖0卡气泡水",
              sellingPoints: ["0糖", "0卡", "多种口味"],
              imagePaths: [],
              links: [],
            },
          ],
          personas: [
            {
              name: "大学生小李",
              description: "20岁，注重健康但爱喝饮料，价格敏感，喜欢新奇的东西",
            },
          ],
          benchmarkAccounts: [],
        },
        topics: [],
        scripts: [],
        trends: [],
        trendsDate: null,
      };
      localStorage.setItem("alphato_data", JSON.stringify(data));
    });
  });

  test("完整链路：抓热点 → 生成选题 → 审批", async ({ page }) => {
    await page.goto("/topics");
    await expect(page.locator("text=测试饮料品牌")).toBeVisible();

    // Step 1: On Trends tab, fetch trends
    await page.click("text=开始抓取热点");

    // Wait for trends to load (button text changes back)
    await expect(page.locator("text=刷新全部热点")).toBeVisible({ timeout: 180000 });

    // Verify trends appeared in sections
    await expect(page.locator("text=全局热点").first()).toBeVisible();

    // Step 2: Click generate topics (bottom of trends tab or switch to topics tab)
    await page.click("text=基于热点生成选题 →");

    // Should auto-switch to topics tab, wait for topics
    await expect(page.locator("text=选题池").first()).toBeVisible({ timeout: 60000 });

    // Step 3: Approve a topic
    const approveButtons = page.locator('button:has-text("采用")');
    await approveButtons.first().click();

    // Verify badge changed
    await expect(page.locator('[data-slot="badge"]:has-text("采用")').first()).toBeVisible();
  });
});
