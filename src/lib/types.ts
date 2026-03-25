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

// ===== 热点池 =====

export type TrendCategory =
  | "platform_hot"     // 平台热搜
  | "industry_news"    // 行业动态
  | "social_meme"      // 社交热梗
  | "sports_event"     // 体育赛事
  | "entertainment"    // 综艺/影视
  | "holiday_calendar" // 节日/节气/纪念日
  | "brand_related"    // 品牌相关（代言人、活动）
  | "trivia"           // 品类冷知识
  | "history_today";   // 历史上的今天

export const TREND_CATEGORY_LABELS: Record<TrendCategory, string> = {
  platform_hot: "平台热搜",
  industry_news: "行业动态",
  social_meme: "社交热梗",
  sports_event: "体育赛事",
  entertainment: "综艺/影视",
  holiday_calendar: "节日/节气",
  brand_related: "品牌相关",
  trivia: "冷知识",
  history_today: "历史今天",
};

export type TrendSection = "global" | "industry" | "brand";

export const TREND_SECTION_LABELS: Record<TrendSection, string> = {
  global: "全局热点",
  industry: "行业洞察",
  brand: "品牌信号",
};

export interface Trend {
  id: string;
  title: string;
  description: string;
  category: TrendCategory;
  section: TrendSection;  // 所属板块
  source: string;         // 信息来源
  heatScore: number;      // 1-10
  relevance: string;      // 关联说明
  eventDate?: string;     // 预测事件日期
  fetchedAt: string;      // 抓取时间
}

// ===== 选题池 =====

export type TopicType =
  | "traffic"     // 流量型（蹭热点拉曝光）
  | "trust"       // 信任型（干货建立专业感）
  | "conversion"  // 转化型（种草带货）
  | "persona";    // 人设型（拉近距离）

export const TOPIC_TYPE_LABELS: Record<TopicType, string> = {
  traffic: "流量型",
  trust: "信任型",
  conversion: "转化型",
  persona: "人设型",
};

export type TopicStatus = "pending" | "approved" | "rejected" | "hold";

export interface Topic {
  id: string;
  title: string;
  angle: string;
  description: string;
  type: TopicType;
  relatedTrendIds: string[];   // 关联的热点ID（可多个）
  estimatedAppeal: string;
  status: TopicStatus;
  createdAt: string;
}

// ===== 脚本 =====

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

// ===== 数据存储 =====

export interface AppData {
  account: Account | null;
  topics: Topic[];
  scripts: Script[];
  trends: Trend[];
  trendsDate: string | null;
}
