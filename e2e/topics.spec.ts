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
    await page.click("text=搜索今日热点");
    await expect(page.locator("text=正在搜索热点...")).toBeVisible();

    // Wait for trends (up to 45s for Gemini API)
    await expect(page.locator("text=已获取")).toBeVisible({ timeout: 45000 });

    // Step 2: Generate topics
    await page.click("text=基于热点生成选题");
    await expect(page.locator("text=AI 正在策划选题...")).toBeVisible();

    // Wait for topics (up to 45s)
    await expect(page.locator("text=选题列表")).toBeVisible({ timeout: 45000 });

    // Step 3: Approve a topic
    const firstApproveBtn = page.locator("text=采用").first();
    await firstApproveBtn.click();

    // Verify status changed
    await expect(page.locator('[data-variant="default"]').first()).toBeVisible();
  });
});
