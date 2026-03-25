import { AppData, Account, Topic, Script, Trend } from "./types";

const STORAGE_KEY = "alphato_data";

const defaultData: AppData = {
  account: null,
  topics: [],
  scripts: [],
  trends: [],
  trendsDate: null,
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

export function saveTrends(trends: Trend[]): void {
  const data = loadData();
  data.trends = trends;
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
