import { AppData, Account, Topic, Script, Trend, ReviewPersonaData } from "./types";

const STORAGE_KEY = "alphato_data";

const defaultData: AppData = {
  account: null,
  topics: [],
  scripts: [],
  trends: [],
  trendsDate: null,
  reviewPersonas: null,
};

export function loadData(): AppData {
  if (typeof window === "undefined") return defaultData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    return JSON.parse(raw) as AppData;
  } catch {
    return defaultData;
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function saveAccount(account: Account): void {
  const data = loadData();
  data.account = account;
  saveData(data);
}

export function getAccount(): Account | null {
  return loadData().account;
}

export function saveTopics(topics: Topic[]): void {
  const data = loadData();
  data.topics = topics;
  saveData(data);
}

export function getTopics(): Topic[] {
  return loadData().topics;
}

export function updateTopic(topicId: string, updates: Partial<Topic>): void {
  const data = loadData();
  const idx = data.topics.findIndex((t) => t.id === topicId);
  if (idx >= 0) {
    data.topics[idx] = { ...data.topics[idx], ...updates };
    saveData(data);
  }
}

export function scheduleTopic(topicId: string, date: string): void {
  updateTopic(topicId, { scheduledDate: date, status: "approved" });
}

export function unscheduleTopic(topicId: string): void {
  updateTopic(topicId, { scheduledDate: undefined });
}

export function getScheduledTopics(): Topic[] {
  return loadData().topics.filter((t) => t.scheduledDate);
}

export function getUnscheduledApprovedTopics(): Topic[] {
  return loadData().topics.filter((t) => t.status === "approved" && !t.scheduledDate);
}

export function saveScript(script: Script): void {
  const data = loadData();
  const idx = data.scripts.findIndex((s) => s.id === script.id);
  if (idx >= 0) {
    data.scripts[idx] = script;
  } else {
    data.scripts.push(script);
  }
  saveData(data);
}

export function getScripts(): Script[] {
  return loadData().scripts;
}

export function saveReviewPersonas(data: ReviewPersonaData): void {
  const appData = loadData();
  appData.reviewPersonas = data;
  saveData(appData);
}

export function getReviewPersonas(): ReviewPersonaData | null {
  return loadData().reviewPersonas || null;
}

export function saveTrends(trends: Trend[], append = false): void {
  const data = loadData();
  if (append) {
    // Deduplicate by title
    const existingTitles = new Set(data.trends.map((t) => t.title));
    const newTrends = trends.filter((t) => !existingTitles.has(t.title));
    data.trends = [...data.trends, ...newTrends];
  } else {
    data.trends = trends;
  }
  data.trendsDate = new Date().toISOString().split("T")[0];
  saveData(data);
}

export function getTrends(): { trends: Trend[]; date: string | null } {
  const data = loadData();
  return { trends: data.trends || [], date: data.trendsDate || null };
}

export function isTrendsStale(): boolean {
  const { date } = getTrends();
  if (!date) return true;
  const today = new Date().toISOString().split("T")[0];
  return date !== today;
}
