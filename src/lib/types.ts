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

export type MaterialPurpose =
  | "brand_guide"      // 品牌手册
  | "product_info"     // 产品资料
  | "visual_standard"  // 视觉规范
  | "campaign_brief"   // 营销规划
  | "competitor"       // 竞品分析
  | "audience_research" // 受众调研
  | "other";           // 其他

export const MATERIAL_PURPOSE_LABELS: Record<MaterialPurpose, string> = {
  brand_guide: "品牌手册",
  product_info: "产品资料",
  visual_standard: "视觉规范",
  campaign_brief: "营销规划",
  competitor: "竞品分析",
  audience_research: "受众调研",
  other: "其他",
};

export interface BrandMaterial {
  id: string;
  fileName: string;
  purpose: MaterialPurpose;
  extractedText: string;
  uploadedAt: string;
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
  brandMaterials: BrandMaterial[];
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

export interface Trend {
  title: string;
  description: string;
  source?: string;
  heatScore?: number;
  relevance?: string;
}

export interface AppData {
  account: Account | null;
  topics: Topic[];
  scripts: Script[];
  trends: Trend[];
  trendsDate: string | null; // YYYY-MM-DD, tracks when trends were fetched
}
