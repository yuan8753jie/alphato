export interface Product {
  name: string;
  description: string;
  sellingPoints: string[];
  imagePaths: string[];
  links: string[];
}

export interface Persona {
  name: string;
  description: string;
}

export interface BenchmarkAccount {
  url: string;
  notes: string;
}

export interface Brand {
  name: string;
  tone: string;
  rules: string[];
  industry: string;
}

export interface Account {
  name: string;
  platform: "douyin" | "tiktok" | "xiaohongshu" | "instagram" | "kuaishou" | "wechat" | "youtube" | "bilibili";
  accountUrl: string;
  brand: Brand;
  products: Product[];
  personas: Persona[];
  benchmarkAccounts: BenchmarkAccount[];
}

export type TopicStatus = "pending" | "approved" | "rejected" | "hold";

export interface Topic {
  id: string;
  title: string;
  angle: string;
  description: string;
  relatedTrend: string;
  status: TopicStatus;
  createdAt: string;
}

export interface Script {
  id: string;
  topicId: string;
  scenes: ScriptScene[];
  fullText: string;
  createdAt: string;
}

export interface ScriptScene {
  sceneNumber: number;
  duration: string;
  visual: string;
  audio: string;
  text: string;
}

export interface AppData {
  account: Account | null;
  topics: Topic[];
  scripts: Script[];
}
