import { test, expect } from "@playwright/test";

test.describe("多品牌数据层", () => {
  test("阶段1: 旧数据自动迁移到新结构", async ({ page }) => {
    // 注入旧格式数据
    await page.addInitScript(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          account: {
            name: "雪碧官号",
            platform: "douyin",
            accountUrl: "",
            brand: { name: "雪碧", tone: "活泼", rules: ["不黑竞品"], industry: "饮料" },
            brandMaterials: [],
            products: [{ name: "雪碧无糖", description: "0糖", sellingPoints: [], imagePaths: [], links: [] }],
            personas: [{ name: "年轻人", description: "18-25" }],
            benchmarkAccounts: [],
          },
          topics: [{ id: "t1", title: "夏日热点", angle: "", description: "", type: "traffic", relatedTrendIds: [], estimatedAppeal: "", status: "approved", createdAt: "2026-01-01" }],
          scripts: [],
          trends: [{ id: "tr1", title: "高考季", description: "", category: "platform_hot", section: "global", source: "微博", heatScore: 8, relevance: "", fetchedAt: "2026-01-01" }],
          trendsDate: "2026-01-01",
          reviewPersonas: null,
          reviewResults: null,
        })
      );
    });

    await page.goto("/");

    // 等待页面加载完成（useEffect 执行）
    await expect(page.locator("h1")).toContainText("工作台");

    const migrated = await page.evaluate(() => {
      const raw = localStorage.getItem("alphato_data");
      return raw ? JSON.parse(raw) : null;
    });

    expect(migrated).not.toBeNull();
    expect(Array.isArray(migrated.accounts)).toBe(true);
    expect(migrated.accounts.length).toBe(1);
    expect(migrated.activeAccountId).toBeTruthy();
    expect(migrated.activeAccountId).toBe(migrated.accounts[0].id);

    const acc = migrated.accounts[0];
    expect(acc.brand.name).toBe("雪碧");
    expect(acc.name).toBe("雪碧官号");
    expect(acc.products.length).toBe(1);
    expect(acc.personas.length).toBe(1);

    // 工作区数据搬进了 account 内
    expect(acc.topics.length).toBe(1);
    expect(acc.topics[0].title).toBe("夏日热点");
    expect(acc.trends.length).toBe(1);
    expect(acc.trends[0].title).toBe("高考季");
    expect(acc.trendsDate).toBe("2026-01-01");

    // 旧的顶层字段不应存在
    expect("account" in migrated).toBe(false);
    expect("topics" in migrated).toBe(false);
    expect("trends" in migrated).toBe(false);
  });

  test("阶段1: 工作台 UI 读迁移后数据正常", async ({ page }) => {
    await page.addInitScript(() => {
      const id = "fixed-id-1";
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id,
              name: "雪碧官号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "雪碧", tone: "活泼", rules: [], industry: "饮料" },
              brandMaterials: [],
              products: [{ name: "雪碧无糖", description: "", sellingPoints: [], imagePaths: [], links: [] }],
              personas: [{ name: "年轻人", description: "" }],
              benchmarkAccounts: [],
              topics: [
                { id: "t1", title: "夏日话题", angle: "夏天", description: "", type: "traffic", relatedTrendIds: [], estimatedAppeal: "", status: "approved", createdAt: "2026-01-01" },
                { id: "t2", title: "高考话题", angle: "高考", description: "", type: "traffic", relatedTrendIds: [], estimatedAppeal: "", status: "pending", createdAt: "2026-01-01" },
              ],
              scripts: [],
              trends: [],
              trendsDate: null,
              reviewPersonas: null,
              reviewResults: null,
            },
          ],
          activeAccountId: id,
        })
      );
    });

    await page.goto("/");
    await expect(page.locator("h1")).toContainText("工作台");

    // 账号信息显示（sidebar 也会显示，scope 到 main）
    const main = page.getByRole("main");
    await expect(main.getByText("雪碧官号")).toBeVisible();
    await expect(main.getByText("雪碧", { exact: true })).toBeVisible();
    await expect(main.getByText("饮料")).toBeVisible();

    // 最近选题
    await expect(main.getByText("夏日话题")).toBeVisible();
    await expect(main.getByText("高考话题")).toBeVisible();
  });

  test("阶段1: settings 编辑现有品牌——id 和工作区数据保留", async ({ page }) => {
    await page.addInitScript(() => {
      const id = "preserve-test-id";
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id,
              name: "原账号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "原品牌", tone: "", rules: [], industry: "原行业" },
              brandMaterials: [],
              products: [],
              personas: [],
              benchmarkAccounts: [],
              topics: [{ id: "topic-keep", title: "应被保留", angle: "", description: "", type: "traffic", relatedTrendIds: [], estimatedAppeal: "", status: "pending", createdAt: "2026-01-01" }],
              scripts: [],
              trends: [],
              trendsDate: null,
              reviewPersonas: null,
              reviewResults: null,
            },
          ],
          activeAccountId: id,
        })
      );
    });

    await page.goto("/settings");
    // 等 useEffect 把现有数据填进表单
    await expect(page.locator("#brandName")).toHaveValue("原品牌");
    await page.fill("#brandName", "改后品牌");
    await page.click("text=保存设置");
    await expect(page.locator("text=已保存")).toBeVisible();

    const after = await page.evaluate(() => {
      const raw = localStorage.getItem("alphato_data");
      return raw ? JSON.parse(raw) : null;
    });

    // id 没变 (没有冒出第二个 account)
    expect(after.accounts.length).toBe(1);
    expect(after.accounts[0].id).toBe("preserve-test-id");
    expect(after.activeAccountId).toBe("preserve-test-id");
    expect(after.accounts[0].brand.name).toBe("改后品牌");

    // 工作区数据保留
    expect(after.accounts[0].topics.length).toBe(1);
    expect(after.accounts[0].topics[0].title).toBe("应被保留");
  });

  test("阶段1: 空 localStorage 不崩溃", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });

    await page.goto("/");
    await expect(page.locator("h1")).toContainText("工作台");
    await expect(page.getByText("还没有配置账号")).toBeVisible();
  });
});
