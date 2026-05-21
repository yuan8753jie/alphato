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

    // 等迁移落盘
    await page.waitForFunction(() => {
      const raw = localStorage.getItem("alphato_data");
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed.accounts);
      } catch {
        return false;
      }
    });

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

test.describe("阶段2: 品牌切换器", () => {
  async function seedTwoAccounts(page: import("@playwright/test").Page) {
    // 先 goto 拿到 origin，再 evaluate 注入；不用 addInitScript 否则 reload 会复位
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "sprite-id",
              name: "雪碧官号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "雪碧", tone: "活泼", rules: [], industry: "饮料" },
              brandMaterials: [],
              products: [],
              personas: [],
              benchmarkAccounts: [],
              topics: [{ id: "t-sprite", title: "雪碧专属选题", angle: "", description: "", type: "traffic", relatedTrendIds: [], estimatedAppeal: "", status: "pending", createdAt: "2026-01-01" }],
              scripts: [],
              trends: [],
              trendsDate: null,
              reviewPersonas: null,
              reviewResults: null,
            },
            {
              id: "honor-id",
              name: "荣耀官号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "荣耀手机", tone: "科技感", rules: [], industry: "3C" },
              brandMaterials: [],
              products: [],
              personas: [],
              benchmarkAccounts: [],
              topics: [{ id: "t-honor", title: "荣耀专属选题", angle: "", description: "", type: "traffic", relatedTrendIds: [], estimatedAppeal: "", status: "pending", createdAt: "2026-01-01" }],
              scripts: [],
              trends: [],
              trendsDate: null,
              reviewPersonas: null,
              reviewResults: null,
            },
          ],
          activeAccountId: "sprite-id",
        })
      );
    });
  }

  test("切换器列出所有品牌并标记当前", async ({ page }) => {
    await seedTwoAccounts(page);
    await page.goto("/");

    await page.getByTestId("brand-switcher-toggle").click();
    const panel = page.getByTestId("brand-switcher-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("雪碧")).toBeVisible();
    await expect(panel.getByText("荣耀手机")).toBeVisible();
    await expect(panel.getByText("新建品牌")).toBeVisible();
    await expect(panel.getByText("删除当前品牌")).toBeVisible();
  });

  test("切换品牌后页面刷新且选题完全隔离", async ({ page }) => {
    await seedTwoAccounts(page);
    await page.goto("/");

    const main = page.getByRole("main");
    await expect(main.getByText("雪碧专属选题")).toBeVisible();
    await expect(main.getByText("荣耀专属选题")).not.toBeVisible();

    await page.getByTestId("brand-switcher-toggle").click();
    await page.getByTestId("brand-switcher-panel").getByText("荣耀手机").click();

    // 切换会触发 reload；等新页面加载
    await page.waitForLoadState("load");
    await expect(main.getByText("荣耀专属选题")).toBeVisible();
    await expect(main.getByText("雪碧专属选题")).not.toBeVisible();

    // 验证 activeAccountId 已改
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("alphato_data")!));
    expect(after.activeAccountId).toBe("honor-id");
  });

  test("删除需输入品牌名才能确认", async ({ page }) => {
    await seedTwoAccounts(page);
    await page.goto("/");

    await page.getByTestId("brand-switcher-toggle").click();
    await page.getByTestId("brand-delete-trigger").click();

    const modal = page.getByTestId("brand-delete-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByText("删除品牌「雪碧」？")).toBeVisible();

    const confirmBtn = page.getByTestId("brand-delete-confirm");
    await expect(confirmBtn).toBeDisabled();

    // 输错不行
    await page.getByTestId("brand-delete-input").fill("雪");
    await expect(confirmBtn).toBeDisabled();

    // 输对了
    await page.getByTestId("brand-delete-input").fill("雪碧");
    await expect(confirmBtn).toBeEnabled();
  });

  test("删除当前品牌后另一品牌接管 active", async ({ page }) => {
    await seedTwoAccounts(page);
    await page.goto("/");

    await page.getByTestId("brand-switcher-toggle").click();
    await page.getByTestId("brand-delete-trigger").click();
    await page.getByTestId("brand-delete-input").fill("雪碧");
    await page.getByTestId("brand-delete-confirm").click();

    await page.waitForLoadState("load");

    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("alphato_data")!));
    expect(after.accounts.length).toBe(1);
    expect(after.accounts[0].id).toBe("honor-id");
    expect(after.activeAccountId).toBe("honor-id");

    const main = page.getByRole("main");
    await expect(main.getByText("荣耀专属选题")).toBeVisible();
  });

  test("/setup 是新建品牌流程不覆盖现有", async ({ page }) => {
    await seedTwoAccounts(page);
    await page.goto("/setup");

    await expect(page.locator("h1")).toContainText("新建品牌");
    // 表单是空的（不预填）
    await expect(page.locator("#brandName")).toHaveValue("");

    await page.fill("#accountName", "Lux官号");
    await page.fill("#brandName", "Lux力士");
    await page.fill("#industry", "日化");
    await page.click("text=创建品牌");

    // 等跳转回首页
    await page.waitForURL("**/");

    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("alphato_data")!));
    expect(after.accounts.length).toBe(3);
    const lux = after.accounts.find((a: { brand: { name: string } }) => a.brand.name === "Lux力士");
    expect(lux).toBeTruthy();
    expect(after.activeAccountId).toBe(lux.id);
    // 原有的雪碧、荣耀没被改
    expect(after.accounts.some((a: { id: string }) => a.id === "sprite-id")).toBe(true);
    expect(after.accounts.some((a: { id: string }) => a.id === "honor-id")).toBe(true);
  });

  test("空状态显示新建品牌入口", async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto("/");
    // sidebar 显示"新建品牌"按钮
    const sidebar = page.locator("aside");
    await expect(sidebar.getByText("新建品牌")).toBeVisible();
  });
});

test.describe("阶段3A: 产品 id 迁移", () => {
  test("旧产品无 id 时自动补 UUID", async ({ page }) => {
    // 先开页面拿 origin
    await page.goto("/");
    // 注入老结构（accounts[]，但产品没 id）
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "test-brand-id",
              name: "测试",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "测试", tone: "", rules: [], industry: "" },
              brandMaterials: [],
              products: [
                { name: "产品A", description: "", sellingPoints: [], imagePaths: [], links: [] },
                { name: "产品B", description: "", sellingPoints: [], imagePaths: [], links: [] },
              ],
              personas: [],
              benchmarkAccounts: [],
              topics: [],
              scripts: [],
              trends: [],
              trendsDate: null,
              reviewPersonas: null,
              reviewResults: null,
            },
          ],
          activeAccountId: "test-brand-id",
        })
      );
    });
    // reload 触发 loadData → 迁移
    await page.reload();
    await expect(page.locator("h1")).toContainText("工作台");

    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("alphato_data")!));
    const products = after.accounts[0].products;
    expect(products.length).toBe(2);
    expect(products[0].id).toBeTruthy();
    expect(products[1].id).toBeTruthy();
    expect(products[0].id).not.toBe(products[1].id);
    expect(products[0].name).toBe("产品A");
    expect(products[1].name).toBe("产品B");
  });

  test("已有 id 的产品保留原 id（迁移幂等）", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "brand-x",
              name: "测试",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "测试", tone: "", rules: [], industry: "" },
              brandMaterials: [],
              products: [
                { id: "stable-prod-1", name: "产品A", description: "", sellingPoints: [], imagePaths: [], links: [] },
              ],
              personas: [],
              benchmarkAccounts: [],
              topics: [],
              scripts: [],
              trends: [],
              trendsDate: null,
              reviewPersonas: null,
              reviewResults: null,
            },
          ],
          activeAccountId: "brand-x",
        })
      );
    });

    await page.reload();
    await expect(page.locator("h1")).toContainText("工作台");

    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("alphato_data")!));
    expect(after.accounts[0].products[0].id).toBe("stable-prod-1");
  });

  test("settings 添加新产品时自动生成 id", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "acc-1",
              name: "雪碧",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "雪碧", tone: "", rules: [], industry: "饮料" },
              brandMaterials: [],
              products: [],
              personas: [],
              benchmarkAccounts: [],
              topics: [], scripts: [], trends: [], trendsDate: null,
              reviewPersonas: null, reviewResults: null,
            },
          ],
          activeAccountId: "acc-1",
        })
      );
    });

    await page.goto("/settings");
    await page.getByRole("tab", { name: "产品库" }).click();
    await page.getByRole("button", { name: "添加产品" }).click();
    // 第一个产品输入框出现
    await page.getByPlaceholder("产品名").first().fill("雪碧无糖");
    await page.click("text=保存设置");
    await expect(page.locator("text=已保存")).toBeVisible();

    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("alphato_data")!));
    const products = after.accounts[0].products;
    expect(products.length).toBe(1);
    expect(products[0].id).toBeTruthy();
    expect(products[0].name).toBe("雪碧无糖");
  });
});

test.describe("阶段3B: Topic ↔ Product 绑定", () => {
  async function seedHonor(page: import("@playwright/test").Page) {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "honor",
              name: "荣耀官号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "荣耀手机", tone: "", rules: [], industry: "3C" },
              brandMaterials: [],
              products: [
                { id: "p-400", name: "荣耀400", description: "", sellingPoints: [], imagePaths: [], links: [] },
                { id: "p-v5", name: "荣耀V5", description: "", sellingPoints: [], imagePaths: [], links: [] },
                { id: "p-500", name: "荣耀500", description: "", sellingPoints: [], imagePaths: [], links: [] },
              ],
              personas: [],
              benchmarkAccounts: [],
              topics: [
                { id: "t1", title: "荣耀400 选题A", angle: "", description: "", type: "traffic", relatedTrendIds: [], estimatedAppeal: "", status: "pending", productIds: ["p-400"], createdAt: "2026-01-01" },
                { id: "t2", title: "荣耀400 选题B", angle: "", description: "", type: "trust", relatedTrendIds: [], estimatedAppeal: "", status: "pending", productIds: ["p-400"], createdAt: "2026-01-01" },
                { id: "t3", title: "V5 折叠测评", angle: "", description: "", type: "conversion", relatedTrendIds: [], estimatedAppeal: "", status: "pending", productIds: ["p-v5"], createdAt: "2026-01-01" },
                { id: "t4", title: "全系对比", angle: "", description: "", type: "trust", relatedTrendIds: [], estimatedAppeal: "", status: "pending", productIds: ["p-400", "p-v5", "p-500"], createdAt: "2026-01-01" },
                { id: "t5", title: "品牌故事", angle: "", description: "", type: "persona", relatedTrendIds: [], estimatedAppeal: "", status: "pending", productIds: [], createdAt: "2026-01-01" },
              ],
              scripts: [],
              trends: [
                { id: "tr1", title: "fake trend", description: "", category: "platform_hot", section: "global", source: "x", heatScore: 5, relevance: "", fetchedAt: "2026-01-01" },
              ],
              trendsDate: "2026-01-01",
              reviewPersonas: null,
              reviewResults: null,
            },
          ],
          activeAccountId: "honor",
        })
      );
    });
    await page.reload();
  }

  test("产品筛选行显示且统计正确", async ({ page }) => {
    await seedHonor(page);
    await page.goto("/topics");

    const row = page.getByTestId("product-filter-row");
    await expect(row).toBeVisible();
    await expect(row.getByTestId("product-chip-all")).toContainText("全部 (5)");
    await expect(row.getByTestId("product-chip-generic")).toContainText("通用 (1)");
    // 荣耀400 在 t1/t2/t4 中出现 = 3
    await expect(row.getByTestId("product-chip-p-400")).toContainText("荣耀400 (3)");
    // V5 在 t3/t4 = 2
    await expect(row.getByTestId("product-chip-p-v5")).toContainText("荣耀V5 (2)");
    // 500 仅在 t4 = 1
    await expect(row.getByTestId("product-chip-p-500")).toContainText("荣耀500 (1)");
  });

  test("点击产品 chip 过滤卡片", async ({ page }) => {
    await seedHonor(page);
    await page.goto("/topics");

    await page.getByTestId("product-chip-p-v5").click();
    await expect(page.getByText("V5 折叠测评")).toBeVisible();
    await expect(page.getByText("全系对比")).toBeVisible(); // t4 也含 V5
    await expect(page.getByText("荣耀400 选题A")).not.toBeVisible();
    await expect(page.getByText("品牌故事")).not.toBeVisible();
  });

  test("点击通用 chip 只显示无产品绑定", async ({ page }) => {
    await seedHonor(page);
    await page.goto("/topics");

    await page.getByTestId("product-chip-generic").click();
    await expect(page.getByText("品牌故事")).toBeVisible();
    await expect(page.getByText("荣耀400 选题A")).not.toBeVisible();
    await expect(page.getByText("V5 折叠测评")).not.toBeVisible();
  });

  test("topic 卡片显示产品标签和通用标记", async ({ page }) => {
    await seedHonor(page);
    await page.goto("/topics");

    const t1 = page.locator("text=荣耀400 选题A").locator("xpath=ancestor::*[contains(@class, 'p-4')]").first();
    await expect(t1.locator("text=荣耀400").first()).toBeVisible();

    const t5 = page.locator("text=品牌故事").locator("xpath=ancestor::*[contains(@class, 'p-4')]").first();
    await expect(t5.getByText("通用", { exact: true })).toBeVisible();

    // 全系对比绑了 3 个产品：显示前 2 + "+1"
    const t4 = page.locator("text=全系对比").locator("xpath=ancestor::*[contains(@class, 'p-4')]").first();
    await expect(t4.getByText("+1")).toBeVisible();
  });

  test("生成按钮根据筛选状态改变文案", async ({ page }) => {
    await seedHonor(page);
    await page.goto("/topics");

    // 默认是"全部"
    await expect(page.getByRole("button", { name: /^生成选题$/ })).toBeVisible();

    await page.getByTestId("product-chip-p-400").click();
    await expect(page.getByRole("button", { name: /为「荣耀400」生成选题/ })).toBeVisible();

    await page.getByTestId("product-chip-generic").click();
    await expect(page.getByRole("button", { name: /生成通用选题/ })).toBeVisible();
  });

  test("生成请求带上 focusProductId（mock API）", async ({ page }) => {
    await seedHonor(page);

    let capturedBody: { focusProductId?: string } | null = null;
    await page.route("/api/generate-topics", async (route) => {
      capturedBody = await route.request().postDataJSON();
      // 返回伪造响应避免真打 LLM
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          topics: [],
          selectedTrends: [],
        }),
      });
    });

    await page.goto("/topics");
    await page.getByTestId("product-chip-p-v5").click();
    await page.getByRole("button", { name: /为「荣耀V5」生成选题/ }).click();

    await expect.poll(() => capturedBody?.focusProductId).toBe("p-v5");
  });
});

test.describe("阶段3C: Script ↔ Product 绑定", () => {
  async function seedHonorForScript(page: import("@playwright/test").Page) {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "honor",
              name: "荣耀官号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "荣耀手机", tone: "", rules: [], industry: "3C" },
              brandMaterials: [],
              products: [
                { id: "p-400", name: "荣耀400", description: "", sellingPoints: [], imagePaths: [], links: [] },
                { id: "p-v5", name: "荣耀V5", description: "", sellingPoints: [], imagePaths: [], links: [] },
              ],
              personas: [],
              benchmarkAccounts: [],
              topics: [
                { id: "topic-v5", title: "V5 折叠测评", angle: "", description: "", type: "conversion", relatedTrendIds: [], estimatedAppeal: "", status: "pending", productIds: ["p-v5"], createdAt: "2026-01-01" },
                { id: "topic-generic", title: "品牌故事", angle: "", description: "", type: "persona", relatedTrendIds: [], estimatedAppeal: "", status: "pending", productIds: [], createdAt: "2026-01-01" },
              ],
              scripts: [],
              trends: [],
              trendsDate: null,
              reviewPersonas: null,
              reviewResults: null,
            },
          ],
          activeAccountId: "honor",
        })
      );
    });
  }

  test("topic 详情页显示产品选择器", async ({ page }) => {
    await seedHonorForScript(page);
    await page.goto("/topics/topic-v5");

    const select = page.getByTestId("script-product-select");
    await expect(select).toBeVisible();
    // V5 是 topic 绑定的，应被默认选中
    await expect(select).toHaveValue("p-v5");
  });

  test("topic 没绑定产品时选择器 fallback 到首个产品", async ({ page }) => {
    await seedHonorForScript(page);
    await page.goto("/topics/topic-generic");

    const select = page.getByTestId("script-product-select");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("p-400");
  });

  test("生成脚本请求带上选中的 productId", async ({ page }) => {
    await seedHonorForScript(page);

    let capturedBody: { productId?: string } | null = null;
    await page.route("/api/generate-script", async (route) => {
      capturedBody = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          scripts: [],
        }),
      });
    });

    await page.goto("/topics/topic-v5");
    // 切到 400 看是否覆盖了 topic 推荐的 V5
    await page.getByTestId("script-product-select").selectOption("p-400");
    await page.getByRole("button", { name: /生成 4 组脚本/ }).click();

    await expect.poll(() => capturedBody?.productId).toBe("p-400");
  });

  test("选「通用」时不传 productId", async ({ page }) => {
    await seedHonorForScript(page);

    const captured: { body: { productId?: string } | null } = { body: null };
    await page.route("/api/generate-script", async (route) => {
      captured.body = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, scripts: [] }),
      });
    });

    await page.goto("/topics/topic-v5");
    await page.getByTestId("script-product-select").selectOption(""); // 通用
    await page.getByRole("button", { name: /生成 4 组脚本/ }).click();

    await expect.poll(() => captured.body !== null).toBe(true);
    expect(captured.body?.productId).toBeUndefined();
  });
});

test.describe("阶段5: 视频引用产品图（Seedance 智能参考）", () => {
  async function seedHonorWithImages(page: import("@playwright/test").Page) {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "honor",
              name: "荣耀官号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "荣耀", tone: "", rules: [], industry: "3C" },
              brandMaterials: [],
              products: [
                {
                  id: "p-magic",
                  name: "Magic8 Pro",
                  description: "",
                  sellingPoints: [],
                  imagePaths: [
                    "https://example.com/magic-front.jpg",
                    "https://example.com/magic-back.jpg",
                    "https://example.com/magic-side.jpg",
                    "/uploads/product-images/honor/p-magic/local-1.png",
                  ],
                  links: [],
                  documents: [],
                },
              ],
              personas: [],
              benchmarkAccounts: [],
              topics: [
                {
                  id: "topic-magic",
                  title: "Magic8 拍照测评",
                  angle: "",
                  description: "",
                  type: "conversion",
                  relatedTrendIds: [],
                  estimatedAppeal: "",
                  status: "pending",
                  productIds: ["p-magic"],
                  createdAt: "2026-05-20",
                },
              ],
              scripts: [
                {
                  id: "script-1",
                  topicId: "topic-magic",
                  productId: "p-magic",
                  variant: "free-voiceover",
                  label: "稳健版·口播",
                  isCreative: false,
                  hasVo: true,
                  scenes: [
                    { sceneNumber: 1, shotType: "极致特写", visual: "镜头", audio: "音乐", text: "看", duration: "3" },
                  ],
                  fullText: "测试",
                  createdAt: "2026-05-20",
                },
              ],
              trends: [], trendsDate: null,
              reviewPersonas: null, reviewResults: null,
            },
          ],
          activeAccountId: "honor",
        })
      );
    });
  }

  test("有图时显示参考图面板，默认关", async ({ page }) => {
    await seedHonorWithImages(page);
    await page.goto("/topics/topic-magic");
    const panel = page.getByTestId("ref-images-panel");
    await expect(panel).toBeVisible();
    const toggle = page.getByTestId("ref-images-toggle");
    await expect(toggle).not.toBeChecked();
    // 网格默认隐藏
    await expect(page.getByTestId("ref-images-grid")).not.toBeVisible();
  });

  test("开启 toggle → 网格出现 → 选 2 张显示序号", async ({ page }) => {
    await seedHonorWithImages(page);
    await page.goto("/topics/topic-magic");
    await page.getByTestId("ref-images-toggle").check();
    const grid = page.getByTestId("ref-images-grid");
    await expect(grid).toBeVisible();
    // 4 张图都在
    await expect(grid.locator("button")).toHaveCount(4);

    await page.getByTestId("ref-image-0").click();
    await page.getByTestId("ref-image-2").click();
    await expect(page.getByText("已选 2/9")).toBeVisible();
  });

  test("生成视频请求带上选中的多张参考图", async ({ page }) => {
    await seedHonorWithImages(page);

    const captured: { body: { referenceImages?: string[]; productName?: string } | null } = { body: null };
    await page.route("/api/generate-video", async (route) => {
      captured.body = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, task: { taskId: "fake-task" } }),
      });
    });

    await page.goto("/topics/topic-magic");
    await page.getByTestId("ref-images-toggle").check();
    await page.getByTestId("ref-image-0").click();
    await page.getByTestId("ref-image-1").click();
    await page.getByTestId("ref-image-2").click();

    await page.getByRole("button", { name: /生成视频/ }).click();
    await expect.poll(() => captured.body?.referenceImages?.length).toBe(3);
    expect(captured.body?.referenceImages).toEqual([
      "https://example.com/magic-front.jpg",
      "https://example.com/magic-back.jpg",
      "https://example.com/magic-side.jpg",
    ]);
    expect(captured.body?.productName).toBe("Magic8 Pro");
  });

  test("toggle 关时不传参考图", async ({ page }) => {
    await seedHonorWithImages(page);

    const captured: { body: { referenceImages?: string[] } | null } = { body: null };
    await page.route("/api/generate-video", async (route) => {
      captured.body = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, task: { taskId: "fake-task" } }),
      });
    });

    await page.goto("/topics/topic-magic");
    // 不勾 toggle
    await page.getByRole("button", { name: /生成视频/ }).click();
    await expect.poll(() => captured.body !== null).toBe(true);
    expect(captured.body?.referenceImages).toEqual([]);
  });
});

test.describe("阶段8: 批量 N 轮生成选题", () => {
  async function seedHonorEmpty(page: import("@playwright/test").Page) {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "honor",
              name: "荣耀官号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "荣耀", tone: "", rules: [], industry: "3C" },
              brandMaterials: [],
              products: [
                { id: "p-magic", name: "Magic8", description: "", sellingPoints: [], imagePaths: [], links: [], documents: [] },
              ],
              personas: [], benchmarkAccounts: [],
              topics: [], scripts: [],
              trends: [
                { id: "tr1", title: "fake trend", description: "", category: "platform_hot", section: "global", source: "x", heatScore: 5, relevance: "", fetchedAt: "2026-05-21" },
              ],
              trendsDate: "2026-05-21",
              reviewPersonas: null, reviewResults: null,
            },
          ],
          activeAccountId: "honor",
        })
      );
    });
  }

  test("默认 ×1 文案为「生成选题」", async ({ page }) => {
    await seedHonorEmpty(page);
    await page.goto("/topics");
    await expect(page.getByTestId("batch-rounds-1")).toBeVisible();
    await expect(page.getByTestId("batch-rounds-3")).toBeVisible();
    await expect(page.getByTestId("batch-rounds-5")).toBeVisible();
    // 默认 ×1 → 文案"生成选题"
    await expect(page.getByRole("button", { name: /^生成选题$/ }).last()).toBeVisible();
  });

  test("选 ×3 → 文案变为「生成 3 轮选题」", async ({ page }) => {
    await seedHonorEmpty(page);
    await page.goto("/topics");
    await page.getByTestId("batch-rounds-3").click();
    await expect(page.getByRole("button", { name: /生成 3 轮选题/ }).last()).toBeVisible();
  });

  test("×3 实际调 API 3 次，选题累加", async ({ page }) => {
    await seedHonorEmpty(page);

    let callCount = 0;
    await page.route("/api/generate-topics", async (route) => {
      callCount++;
      const round = callCount;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          topics: [
            { id: `t-r${round}-1`, title: `第${round}轮选题A`, type: "traffic", angle: "", description: "", relatedTrendIds: [], productIds: [], estimatedAppeal: "", status: "pending", createdAt: "2026-05-21" },
            { id: `t-r${round}-2`, title: `第${round}轮选题B`, type: "trust", angle: "", description: "", relatedTrendIds: [], productIds: [], estimatedAppeal: "", status: "pending", createdAt: "2026-05-21" },
          ],
          selectedTrends: [],
        }),
      });
    });

    await page.goto("/topics");
    await page.getByTestId("batch-rounds-3").click();
    await page.getByRole("button", { name: /生成 3 轮选题/ }).last().click();

    // 等 3 次调用完
    await expect.poll(() => callCount, { timeout: 15000 }).toBe(3);

    // 6 条选题都在
    await expect(page.getByText("第1轮选题A")).toBeVisible();
    await expect(page.getByText("第2轮选题A")).toBeVisible();
    await expect(page.getByText("第3轮选题A")).toBeVisible();

    // localStorage 里 6 条
    const data = await page.evaluate(() => JSON.parse(localStorage.getItem("alphato_data")!));
    expect(data.accounts[0].topics.length).toBe(6);
  });

  test("批量中点「停止」中止后续轮，已生成的保留", async ({ page }) => {
    await seedHonorEmpty(page);

    let callCount = 0;
    await page.route("/api/generate-topics", async (route) => {
      callCount++;
      const round = callCount;
      // 第 1 轮快速返回，第 2 轮慢一点让用户有机会点停止
      if (round === 2) await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          topics: [
            { id: `t-r${round}`, title: `第${round}轮选题`, type: "traffic", angle: "", description: "", relatedTrendIds: [], productIds: [], estimatedAppeal: "", status: "pending", createdAt: "2026-05-21" },
          ],
          selectedTrends: [],
        }),
      });
    });

    await page.goto("/topics");
    await page.getByTestId("batch-rounds-5").click();
    await page.getByRole("button", { name: /生成 5 轮选题/ }).last().click();

    // 等第 1 轮完
    await expect(page.getByText("第1轮选题")).toBeVisible({ timeout: 8000 });

    // 点停止
    await page.getByRole("button", { name: "停止" }).click();

    // 等一会，确认没有继续生成第 3、4、5 轮
    await page.waitForTimeout(1500);
    const finalCount = callCount;
    expect(finalCount).toBeLessThan(5);

    // 已生成的至少保留了一条
    const data = await page.evaluate(() => JSON.parse(localStorage.getItem("alphato_data")!));
    expect(data.accounts[0].topics.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe("阶段7: 空状态产品选择器", () => {
  test("无选题时显示产品选择器 + 按钮文案随选择变化", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "honor",
              name: "荣耀官号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "荣耀", tone: "", rules: [], industry: "3C" },
              brandMaterials: [],
              products: [
                { id: "p-400", name: "荣耀400", description: "", sellingPoints: [], imagePaths: [], links: [], documents: [] },
                { id: "p-v5", name: "荣耀V5", description: "", sellingPoints: [], imagePaths: [], links: [], documents: [] },
              ],
              personas: [],
              benchmarkAccounts: [],
              topics: [],       // 空 — 触发空状态
              scripts: [],
              trends: [
                { id: "tr1", title: "fake trend", description: "", category: "platform_hot", section: "global", source: "x", heatScore: 5, relevance: "", fetchedAt: "2026-05-21" },
              ],
              trendsDate: "2026-05-21",
              reviewPersonas: null, reviewResults: null,
            },
          ],
          activeAccountId: "honor",
        })
      );
    });

    await page.goto("/topics");

    const picker = page.getByTestId("empty-state-product-picker");
    await expect(picker).toBeVisible();
    await expect(picker.getByText("AI 自动判断（混合品牌+产品）")).toBeVisible();
    await expect(picker.getByText("通用（不绑产品）")).toBeVisible();
    await expect(picker.getByText("荣耀400")).toBeVisible();
    await expect(picker.getByText("荣耀V5")).toBeVisible();

    // 默认 AI 自动 → 按钮文案 "生成选题"
    // header 和空状态各有一个 按钮（同步），用 .last() 锁定空状态那个
    await expect(page.getByRole("button", { name: /^生成选题$/ }).last()).toBeVisible();

    // 选 V5 → 文案变
    await picker.getByText("荣耀V5").click();
    await expect(page.getByRole("button", { name: /为「荣耀V5」生成选题/ }).last()).toBeVisible();

    // 选通用 → 文案变
    await picker.getByText("通用（不绑产品）").click();
    await expect(page.getByRole("button", { name: /生成通用选题/ }).last()).toBeVisible();
  });

  test("空状态选了产品 → 生成请求带上 focusProductId", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "honor",
              name: "荣耀",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "荣耀", tone: "", rules: [], industry: "3C" },
              brandMaterials: [],
              products: [
                { id: "p-magic", name: "Magic8", description: "", sellingPoints: [], imagePaths: [], links: [], documents: [] },
              ],
              personas: [], benchmarkAccounts: [],
              topics: [], scripts: [],
              trends: [
                { id: "tr1", title: "fake trend", description: "", category: "platform_hot", section: "global", source: "x", heatScore: 5, relevance: "", fetchedAt: "2026-05-21" },
              ],
              trendsDate: "2026-05-21",
              reviewPersonas: null, reviewResults: null,
            },
          ],
          activeAccountId: "honor",
        })
      );
    });

    const captured: { body: { focusProductId?: string } | null } = { body: null };
    await page.route("/api/generate-topics", async (route) => {
      captured.body = await route.request().postDataJSON();
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ success: true, topics: [], selectedTrends: [] }),
      });
    });

    await page.goto("/topics");
    await page.getByTestId("empty-state-product-picker").getByText("Magic8").click();
    await page.getByRole("button", { name: /为「Magic8」生成选题/ }).last().click();

    await expect.poll(() => captured.body?.focusProductId).toBe("p-magic");
  });
});

test.describe("阶段6: 视频本地持久化", () => {
  async function seedHonorWithScript(page: import("@playwright/test").Page) {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "honor",
              name: "荣耀官号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "荣耀", tone: "", rules: [], industry: "3C" },
              brandMaterials: [],
              products: [
                {
                  id: "p-magic",
                  name: "Magic8",
                  description: "",
                  sellingPoints: [],
                  imagePaths: [],
                  links: [],
                  documents: [],
                },
              ],
              personas: [],
              benchmarkAccounts: [],
              topics: [
                {
                  id: "topic-vid",
                  title: "Magic8 测评",
                  angle: "",
                  description: "",
                  type: "conversion",
                  relatedTrendIds: [],
                  estimatedAppeal: "",
                  status: "pending",
                  productIds: ["p-magic"],
                  createdAt: "2026-05-20",
                },
              ],
              scripts: [
                {
                  id: "script-fv",
                  topicId: "topic-vid",
                  productId: "p-magic",
                  variant: "free-voiceover",
                  label: "稳健版·口播",
                  scenes: [{ sceneNumber: 1, visual: "镜头", audio: "音乐", text: "看", duration: "3" }],
                  fullText: "test",
                  createdAt: "2026-05-20",
                },
              ],
              trends: [], trendsDate: null,
              reviewPersonas: null, reviewResults: null,
            },
          ],
          activeAccountId: "honor",
        })
      );
    });
  }

  test("生成视频成功后，本地 URL 落到 Script 上", async ({ page }) => {
    await seedHonorWithScript(page);

    // Mock 生成 + 状态查询
    await page.route("/api/generate-video", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, task: { taskId: "fake-task-123" } }),
      });
    });
    let pollCount = 0;
    await page.route("/api/video-status*", async (route) => {
      pollCount++;
      // 第 1 次返回 processing；第 2 次返回 succeed + 本地 URL
      const body = pollCount === 1
        ? { success: true, task: { taskId: "fake-task-123", status: "processing", videoUrl: undefined } }
        : { success: true, task: { taskId: "fake-task-123", status: "succeed", videoUrl: "/uploads/videos/fake-task-123.mp4" } };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    await page.goto("/topics/topic-vid");
    await page.getByRole("button", { name: /生成视频/ }).click();

    // 等成功（轮询间隔 5s，最多等 15s 一次给两次响应空间）
    await expect.poll(
      async () => {
        const data = await page.evaluate(() => JSON.parse(localStorage.getItem("alphato_data")!));
        const s = data.accounts[0].scripts.find((x: { id: string }) => x.id === "script-fv");
        return s?.videoUrl;
      },
      { timeout: 20000, intervals: [1000, 2000] }
    ).toBe("/uploads/videos/fake-task-123.mp4");

    // 再读 localStorage 验证 videoTaskId 也落了
    const data = await page.evaluate(() => JSON.parse(localStorage.getItem("alphato_data")!));
    const s = data.accounts[0].scripts.find((x: { id: string }) => x.id === "script-fv");
    expect(s.videoTaskId).toBe("fake-task-123");
  });

  test("页面刷新后，已生成的视频仍可播放（从 Script.videoUrl 恢复）", async ({ page }) => {
    // 预置一个已经有 videoUrl 的 script
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "honor",
              name: "荣耀官号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "荣耀", tone: "", rules: [], industry: "3C" },
              brandMaterials: [],
              products: [{ id: "p-magic", name: "Magic8", description: "", sellingPoints: [], imagePaths: [], links: [], documents: [] }],
              personas: [],
              benchmarkAccounts: [],
              topics: [
                { id: "topic-vid", title: "Magic8 测评", angle: "", description: "", type: "conversion", relatedTrendIds: [], estimatedAppeal: "", status: "pending", productIds: ["p-magic"], createdAt: "2026-05-20" },
              ],
              scripts: [
                {
                  id: "script-fv",
                  topicId: "topic-vid",
                  productId: "p-magic",
                  variant: "free-voiceover",
                  scenes: [{ sceneNumber: 1, visual: "镜头", audio: "音乐", text: "看", duration: "3" }],
                  fullText: "test",
                  videoUrl: "/uploads/videos/persisted-task.mp4",
                  videoTaskId: "persisted-task",
                  createdAt: "2026-05-20",
                },
              ],
              trends: [], trendsDate: null, reviewPersonas: null, reviewResults: null,
            },
          ],
          activeAccountId: "honor",
        })
      );
    });

    await page.goto("/topics/topic-vid");

    // <video> 元素出现，src 是本地路径
    const videoEl = page.locator("video");
    await expect(videoEl).toBeVisible();
    await expect(videoEl).toHaveAttribute("src", "/uploads/videos/persisted-task.mp4");
  });
});

test.describe("阶段4: 产品文档（PDF / MD）", () => {
  async function seedBrandWithProduct(page: import("@playwright/test").Page) {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "honor",
              name: "荣耀官号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "荣耀手机", tone: "", rules: [], industry: "3C" },
              brandMaterials: [],
              products: [
                {
                  id: "p-magic",
                  name: "Magic7",
                  description: "",
                  sellingPoints: [],
                  imagePaths: [],
                  links: [],
                  documents: [],
                },
              ],
              personas: [],
              benchmarkAccounts: [],
              topics: [],
              scripts: [],
              trends: [],
              trendsDate: null,
              reviewPersonas: null,
              reviewResults: null,
            },
          ],
          activeAccountId: "honor",
        })
      );
    });
  }

  test("上传 PDF → API 调用，UI 显示新文档", async ({ page }) => {
    await seedBrandWithProduct(page);

    const captured: { body: { accountId?: string; productId?: string } | null } = { body: null };
    const fakeDoc = {
      id: "doc-1",
      fileName: "magic7-spec.pdf",
      fileType: "pdf",
      fileUrl: "/uploads/product-docs/honor/p-magic/doc-1-magic7-spec.pdf",
      sizeBytes: 12345,
      extracted: {
        sellingPoints: ["AI 影像", "续航 5500mAh"],
        targetAudience: "25-35 岁科技尝鲜者，重视拍照",
        keyFeatures: ["第三代骁龙 8", "5500mAh 电池", "潜望长焦"],
        positioning: "影像旗舰",
        scenarios: ["旅行拍摄", "夜景人像"],
        summary: "Magic7 是 2026 年发布的旗舰，搭载第三代骁龙 8，5500mAh，主打 AI 影像与持久续航。",
      },
      uploadedAt: "2026-05-20T08:00:00Z",
    };

    await page.route("/api/extract-product-doc", async (route) => {
      const form = route.request().postData();
      // Playwright 的 multipart 取不到，简单读 headers + url 验证
      captured.body = { accountId: undefined, productId: undefined };
      // 用 contains 判断 multipart 里有 accountId / productId 字段
      if (form?.includes("honor")) captured.body.accountId = "honor";
      if (form?.includes("p-magic")) captured.body.productId = "p-magic";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, document: fakeDoc }),
      });
    });

    await page.goto("/settings");
    await page.getByRole("tab", { name: "产品库" }).click();

    // 触发上传
    const fileInput = page.locator(`[data-testid="product-docs-p-magic"] input[type="file"]`);
    await fileInput.setInputFiles({
      name: "magic7-spec.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 fake content"),
    });

    // 等 mock 返回
    await expect.poll(() => captured.body?.accountId).toBe("honor");
    expect(captured.body?.productId).toBe("p-magic");

    // UI 显示新文档
    await expect(page.getByText("magic7-spec.pdf")).toBeVisible();

    // 展开摘要
    await page.getByText("查看摘要").click();
    const docCard = page.locator('[data-testid="product-doc-doc-1"]');
    await expect(docCard.getByText("AI 影像", { exact: true })).toBeVisible(); // chip
    await expect(docCard.getByText("影像旗舰")).toBeVisible();
    await expect(docCard.getByText("25-35 岁科技尝鲜者，重视拍照")).toBeVisible();
  });

  test("产品图：一次选 3 张全部上传到服务器，localStorage 只存 URL", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "honor",
              name: "荣耀官号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "荣耀手机", tone: "", rules: [], industry: "3C" },
              brandMaterials: [],
              products: [
                {
                  id: "p-multi",
                  name: "Magic8",
                  description: "",
                  sellingPoints: [],
                  imagePaths: [],
                  links: [],
                  documents: [],
                },
              ],
              personas: [],
              benchmarkAccounts: [],
              topics: [], scripts: [], trends: [], trendsDate: null,
              reviewPersonas: null, reviewResults: null,
            },
          ],
          activeAccountId: "honor",
        })
      );
    });

    // Mock 上传 API：依次返回 3 个固定 URL
    let counter = 0;
    await page.route("/api/upload-product-image", async (route) => {
      counter++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          url: `/uploads/product-images/honor/p-multi/mock-${counter}.png`,
        }),
      });
    });

    await page.goto("/settings");
    await page.getByRole("tab", { name: "产品库" }).click();

    // 一次性选 3 张图
    const fileInput = page.locator(`input[type="file"][accept="image/*"]`).first();
    const pngs = [
      Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6300010000000500010d0a2db40000000049454e44ae426082", "hex"),
      Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6300fcffff3f0300070003e9a85d2d0000000049454e44ae426082", "hex"),
      Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63000100000005000100bb73ae6f0000000049454e44ae426082", "hex"),
    ];
    await fileInput.setInputFiles([
      { name: "a.png", mimeType: "image/png", buffer: pngs[0] },
      { name: "b.png", mimeType: "image/png", buffer: pngs[1] },
      { name: "c.png", mimeType: "image/png", buffer: pngs[2] },
    ]);

    // API 被调 3 次
    await expect.poll(() => counter).toBe(3);

    // 3 张缩略图渲染
    const thumbs = page.locator('img[alt^="Magic8"]');
    await expect(thumbs).toHaveCount(3);

    // 保存
    await page.click("text=保存设置");
    await expect(page.locator("text=已保存")).toBeVisible();

    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("alphato_data")!));
    const paths = after.accounts[0].products[0].imagePaths;
    expect(paths.length).toBe(3);
    // localStorage 里存的是 URL，不是 base64
    for (const p of paths) {
      expect(p.startsWith("/uploads/product-images/")).toBe(true);
      expect(p.startsWith("data:")).toBe(false);
    }
  });

  test("删除自家上传的图片：调 /api/delete-upload 清盘上文件", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "honor",
              name: "荣耀",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "荣耀", tone: "", rules: [], industry: "3C" },
              brandMaterials: [],
              products: [
                {
                  id: "p-x",
                  name: "Magic",
                  description: "",
                  sellingPoints: [],
                  imagePaths: [
                    "/uploads/product-images/honor/p-x/local-img.png",
                    "https://example.com/external-img.png",
                  ],
                  links: [],
                  documents: [],
                },
              ],
              personas: [],
              benchmarkAccounts: [],
              topics: [], scripts: [], trends: [], trendsDate: null,
              reviewPersonas: null, reviewResults: null,
            },
          ],
          activeAccountId: "honor",
        })
      );
    });

    let deletedUrl = "";
    let deleteCalled = false;
    await page.route("/api/delete-upload", async (route) => {
      const body = await route.request().postDataJSON();
      deletedUrl = body.fileUrl;
      deleteCalled = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    });

    await page.goto("/settings");
    await page.getByRole("tab", { name: "产品库" }).click();

    // 删第一张图（自家上传）—— hover 才显示 ×，用 force 直接点
    const thumbs = page.locator('img[alt^="Magic"]');
    await expect(thumbs).toHaveCount(2);
    await thumbs.first().hover();
    await thumbs.first().locator("..").locator("button").click();

    // 调了 delete-upload
    await expect.poll(() => deleteCalled).toBe(true);
    expect(deletedUrl).toBe("/uploads/product-images/honor/p-x/local-img.png");

    // 删第二张（外链）—— 不应调 delete-upload
    deleteCalled = false;
    const remaining = page.locator('img[alt^="Magic"]');
    await expect(remaining).toHaveCount(1);
    await remaining.first().hover();
    await remaining.first().locator("..").locator("button").click();
    await expect(remaining).toHaveCount(0);
    // 给一点时间确认 delete 没被调
    await page.waitForTimeout(200);
    expect(deleteCalled).toBe(false);
  });

  test("非允许的文件类型被前端 input.accept 限制", async ({ page }) => {
    await seedBrandWithProduct(page);
    await page.goto("/settings");
    await page.getByRole("tab", { name: "产品库" }).click();
    const fileInput = page.locator(`[data-testid="product-docs-p-magic"] input[type="file"]`);
    const accept = await fileInput.getAttribute("accept");
    expect(accept).toContain(".pdf");
    expect(accept).toContain(".md");
    expect(accept).toContain(".txt");
    expect(accept).not.toContain(".docx");
  });

  test("删除文档：UI 立刻移除 + 调 /api/delete-upload", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(
        "alphato_data",
        JSON.stringify({
          accounts: [
            {
              id: "honor",
              name: "荣耀官号",
              platform: "douyin",
              accountUrl: "",
              brand: { name: "荣耀手机", tone: "", rules: [], industry: "3C" },
              brandMaterials: [],
              products: [
                {
                  id: "p-magic",
                  name: "Magic7",
                  description: "",
                  sellingPoints: [],
                  imagePaths: [],
                  links: [],
                  documents: [
                    {
                      id: "doc-existing",
                      fileName: "old-spec.pdf",
                      fileType: "pdf",
                      fileUrl: "/uploads/product-docs/honor/p-magic/doc-existing-old-spec.pdf",
                      sizeBytes: 1000,
                      extracted: {
                        sellingPoints: [], targetAudience: "", keyFeatures: [],
                        positioning: "", scenarios: [], summary: "old",
                      },
                      uploadedAt: "2026-05-19T00:00:00Z",
                    },
                  ],
                },
              ],
              personas: [],
              benchmarkAccounts: [],
              topics: [], scripts: [], trends: [], trendsDate: null,
              reviewPersonas: null, reviewResults: null,
            },
          ],
          activeAccountId: "honor",
        })
      );
    });

    let deleteCalled = false;
    let deletedUrl = "";
    await page.route("/api/delete-upload", async (route) => {
      const body = await route.request().postDataJSON();
      deleteCalled = true;
      deletedUrl = body.fileUrl;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/settings");
    await page.getByRole("tab", { name: "产品库" }).click();

    await expect(page.getByText("old-spec.pdf")).toBeVisible();
    await page.getByRole("button", { name: "删除" }).filter({ hasText: /^删除$/ }).last().click();

    // UI 移除
    await expect(page.getByText("old-spec.pdf")).not.toBeVisible();
    // API 已调
    await expect.poll(() => deleteCalled).toBe(true);
    expect(deletedUrl).toBe("/uploads/product-docs/honor/p-magic/doc-existing-old-spec.pdf");

    // 保存后 localStorage 里也没了
    await page.click("text=保存设置");
    await expect(page.locator("text=已保存")).toBeVisible();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("alphato_data")!));
    expect(after.accounts[0].products[0].documents).toEqual([]);
  });
});
