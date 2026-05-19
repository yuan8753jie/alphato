import { AppData, Account, Topic, Script, Trend, ReviewPersonaData, ReviewResults, SelectedTrendsMeta, Product } from "./types";

const STORAGE_KEY = "alphato_data";

const defaultData: AppData = {
  accounts: [],
  activeAccountId: null,
};

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 给老 Product 补 id（兼容旧数据）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureProductIds(products: any[]): Product[] {
  return (products || []).map((p) => ({
    id: p.id || genId(),
    name: p.name || "",
    description: p.description || "",
    sellingPoints: p.sellingPoints || [],
    imagePaths: p.imagePaths || [],
    links: p.links || [],
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrate(raw: any): AppData {
  if (!raw || typeof raw !== "object") return defaultData;

  // New shape — return as-is (with safety defaults + product id backfill)
  if (Array.isArray(raw.accounts)) {
    const accounts = raw.accounts.map((a: Account) => ({
      ...a,
      products: ensureProductIds(a.products),
    }));
    return {
      accounts,
      activeAccountId: raw.activeAccountId ?? (accounts[0]?.id ?? null),
    };
  }

  // Old shape — has 'account' (possibly null) + top-level workspace
  if ("account" in raw) {
    if (!raw.account) {
      return defaultData;
    }
    const id = raw.account.id || genId();
    const account: Account = {
      id,
      name: raw.account.name || "",
      platform: raw.account.platform || "douyin",
      accountUrl: raw.account.accountUrl || "",
      brand: raw.account.brand || { name: "", tone: "", rules: [], industry: "" },
      brandMaterials: raw.account.brandMaterials || [],
      products: ensureProductIds(raw.account.products),
      personas: raw.account.personas || [],
      benchmarkAccounts: raw.account.benchmarkAccounts || [],
      topics: raw.topics || [],
      scripts: raw.scripts || [],
      trends: raw.trends || [],
      trendsDate: raw.trendsDate || null,
      reviewPersonas: raw.reviewPersonas || null,
      reviewResults: raw.reviewResults || null,
      selectedTrendsMeta: raw.selectedTrendsMeta || null,
    };
    return { accounts: [account], activeAccountId: id };
  }

  return defaultData;
}

export function loadData(): AppData {
  if (typeof window === "undefined") return defaultData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    const parsed = JSON.parse(raw);
    const migrated = migrate(parsed);
    // 持久化迁移：检测是否实质性变更（结构或产品 id），有变就写回
    const before = JSON.stringify(parsed);
    const after = JSON.stringify(migrated);
    if (before !== after) {
      localStorage.setItem(STORAGE_KEY, after);
    }
    return migrated;
  } catch {
    return defaultData;
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ===== Account management =====

export function listAccounts(): Account[] {
  return loadData().accounts;
}

export function getActiveAccountId(): string | null {
  return loadData().activeAccountId;
}

export function setActiveAccountId(id: string): void {
  const data = loadData();
  if (!data.accounts.some((a) => a.id === id)) return;
  data.activeAccountId = id;
  saveData(data);
}

export function getAccount(): Account | null {
  const data = loadData();
  return data.accounts.find((a) => a.id === data.activeAccountId) || null;
}

function emptyWorkspace(): Pick<Account, "topics" | "scripts" | "trends" | "trendsDate" | "reviewPersonas" | "reviewResults" | "selectedTrendsMeta"> {
  return {
    topics: [],
    scripts: [],
    trends: [],
    trendsDate: null,
    reviewPersonas: null,
    reviewResults: null,
    selectedTrendsMeta: null,
  };
}

export function createAccount(seed: Partial<Account>): Account {
  const data = loadData();
  const id = seed.id || genId();
  const newAccount: Account = {
    id,
    name: seed.name || "",
    platform: seed.platform || "douyin",
    accountUrl: seed.accountUrl || "",
    brand: seed.brand || { name: "", tone: "", rules: [], industry: "" },
    brandMaterials: seed.brandMaterials || [],
    products: seed.products || [],
    personas: seed.personas || [],
    benchmarkAccounts: seed.benchmarkAccounts || [],
    ...emptyWorkspace(),
  };
  data.accounts.push(newAccount);
  data.activeAccountId = id;
  saveData(data);
  return newAccount;
}

export function deleteAccount(id: string): void {
  const data = loadData();
  data.accounts = data.accounts.filter((a) => a.id !== id);
  if (data.activeAccountId === id) {
    data.activeAccountId = data.accounts[0]?.id ?? null;
  }
  saveData(data);
}

// Upsert active account — preserves id + workspace data when updating.
// Used by /setup and /settings pages that don't know about ids.
export function saveAccount(account: Account): void {
  const data = loadData();
  const targetId = account.id || data.activeAccountId;
  const existingIdx = targetId ? data.accounts.findIndex((a) => a.id === targetId) : -1;

  if (existingIdx >= 0) {
    const existing = data.accounts[existingIdx];
    data.accounts[existingIdx] = {
      ...account,
      id: existing.id,
      topics: existing.topics,
      scripts: existing.scripts,
      trends: existing.trends,
      trendsDate: existing.trendsDate,
      reviewPersonas: existing.reviewPersonas,
      reviewResults: existing.reviewResults,
      selectedTrendsMeta: existing.selectedTrendsMeta,
    };
    saveData(data);
  } else {
    const id = account.id || genId();
    data.accounts.push({
      ...account,
      id,
      ...emptyWorkspace(),
    });
    data.activeAccountId = id;
    saveData(data);
  }
}

// ===== Workspace data (scoped to active account) =====

function updateActiveAccount(updater: (a: Account) => Account): void {
  const data = loadData();
  const idx = data.accounts.findIndex((a) => a.id === data.activeAccountId);
  if (idx < 0) return;
  data.accounts[idx] = updater(data.accounts[idx]);
  saveData(data);
}

export function saveTopics(topics: Topic[]): void {
  updateActiveAccount((a) => ({ ...a, topics }));
}

export function getTopics(): Topic[] {
  return getAccount()?.topics ?? [];
}

export function updateTopic(topicId: string, updates: Partial<Topic>): void {
  updateActiveAccount((a) => {
    const idx = a.topics.findIndex((t) => t.id === topicId);
    if (idx < 0) return a;
    const topics = [...a.topics];
    topics[idx] = { ...topics[idx], ...updates };
    return { ...a, topics };
  });
}

export function scheduleTopic(topicId: string, date: string): void {
  updateTopic(topicId, { scheduledDate: date, status: "approved" });
}

export function unscheduleTopic(topicId: string): void {
  updateTopic(topicId, { scheduledDate: undefined });
}

export function getScheduledTopics(): Topic[] {
  return getTopics().filter((t) => t.scheduledDate);
}

export function getUnscheduledApprovedTopics(): Topic[] {
  return getTopics().filter((t) => t.status === "approved" && !t.scheduledDate);
}

export function saveScript(script: Script): void {
  updateActiveAccount((a) => {
    const idx = a.scripts.findIndex((s) => s.id === script.id);
    const scripts = [...a.scripts];
    if (idx >= 0) {
      scripts[idx] = script;
    } else {
      scripts.push(script);
    }
    return { ...a, scripts };
  });
}

export function getScripts(): Script[] {
  return getAccount()?.scripts ?? [];
}

export function saveReviewPersonas(data: ReviewPersonaData): void {
  updateActiveAccount((a) => ({ ...a, reviewPersonas: data }));
}

export function getReviewPersonas(): ReviewPersonaData | null {
  return getAccount()?.reviewPersonas ?? null;
}

export function saveReviewResults(results: ReviewResults): void {
  updateActiveAccount((a) => ({ ...a, reviewResults: results }));
}

export function getReviewResults(): ReviewResults | null {
  return getAccount()?.reviewResults ?? null;
}

export function saveTrends(trends: Trend[], append = false): void {
  updateActiveAccount((a) => {
    let next: Trend[];
    if (append) {
      const existingTitles = new Set(a.trends.map((t) => t.title));
      const newOnes = trends.filter((t) => !existingTitles.has(t.title));
      next = [...a.trends, ...newOnes];
    } else {
      next = trends;
    }
    return {
      ...a,
      trends: next,
      trendsDate: new Date().toISOString().split("T")[0],
    };
  });
}

export function getTrends(): { trends: Trend[]; date: string | null } {
  const a = getAccount();
  return { trends: a?.trends ?? [], date: a?.trendsDate ?? null };
}

export function isTrendsStale(): boolean {
  const { date } = getTrends();
  if (!date) return true;
  const today = new Date().toISOString().split("T")[0];
  return date !== today;
}

export function saveSelectedTrendsMeta(meta: SelectedTrendsMeta): void {
  updateActiveAccount((a) => ({ ...a, selectedTrendsMeta: meta }));
}

export function getSelectedTrendsMeta(): SelectedTrendsMeta | null {
  return getAccount()?.selectedTrendsMeta ?? null;
}
