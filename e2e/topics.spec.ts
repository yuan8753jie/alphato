import { test, expect } from "@playwright/test";

test.describe("选题生成 + 审批", () => {
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
        // Pre-populate trends so topics page can generate directly
        trends: [
          { id: "tr1", title: "热梗测试", description: "一个测试热梗", category: "social_meme", section: "global", source: "test.com", heatScore: 9, relevance: "测试", fetchedAt: "2026-03-30" },
          { id: "tr2", title: "行业新闻测试", description: "饮料行业测试新闻", category: "industry_news", section: "industry", source: "test.com", heatScore: 8, relevance: "测试", fetchedAt: "2026-03-30" },
        ],
        trendsDate: new Date().toISOString().split("T")[0],
      };
      localStorage.setItem("alphato_data", JSON.stringify(data));
    });
  });

  test("生成选题 → 审批状态切换", async ({ page }) => {
    await page.goto("/topics");

    // Should see "生成选题" button since trends exist
    await page.click("text=生成选题");

    // Wait for topics to appear - two-phase generation needs time
    const approveBtn = page.locator('button:has-text("采用")').first();
    await expect(approveBtn).toBeVisible({ timeout: 90000 });
    await approveBtn.click();

    // Verify badge changed
    await expect(page.locator('[data-slot="badge"]:has-text("采用")').first()).toBeVisible();
  });
});
