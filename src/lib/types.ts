export type ProductDocumentFileType = "pdf" | "markdown" | "text" | "image" | "other";

export interface ProductDocumentExtracted {
  sellingPoints: string[];     // 核心卖点
  targetAudience: string;      // 受众画像
  keyFeatures: string[];       // 关键功能/规格
  positioning: string;         // 一句话定位
  scenarios: string[];         // 使用场景
  summary: string;             // 全文摘要
}

export interface ProductDocument {
  id: string;
  fileName: string;            // 原始文件名
  fileType: ProductDocumentFileType;
  fileUrl: string;             // 服务器存放路径（相对 /public 的可访问 url，如 "/uploads/product-docs/.../xx.pdf"）
  sizeBytes: number;
  extracted: ProductDocumentExtracted;
  uploadedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  sellingPoints: string[];
  imagePaths: string[];
  links: string[];
  documents?: ProductDocument[];
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
  id: string;
  name: string;
  platform: "douyin" | "tiktok" | "xiaohongshu" | "instagram" | "kuaishou" | "wechat" | "youtube" | "bilibili";
  accountUrl: string;
  brand: Brand;
  brandMaterials: BrandMaterial[];
  products: Product[];
  personas: Persona[];
  benchmarkAccounts: BenchmarkAccount[];

  topics: Topic[];
  scripts: Script[];
  trends: Trend[];
  trendsDate: string | null;
  reviewPersonas: ReviewPersonaData | null;
  reviewResults: ReviewResults | null;
  selectedTrendsMeta?: SelectedTrendsMeta | null;
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
  source: string;         // 信息来源名称
  sourceUrl?: string;     // 信息来源链接
  heatScore: number;      // 1-10
  relevance: string;      // 关联说明
  eventDate?: string;     // 预测事件日期
  warning?: string;       // 警告标签（如"竞品负面"）
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
  relatedTrendIds: string[];
  estimatedAppeal: string;
  status: TopicStatus;
  scheduledDate?: string;      // YYYY-MM-DD，排入日历的日期
  reviewScore?: number;        // Persona Review 综合评分
  productIds?: string[];       // 绑定的产品 id（空 / undefined = 通用，可多选）
  createdAt: string;
}

// ===== 脚本 =====

export type ScriptVariant =
  | "free-voiceover"
  | "free-music"
  | "creative-voiceover"
  | "creative-music";

export interface Script {
  id: string;
  topicId: string;
  productId?: string;              // 本脚本主推的产品 id
  variant?: ScriptVariant;         // 4 个变体之一
  label?: string;
  isCreative?: boolean;
  hasVo?: boolean;
  creativeMethod?: string;
  title?: string;
  hook?: string;
  creativeApproach?: string;
  musicStyle?: string;
  hashtags?: string[];
  totalDuration?: string;
  scenes: ScriptScene[];
  fullText: string;
  notes?: string;
  concept?: string;
  // 视频成片
  videoUrl?: string;               // OSS / CDN URL，永不过期
  videoTaskId?: string;            // Seedance task id，溯源用
  videoPrompt?: string;            // 生成时实际发给 Seedance 的完整 prompt（快照）
  videoReferenceImages?: string[]; // 生成时使用的参考图 URL 列表（快照）
  videoGeneratedAt?: string;       // 视频生成完成的时间戳
  createdAt: string;
}

export interface ScriptScene {
  sceneNumber: number;
  shotType?: string;
  duration: string;
  visual: string;
  audio: string;
  text: string;
  transition?: string;
}

// ===== 数据存储 =====

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ReviewPersonaData {
  personas: any[];
  reasoning: any;
  generatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReviewResults = Record<string, any>;

export interface SelectedTrendItem {
  originalIndex: number;
  title: string;
  relevanceScore: number;
  reason: string;
}

export interface SelectedTrendsMeta {
  selectedTrends: SelectedTrendItem[];
  trendsPoolSize: number;
  topicsGenerated: number;
  generatedAt: string;
}

export interface AppData {
  accounts: Account[];
  activeAccountId: string | null;
}
