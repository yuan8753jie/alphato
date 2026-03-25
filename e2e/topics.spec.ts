import { test, expect } from "@playwright/test";

test.describe("热点抓取 + 选题生成", () => {
  test.beforeEach(async ({ page }) => {
    // Setup account data via localStorage
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
      };
      localStorage.setItem("alphato_data", JSON.stringify(data));
    });
  });

  test("完整链路：抓热点 → 生成选题 → 审批", async ({ page }) => {
    await page.goto("/topics");

    // Verify page loaded with account info
    await expect(page.locator("text=测试饮料品牌")).toBeVisible();

    // Step 1: Fetch trends
    await page.click("text=抓取全部热点");

    // Wait for trends to load - 4 parallel search rounds, needs more time
    await expect(page.locator("text=刷新全部热点")).toBeVisible({ timeout: 180000 });

    // Step 2: Generate topics
    await page.click("text=生成选题");

    // Wait for topics
    await expect(page.locator("text=选题池")).toBeVisible({ timeout: 60000 });

    // Step 3: Approve a topic - click the first "采用" button that isn't already active
    const approveButtons = page.locator('button:has-text("采用")');
    await approveButtons.first().click();

    // Verify the badge text changed to "采用"
    await expect(page.locator('[data-slot="badge"]:has-text("采用")').first()).toBeVisible();
  });
});
