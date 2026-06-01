"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Image, Compass, Users, MessageSquare, ClipboardCheck, Clapperboard,
  FileText, Search, Sparkles, Video,
  Flame, Smile, Trophy, Film, PartyPopper, Newspaper, Brain, ScrollText, Building2,
} from "lucide-react";

// Shared footers appended to every fetch-trends Agent prompt
const SAFETY_FILTER_BLOCK = `\n品牌安全过滤（必须严格执行）：\n直接剔除：政治敏感、负面社会新闻、明星塌房、自然灾害、宗教民族争议、公共卫生恐慌、未经证实的谣言、涉及未成年人的负面新闻。\n例外：竞品负面新闻保留，但加上 "warning": "竞品负面"。`;
const JSON_FORMAT_BLOCK = `返回 JSON 数组（只返回 JSON，不要其他文字），每条包含：\n{"title":"标题","description":"2-3句描述","source":"来源网站域名如 people.com.cn","heatScore":1到10,"relevance":"内容创作关联说明"}\n如有预计日期加 "eventDate":"YYYY-MM-DD"，如有竞品负面加 "warning":"竞品负面"。`;
const SHARED_FOOTERS = `\n\n━━ 共用 footer · 品牌安全过滤 ━━${SAFETY_FILTER_BLOCK}\n\n━━ 共用 footer · JSON 输出格式 ━━\n${JSON_FORMAT_BLOCK}`;

const FETCH_TRENDS_META = {
  endpoint: "/api/fetch-trends",
  source: "src/app/api/fetch-trends/route.ts",
  stage: "发现",
  stageColor: "bg-blue-100 text-blue-700",
  model: "gemini-2.5-flash + Google Search",
  googleSearch: true,
  timeout: "90s / agent",
};
import { useLang } from "@/lib/i18n";

interface PromptEntry {
  id: string;
  name: string;
  nameEn: string;
  endpoint: string;
  source: string;
  stage: string;
  stageColor: string;
  icon: React.ElementType;
  purpose: string;
  purposeEn: string;
  model: string;
  googleSearch: boolean;
  timeout: string;
  inputs: { name: string; desc: string; descEn: string }[];
  prompt: string;
  outputFormat: string;
}

const STAGES = ["账号设置", "发现", "选题", "评审", "创作"];
const STAGES_EN: Record<string, string> = {
  "账号设置": "Account Setup",
  "发现": "Discover",
  "选题": "Topics",
  "评审": "Review",
  "创作": "Creation",
};

const PROMPTS: PromptEntry[] = [
  // ============================================================
  // 账号设置 / Account Setup
  // ============================================================
  {
    id: "extract-brand",
    name: "品牌资料提取",
    nameEn: "Brand Asset Extraction",
    endpoint: "/api/extract-brand",
    source: "src/app/api/extract-brand/route.ts",
    stage: "账号设置",
    stageColor: "bg-gray-100 text-gray-700",
    icon: Image,
    purpose: "从上传的品牌手册/规范图片中，用 Gemini Vision 提取品牌名称、行业、调性、规则等信息",
    purposeEn: "Uses Gemini Vision to extract brand name, industry, tone, rules, etc. from uploaded brand book / guideline images",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "60s",
    inputs: [
      { name: "file", desc: "用户上传的品牌图片（multipart/form-data）", descEn: "Uploaded brand image (multipart/form-data)" },
    ],
    prompt: `你是一个品牌分析专家。请仔细查看这张图片，提取其中与品牌运营相关的所有信息。

请按以下 JSON 格式返回（只返回 JSON，不要其他文字）：

{
  "brandName": "品牌名称（如果图中能识别出来）",
  "industry": "所属行业",
  "tone": "品牌调性/风格描述",
  "rules": ["规则1", "规则2"],
  "summary": "图片中所有文字内容的完整摘要，保留关键细节"
}

如果某个字段无法从图片中提取，设为空字符串或空数组。summary 字段务必尽可能完整地提取图片中的文字内容。`,
    outputFormat: '{ brandName, industry, tone, rules[], summary }',
  },
  {
    id: "extract-product-doc",
    name: "产品文档提取",
    nameEn: "Product Document Extraction",
    endpoint: "/api/extract-product-doc",
    source: "src/app/api/extract-product-doc/route.ts",
    stage: "账号设置",
    stageColor: "bg-gray-100 text-gray-700",
    icon: FileText,
    purpose: "上传 PDF / Markdown / TXT / 图片产品文档，Gemini 提取卖点、目标受众、关键功能、定位、使用场景和摘要",
    purposeEn: "Upload PDF / Markdown / TXT / image product docs; Gemini extracts selling points, audience, key features, positioning, scenarios, and a summary",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "60~90s",
    inputs: [
      { name: "file", desc: "产品文档（PDF/MD/TXT/图片，≤ 20MB）", descEn: "Product doc (PDF/MD/TXT/image, ≤ 20MB)" },
      { name: "accountId", desc: "品牌账号 ID", descEn: "Brand account ID" },
      { name: "productId", desc: "产品 ID", descEn: "Product ID" },
    ],
    prompt: `你是一个产品分析专家，请仔细阅读以下产品文档，提取对内容营销有价值的信息。

请严格按如下 JSON 格式返回（只返回 JSON，不要其他文字）：

{
  "sellingPoints": ["卖点1", "卖点2", ...],
  "targetAudience": "对目标受众的画像描述（年龄段、生活方式、痛点、决策因子等）",
  "keyFeatures": ["关键功能/规格1", "关键功能/规格2", ...],
  "positioning": "一句话总结这款产品的定位（在品类中差异化于哪里）",
  "scenarios": ["典型使用场景1", "典型使用场景2", ...],
  "summary": "300-500 字的完整摘要，保留具体参数、价格、容量等数字"
}

要求：
- 卖点、功能、场景列表至少 3 条，越具体越好（避免"性价比高""体验好"这种空话）
- 受众画像要具体到能让人脑补出一个真人，不要罗列年龄段
- summary 务必保留产品文档里的数字与硬指标（如续航、容量、价格、尺寸），不要省略`,
    outputFormat: '{ sellingPoints[], targetAudience, keyFeatures[], positioning, scenarios[], summary }',
  },
  {
    id: "search-product-images",
    name: "产品图搜索",
    nameEn: "Product Image Search",
    endpoint: "/api/search-product-images",
    source: "src/app/api/search-product-images/route.ts",
    stage: "账号设置",
    stageColor: "bg-gray-100 text-gray-700",
    icon: Search,
    purpose: "用 Gemini + Google Search 给产品名搜白底图/官方图，至少 10 张候选，结合 grounding 元数据校验真实可访问",
    purposeEn: "Use Gemini + Google Search to find white-background / official product images (≥10 candidates), cross-checked against grounding metadata",
    model: "gemini-2.5-flash + Google Search",
    googleSearch: true,
    timeout: "20s",
    inputs: [
      { name: "productName", desc: "产品名称", descEn: "Product name" },
      { name: "brandName", desc: "品牌名（可选，用于缩小搜索范围）", descEn: "Brand name (optional, narrows search)" },
    ],
    prompt: `搜索"\${query}"的产品白底图/官方产品图片。

请搜索并返回该产品的真实图片URL链接，尽可能多找，至少找 10 张。优先找：
1. 品牌官网的产品图
2. 电商平台（天猫、京东、拼多多）的产品主图
3. 白底产品图、产品三视图
4. 产品包装图、产品实拍图

返回 JSON（只返回 JSON）：
{
  "images": [
    {
      "url": "图片的直接URL链接（必须是 .jpg/.png/.webp 结尾的图片地址）",
      "source": "图片来源网站"
    }
  ]
}

返回 10 张以上。只返回真实可访问的图片URL，不要编造。`,
    outputFormat: '{ images: [{ url, source }], groundingUrls: [{ url, source }] }',
  },

  // ============================================================
  // 发现 / Discover · 9 Agents (parallel Google-search)
  // 每个 Agent 末尾自动追加 SAFETY_FILTER + JSON_FORMAT footer
  // ============================================================
  {
    id: "fetch-trends-platform-hot",
    name: "Agent 1 · 平台热搜分析师",
    nameEn: "Agent 1 · Platform Trending Analyst",
    ...FETCH_TRENDS_META,
    icon: Flame,
    purpose: "搜索目标平台（抖音/小红书/TikTok 等）今天的热搜榜和热门话题，section=global",
    purposeEn: "Search today's trending/hot topics on the target platform (Douyin / Xiaohongshu / TikTok / ...), section=global",
    inputs: [
      { name: "pName", desc: "平台中文名（由 platform 派生）", descEn: "Platform display name (derived from platform)" },
      { name: "today", desc: "当前日期（zh-CN long format）", descEn: "Current date (zh-CN long format)" },
    ],
    prompt: `你是\${pName}平台热搜分析师。搜索\${today}\${pName}平台的热搜榜和热门话题。
搜索建议："\${pName}热搜榜"、"\${pName}今日热门"
请返回 10~15 条当前最热门的话题。每条必须来自搜索结果，标注来源。${SHARED_FOOTERS}`,
    outputFormat: '[{ title, description, source(域名), sourceUrl(grounding 匹配), heatScore, relevance, category="platform_hot", section="global", eventDate?, warning? }]',
  },
  {
    id: "fetch-trends-social-meme",
    name: "Agent 2 · 社交梗文化研究员",
    nameEn: "Agent 2 · Social Meme Researcher",
    ...FETCH_TRENDS_META,
    icon: Smile,
    purpose: "搜索社交媒体上正在流行的梗、表达方式、网络流行语，section=global",
    purposeEn: "Search currently trending memes, expressions, and internet slang on social media, section=global",
    inputs: [
      { name: "today", desc: "当前日期（用于「X前后」语境）", descEn: "Current date (anchors 'around X')" },
    ],
    prompt: `你是社交媒体梗文化研究员。搜索\${today}前后社交媒体上正在流行的梗、热门表达方式、网络流行语。
搜索建议："最近流行梗 2026"、"抖音热梗"、"网络流行语"、"社交媒体热梗"
请返回 10~15 条正在流行的梗/表达。每条必须来自搜索结果，标注来源。${SHARED_FOOTERS}`,
    outputFormat: '[{ title, description, source, sourceUrl, heatScore, relevance, category="social_meme", section="global", ... }]',
  },
  {
    id: "fetch-trends-sports-event",
    name: "Agent 3 · 体育赛事日历专家",
    nameEn: "Agent 3 · Sports Calendar Expert",
    ...FETCH_TRENDS_META,
    icon: Trophy,
    purpose: "搜索未来 3 个月内的重大体育赛事，每条带日期和来源，section=global",
    purposeEn: "Search major sports events in the next 3 months, each with date + source, section=global",
    inputs: [
      { name: "year / month", desc: "当前年份与月份（驱动时间范围）", descEn: "Current year/month (drives time window)" },
    ],
    prompt: `你是体育赛事日历专家。搜索\${year}年\${month}月至\${Math.min(month + 3, 12)}月期间的重大体育赛事。
搜索建议："\${year}年体育赛事日程"、"\${year}年\${month}月体育赛事"、"近期体育比赛"
请返回 10~15 场即将举行或正在进行的重要赛事。每条标注日期和来源。${SHARED_FOOTERS}`,
    outputFormat: '[{ title, description, source, sourceUrl, heatScore, relevance, category="sports_event", section="global", eventDate, ... }]',
  },
  {
    id: "fetch-trends-entertainment",
    name: "Agent 4 · 影视综艺情报员",
    nameEn: "Agent 4 · Entertainment Scout",
    ...FETCH_TRENDS_META,
    icon: Film,
    purpose: "搜索未来 2 个月的热门综艺、上映电影、热播电视剧，section=global",
    purposeEn: "Search trending variety shows, upcoming films, and hot dramas in the next 2 months, section=global",
    inputs: [
      { name: "year / month", desc: "当前年份与月份", descEn: "Current year/month" },
    ],
    prompt: `你是影视综艺情报员。搜索\${year}年\${month}月至\${Math.min(month + 2, 12)}月的热门综艺节目、即将上映的电影和电视剧。
搜索建议："\${year}年\${month}月上映电影"、"\${year}年热门综艺"、"最近热播电视剧"
请返回 10~15 部作品。每条标注上映/播出日期和来源。${SHARED_FOOTERS}`,
    outputFormat: '[{ title, description, source, sourceUrl, heatScore, relevance, category="entertainment", section="global", eventDate, ... }]',
  },
  {
    id: "fetch-trends-holiday-calendar",
    name: "Agent 5 · 节日节气日历专家",
    nameEn: "Agent 5 · Holiday Calendar Expert",
    ...FETCH_TRENDS_META,
    icon: PartyPopper,
    purpose: "搜索未来 3 个月的节日、节气、纪念日、国际日，section=global",
    purposeEn: "Search festivals, solar terms, commemorations, and international days in the next 3 months, section=global",
    inputs: [
      { name: "year / month", desc: "当前年份与月份", descEn: "Current year/month" },
    ],
    prompt: `你是节日节气日历专家。搜索\${year}年\${month}月至\${Math.min(month + 3, 12)}月的节日、节气、纪念日、国际日。
搜索建议："\${year}年\${month}月节日节气"、"\${year}年节假日安排"、"国际纪念日 \${month}月"
请返回 10~15 个重要日期。每条标注日期和来源。${SHARED_FOOTERS}`,
    outputFormat: '[{ title, description, source, sourceUrl, heatScore, relevance, category="holiday_calendar", section="global", eventDate, ... }]',
  },
  {
    id: "fetch-trends-industry-news",
    name: "Agent 6 · 行业分析师",
    nameEn: "Agent 6 · Industry News Analyst",
    ...FETCH_TRENDS_META,
    icon: Newspaper,
    purpose: "搜索品牌所属行业的最新新闻、市场动态、企业动向，section=industry",
    purposeEn: "Search latest news, market trends, and corporate movements in the brand's industry, section=industry",
    inputs: [
      { name: "industry", desc: "品牌行业", descEn: "Brand industry" },
      { name: "today", desc: "当前日期", descEn: "Current date" },
    ],
    prompt: `你是\${industry}行业分析师。搜索\${today}前后"\${industry}"行业的最新新闻、市场动态、企业动向。
搜索建议："\${industry}行业新闻"、"\${industry}市场动态"、"\${industry}企业最新"
请返回 10~15 条行业资讯。每条必须来自搜索结果，标注来源。${SHARED_FOOTERS}`,
    outputFormat: '[{ title, description, source, sourceUrl, heatScore, relevance, category="industry_news", section="industry", ... }]',
  },
  {
    id: "fetch-trends-trivia",
    name: "Agent 7 · 品类冷知识收集者",
    nameEn: "Agent 7 · Trivia Collector",
    ...FETCH_TRENDS_META,
    icon: Brain,
    purpose: "搜索品类相关的冷知识、反常识科普、有趣事实，section=industry",
    purposeEn: "Search trivia, counter-intuitive facts, and fun science around the category, section=industry",
    inputs: [
      { name: "industry", desc: "品类/行业", descEn: "Category / industry" },
    ],
    prompt: `你是\${industry}品类的冷知识收集者。搜索与"\${industry}"相关的冷知识、反常识内容、有趣的科普知识。
搜索建议："\${industry}冷知识"、"\${industry}你不知道的"、"\${industry}有趣事实"、"\${industry}科普"
请返回 10~15 条有趣且可验证的冷知识。每条必须来自搜索结果，标注来源。${SHARED_FOOTERS}`,
    outputFormat: '[{ title, description, source, sourceUrl, heatScore, relevance, category="trivia", section="industry", ... }]',
  },
  {
    id: "fetch-trends-history-today",
    name: "Agent 8 · 历史事件研究员",
    nameEn: "Agent 8 · Historical Events Researcher",
    ...FETCH_TRENDS_META,
    icon: ScrollText,
    purpose: "搜索历史上的今天发生过的有趣、积极、适合内容创作的事件，section=industry",
    purposeEn: 'Search interesting, positive, content-friendly events from "this day in history", section=industry',
    inputs: [
      { name: "month / day", desc: "当前月份与日期", descEn: "Current month/day" },
    ],
    prompt: `你是历史事件研究员。搜索历史上的\${month}月\${day}日发生过的有趣、积极、适合内容创作的事件。
搜索建议："历史上的今天 \${month}月\${day}日"、"\${month}月\${day}日大事记"
请返回 10~15 件历史事件。每条必须来自搜索结果，标注来源。${SHARED_FOOTERS}`,
    outputFormat: '[{ title, description, source, sourceUrl, heatScore, relevance, category="history_today", section="industry", ... }]',
  },
  {
    id: "fetch-trends-brand-related",
    name: "Agent 9 · 品牌情报分析师",
    nameEn: "Agent 9 · Brand Intelligence Analyst",
    ...FETCH_TRENDS_META,
    icon: Building2,
    purpose: "搜索品牌自身 + 对标品牌的最新动态、代言人、新品、活动，section=brand",
    purposeEn: "Search latest moves, spokespeople, new launches, and activities of the brand itself + benchmark brands, section=brand",
    inputs: [
      { name: "brandName", desc: "品牌名", descEn: "Brand name" },
      { name: "benchmarkNames", desc: '对标品牌名列表（来自 benchmarkAccounts[].notes，可为空）', descEn: "Benchmark brand names (from benchmarkAccounts[].notes, may be empty)" },
    ],
    prompt: `你是品牌情报分析师。搜索与"\${brandName}"品牌相关的最新动态：
1. 品牌新闻、活动、代言人动态（搜索"\${brandName} 最新动态"、"\${brandName} 代言人"、"\${brandName} 新品"）

// ↓ 仅当 benchmarkNames.length > 0 时，源码动态拼接下面这一行：
2. 竞品/对标品牌动态：\${benchmarkNames.map(n => \`搜索"\${n} 最新动态"\`).join("、")}

请返回 10~15 条品牌相关资讯。每条必须来自搜索结果，标注来源。${SHARED_FOOTERS}`,
    outputFormat: '[{ title, description, source, sourceUrl, heatScore, relevance, category="brand_related", section="brand", ... }]',
  },

  // ============================================================
  // 选题 / Topics
  // ============================================================
  {
    id: "generate-topics-p1",
    name: "Phase 1：热点筛选",
    nameEn: "Phase 1: Hot-Topic Filtering",
    endpoint: "/api/generate-topics (Step 1)",
    source: "src/app/api/generate-topics/route.ts",
    stage: "选题",
    stageColor: "bg-amber-100 text-amber-700",
    icon: MessageSquare,
    purpose: "从 100+ 条原始热点中，基于品牌相关度精选 15~20 条进入下一阶段",
    purposeEn: "From 100+ raw hot topics, select the 15~20 most brand-relevant ones to advance",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "120s",
    inputs: [
      { name: "account", desc: "完整账号（品牌/产品/受众/资料）", descEn: "Full account (brand / product / audience / assets)" },
      { name: "trends", desc: "热点池全部数据", descEn: "Full hot-topic pool" },
      { name: "focusProductId", desc: "可选：focus 模式锁定单一产品", descEn: "Optional: focus-mode pins a single product" },
    ],
    prompt: `你是"\${account.brand.name}"品牌的\${pName}内容总监。

## 你的品牌
\${brandContext}

## 候选热点池（共\${trends.length}条）
\${formatTrendList(trends)}

## 任务
从以上\${trends.length}条热点中，精选 15~20 条最适合"\${account.brand.name}"做\${pName}内容的热点。

选择标准：
1. 与品牌行业（\${account.brand.industry}）的关联度
2. 与目标受众兴趣/痛点的匹配度
3. 能否自然融入品牌产品
4. 热点的时效性和传播潜力
5. 是否符合品牌调性（不违反红线规则）

返回 JSON 数组（只返回 JSON，不要其他文字）：
[
  {
    "originalIndex": 原始编号（1开始）,
    "title": "热点标题",
    "relevanceScore": 1到10的品牌相关度评分,
    "reason": "一句话说明为什么选这条（跟品牌/产品/受众的具体关联）"
  }
]

按 relevanceScore 从高到低排序。`,
    outputFormat: '[{ originalIndex, title, relevanceScore(1-10), reason }]',
  },
  {
    id: "generate-topics-p2",
    name: "Phase 2：选题策划（含产品绑定）",
    nameEn: "Phase 2: Topic Planning (with Product Binding)",
    endpoint: "/api/generate-topics (Step 2)",
    source: "src/app/api/generate-topics/route.ts",
    stage: "选题",
    stageColor: "bg-amber-100 text-amber-700",
    icon: MessageSquare,
    purpose: "基于 Phase 1 精选热点，按流量/信任/转化/人设 = 3/2/2/1 配比生成 8 条选题，并把每条绑定到合适的产品",
    purposeEn: "From Phase 1 picks, generate 8 topics by traffic / trust / conversion / persona ratio of 3/2/2/1, and bind each to the matching product(s)",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "120s",
    inputs: [
      { name: "brandContext", desc: "品牌完整上下文（focus 模式下含产品）", descEn: "Full brand context (focused product if in focus mode)" },
      { name: "selectedTrends", desc: "Phase 1 输出的精选热点", descEn: "Curated trends from Phase 1" },
      { name: "focusProduct", desc: "可选：锁定的单一产品", descEn: "Optional: pinned single product" },
    ],
    prompt: `你是一个顶级的\${pName}内容策划专家。

## 品牌上下文
\${brandContext}

## 精选热点（已按品牌相关度筛选）
\${selectedTrendsText}

\${productBindingInstruction}
  // ↳ focus 模式 → 锁定单产品："本批选题全部围绕 X，productNames 必须是 [X]"
  // ↳ 多产品模式 → 让 LLM 自己挑："对每个选题判断它最适合主推哪几款产品"
  // ↳ 无产品 → 不附加约束

## 任务
基于以上精选热点，为"\${account.brand.name}"的\${pName}账号策划 **8 个内容选题**，严格按以下配比：

- **流量型（traffic）3 个**：蹭热点拉曝光，追求播放量和互动，要有话题性和传播力
- **信任型（trust）2 个**：输出专业干货，建立品牌可信度，如品类知识、科普、洞察
- **转化型（conversion）2 个**：自然种草，突出产品卖点和使用场景，让观众想买
- **人设型（persona）1 个**：展示品牌真实面，拉近距离，如幕后、日常、互动

要求：
1. 每个选题要有独特创意角度，不是热点的简单复述
2. 必须遵守品牌调性和红线规则
3. 标题要像真实的\${pName}爆款 —— 短、有力、有悬念或共鸣
4. 产品融入要自然，不能硬广
5. 明确标注基于哪条精选热点

返回 JSON 数组（只返回 JSON，不要其他文字）：
[
  {
    "title": "选题标题",
    "type": "traffic / trust / conversion / persona",
    "angle": "切入角度说明",
    "description": "3-5句内容概要，描述这条视频具体怎么做",
    "basedOnTrends": ["基于的精选热点标题1", "精选热点标题2"],
    "productNames": ["最相关的产品名"],
    "estimatedAppeal": "目标受众为什么会想看"
  }
]`,
    outputFormat: '[{ title, type, angle, description, basedOnTrends[], productNames[], estimatedAppeal }]',
  },

  // ============================================================
  // 评审 / Review
  // ============================================================
  {
    id: "generate-personas",
    name: "Persona 审稿团生成",
    nameEn: "Persona Review Panel Generation",
    endpoint: "/api/generate-personas",
    source: "src/app/api/generate-personas/route.ts",
    stage: "评审",
    stageColor: "bg-violet-100 text-violet-700",
    icon: Users,
    purpose: "基于品牌/行业/平台知识，构建 5~7 个差异化的虚拟目标受众，配套分析思路",
    purposeEn: "Build 5~7 differentiated virtual target audiences with reasoning, based on brand / industry / platform knowledge",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "60s",
    inputs: [
      { name: "account", desc: "完整账号信息", descEn: "Full account info" },
    ],
    prompt: `你是一个资深的用户研究专家，对消费品市场和社交媒体用户行为有深刻理解。

请为"\${account.brand.name}"（\${account.brand.industry}行业）在\${pName}平台上的内容，构建一套目标受众画像。

## 品牌信息
\${brandContext}

## 任务
请基于你对以下方面的专业知识，构建 5~7 个有代表性的 Persona：
- \${account.brand.industry}行业的消费者结构和行为特征
- \${account.brand.name}品牌的市场定位和目标人群
- \${pName}平台的用户群体特征和内容消费习惯
- 不同年龄段、性别、生活阶段的消费差异

## 要求
- 先写出你的分析思路（你考虑了哪些维度、为什么选择这些群体）
- 每个 Persona 之间要有明显差异
- 既包含核心用户，也包含有增长潜力的边缘用户
- 品牌方可能提供了参考 Persona，你可以参考但不必照搬

## 返回格式
返回 JSON（只返回 JSON）：
{
  "reasoning": {
    "dimensions": ["构建 Persona 时考虑的维度1", "维度2", "维度3"],
    "logic": "2-3句话说明你的整体思路：为什么选择这些群体，它们如何覆盖品牌在\${pName}上的核心受众和潜在受众",
    "coverage": "一句话说明这组 Persona 覆盖了哪些关键人群，遗漏了哪些（如有）"
  },
  "personas": [
    {
      "id": "persona_1",
      "name": "昵称",
      "age": "年龄或年龄段",
      "gender": "男/女/不限",
      "occupation": "职业",
      "profile": "50字人物简介（像真人，不像标签）",
      "contentPreference": "在\${pName}上喜欢看什么内容",
      "brandAwareness": "对\${account.brand.name}品牌的认知和态度",
      "whyIncluded": "为什么纳入审稿团（这个人代表了什么样的用户群体）"
    }
  ]
}`,
    outputFormat: '{ reasoning: { dimensions[], logic, coverage }, personas[]: { id, name, age, gender, occupation, profile, contentPreference, brandAwareness, whyIncluded } }',
  },
  {
    id: "review-single",
    name: "单条选题独立评审",
    nameEn: "Per-Topic Independent Review",
    endpoint: "/api/review-single",
    source: "src/app/api/review-single/route.ts",
    stage: "评审",
    stageColor: "bg-violet-100 text-violet-700",
    icon: ClipboardCheck,
    purpose: "一个 Persona 独立评审一条选题（前端并发 N×M 次调用），4 维度打分 + 推理依据 + 口语化评语",
    purposeEn: "One persona reviews one topic in isolation (frontend fans out N×M calls), with 4-dimension scoring + reasoning + colloquial comment",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "60s",
    inputs: [
      { name: "persona", desc: "单个 Persona 画像", descEn: "Single persona profile" },
      { name: "topic", desc: "单条选题", descEn: "Single topic" },
      { name: "brandName", desc: "品牌名", descEn: "Brand name" },
      { name: "platform", desc: "平台 ID", descEn: "Platform ID" },
    ],
    prompt: `你现在是"\${persona.name}"，\${persona.age}岁\${persona.gender}，\${persona.occupation}。

你的特征：\${persona.profile}
你的内容偏好：\${persona.contentPreference}
你对\${brandName}的认知：\${persona.brandAwareness}

你在刷\${pName}的时候看到了下面这条内容：

标题：\${topic.title}
类型：\${topic.type}
角度：\${topic.angle}
内容概要：\${topic.description}

请以"\${persona.name}"的身份，真实地评价这条内容。先思考，再打分。打分要诚实，不好就给低分。

返回 JSON（只返回 JSON）：
{
  "stop": {
    "score": 1到10,
    "reason": "一句话说明为什么给这个分（如：'标题里有XX让我很好奇' 或 '跟我没关系，会直接划走'）"
  },
  "watch": {
    "score": 1到10,
    "reason": "一句话说明（如：'内容和我的生活相关，会看完' 或 '中间太像广告了，可能中途退出'）"
  },
  "engage": {
    "score": 1到10,
    "reason": "一句话说明（如：'会收藏这个教程' 或 '没什么想评论的'）"
  },
  "convert": {
    "score": 1到10,
    "reason": "一句话说明（如：'看完想试试这个产品' 或 '对我没有购买吸引力'）"
  },
  "comment": "用你自己的口吻说一句整体感受（口语化，像发朋友圈或弹幕）"
}`,
    outputFormat: '{ personaName, stop: {score, reason}, watch: {score, reason}, engage: {score, reason}, convert: {score, reason}, comment }',
  },
  {
    id: "review-topics",
    name: "批量选题评审（legacy 单调用）",
    nameEn: "Batch Topic Review (legacy single-call)",
    endpoint: "/api/review-topics",
    source: "src/app/api/review-topics/route.ts",
    stage: "评审",
    stageColor: "bg-violet-100 text-violet-700",
    icon: ClipboardCheck,
    purpose: "在一次 LLM 调用里让所有 Persona 评审所有选题。已被 review-single 并行调用方案替代，但接口保留兼容",
    purposeEn: "Have all personas review all topics in one LLM call. Superseded by parallel review-single, but kept for back-compat",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "180s",
    inputs: [
      { name: "account", desc: "完整账号", descEn: "Full account" },
      { name: "topics", desc: "选题列表", descEn: "Topic list" },
      { name: "personas", desc: "Persona 列表", descEn: "Persona list" },
    ],
    prompt: `你现在要扮演以下 \${personas.length} 个真实用户，逐一对 \${topics.length} 条\${pName}短视频选题进行评审。

## 审稿人
\${personasSummary}

## 待审选题
\${topicsList}

## 评审维度（每项1~10分）
- **停留** (stop)：刷到这个标题/封面，你会不会停下来看？
- **完播** (watch)：你会看完整条视频吗？
- **互动** (engage)：你会点赞/评论/收藏/转发吗？
- **转化** (convert)：看完后你会想了解/购买这个产品吗？

## 要求
- 每个审稿人必须从自己的真实视角出发，不同人的评分应该有明显差异
- 每条选题每个审稿人给一句"心里话"（用口语，像真人在说话）
- 打分要诚实，不好的就给低分

返回 JSON（只返回 JSON）：
{
  "reviews": [
    {
      "topicIndex": 1,
      "topicTitle": "选题标题",
      "personaReviews": [
        {
          "personaName": "审稿人名字",
          "stop": 分数,
          "watch": 分数,
          "engage": 分数,
          "convert": 分数,
          "comment": "一句心里话"
        }
      ],
      "averageScore": 所有审稿人所有维度的平均分（保留1位小数）
    }
  ]
}`,
    outputFormat: '{ reviews: [{ topicIndex, topicTitle, personaReviews[]: {personaName, stop, watch, engage, convert, comment}, averageScore }] }',
  },

  // ============================================================
  // 创作 / Creation
  // ============================================================
  {
    id: "script-ideation",
    name: "脚本创意构思（Step 1）",
    nameEn: "Script Creative Ideation (Step 1)",
    endpoint: "/api/generate-script (Step 1)",
    source: "src/app/api/generate-script/route.ts",
    stage: "创作",
    stageColor: "bg-green-100 text-green-700",
    icon: Sparkles,
    purpose: '为单条选题自由构思 4 个 12 秒视频创意（"稳健常规版" × 2、"极致创意版" × 2，分别含口播版和纯音乐版），不要 JSON、像跟同事 pitch',
    purposeEn: 'Freely brainstorm 4 12-second video concepts per topic ("stable / wild" × "voiceover / music"). Plain text, pitch-style — no JSON',
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "60s",
    inputs: [
      { name: "platformName", desc: "平台中文名（抖音/小红书...）", descEn: "Platform display name (e.g. TikTok)" },
      { name: "brandContext", desc: "品牌 + focus 产品上下文", descEn: "Brand + focus-product context" },
      { name: "topic", desc: "选题（title / angle / description）", descEn: "Topic (title / angle / description)" },
    ],
    prompt: `忘掉一切格式限制。你现在只需要做一件事：

想出 4 个让人在\${platformName}上**划不走**的 12 秒视频创意。

品牌：\${brandContext}

选题：\${topic.title}
角度：\${topic.angle}
概要：\${topic.description}

目标视频模型：Seedance 2.0（5~8 分镜 / 总 10~12 秒）

4 个创意分别是：
1. **稳健常规版（带口播）**：符合直觉逻辑，有中文旁白/口播，追求"情理之中，意料之外"
2. **稳健常规版（纯音乐）**：符合直觉逻辑，无口播，全靠画面+音乐+音效讲故事
3. **极致创意版（带口播）**：运用创造性思维方法论，有中文旁白，出其不意
4. **极致创意版（纯音乐）**：运用创造性思维方法论，无口播，纯视觉和音效震撼

可用的创造性思维方法论：
- 强制关联法：把产品和完全不相关的事物强行建立联系
- 逆向思维法：从结果倒推、或反着来讲故事
- 降维打击法：用高维度的视角看低维度的事情
- 跨界平移法：把其他领域的爆款套路搬过来
- SCAMPER（替换/组合/夸张/反转）
- POV 转换（从产品/气泡/冰块的视角）
- 认知失调（第一帧"不对劲"的画面）
- Rule of Three（前两个建预期，第三个打破）

核心准则：极强的"网感"，追求"情理之中，意料之外"。

对每个创意，用 50~100 字描述：
- 这 12 秒讲了什么故事？有什么反转/惊喜？
- 开头第一秒观众看到什么？为什么停下来？
- 情绪爆发点在哪里？
- 如果是创意版，用了什么思维方法论？

自由地说，不要 JSON，像跟同事 pitch 创意一样。`,
    outputFormat: '自由文本：4 段创意 pitch（非 JSON）',
  },
  {
    id: "script-structure",
    name: "脚本结构化（Step 2，单调用产出 4 变体）",
    nameEn: "Script Structuring (Step 2, 4 variants in one call)",
    endpoint: "/api/generate-script (Step 2)",
    source: "src/app/api/generate-script/route.ts",
    stage: "创作",
    stageColor: "bg-green-100 text-green-700",
    icon: Clapperboard,
    purpose: "把 Step 1 的 4 段自由创意，一次调用拆成 4 个 Seedance 2.0 可执行的分镜脚本（含口播、音效、时长、镜头类型）",
    purposeEn: "Single LLM call that breaks Step-1 pitches into 4 Seedance-2.0-ready shot scripts (voiceover, SFX, duration, shot type)",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "120s",
    inputs: [
      { name: "platformName", desc: "平台中文名", descEn: "Platform display name" },
      { name: "concepts", desc: "Step 1 输出的 4 段创意 pitch 原文", descEn: "Raw 4-pitch text from Step 1" },
    ],
    prompt: `你是一个视频制作人。下面是创意总监给你的 4 个创意概念，请把它们精确地拆成 4 个可执行的分镜脚本。

目标视频模型：**Seedance 2.0（豆包）**

## 创意概念
\${concepts}

## 技术说明（Seedance 2.0）
- 总时长：Seedance 2.0 支持 4~15 秒，按叙事节奏自己定（推荐 10~12 秒）
- 分镜数：Seedance 2.0 单 prompt 可以串联多分镜，按内容需要自由决定（一般 5~8 个，叙事丰富时更多也可以）
- 每分镜 duration 自己分配，总和在 4~15 之间即可
- 人物是典型中国年轻人（Chinese young person）
- Seedance 2.0 原生支持 lip-sync 和音频合成，voice_over 和 sfx 会被自动发声

## 分镜写法
每个 shot 需要：
- shot_type: 镜头类型（如：极致特写、全景、低角度、跟拍、POV主观镜头 等）
- visual：中文画面描述，按"主体 + 动作 + 场景 + 光影 + 氛围"自由组织，写出电影感细节。
  所有分镜会串成一个大 prompt 交给 Seedance，**让画面细节饱满而不啰嗦**即可。
  - 禁止否定词（不要 / 避免 / 没有）：Seedance 不支持 negative prompt，改用正面描述（如"保持画面稳定"）
- voice_over: 中文口播内容（无口播版留空字符串）
- sfx: 中文音效/音乐描述
- duration: 秒数（纯数字）

## 4 个变体的分类
1. variation_id=1, label="稳健常规版（口播）", has_vo=true, is_creative=false
2. variation_id=2, label="稳健常规版（音乐）", has_vo=false, is_creative=false
3. variation_id=3, label="极致创意版（口播）", has_vo=true, is_creative=true
4. variation_id=4, label="极致创意版（音乐）", has_vo=false, is_creative=true

输出严格的 JSON 数组，包含 4 个变体对象。每个对象结构：
{
  "variation_id": 1,
  "label": "稳健常规版（口播）",
  "is_creative": false,
  "has_vo": true,
  "creative_method": "如果是创意版，写用了什么方法论",
  "title": "视频标题（像\${platformName}爆款标题）",
  "hook": "开头 hook",
  "creative_approach": "创意核心（一句话）",
  "music_style": "音乐描述",
  "hashtags": ["标签1", "标签2"],
  "shots": [
    {
      "shot_id": 1,
      "shot_type": "极致特写",
      "visual": "按上述规则写的画面描述",
      "voice_over": "中文口播（无口播留空字符串）",
      "sfx": "中文音效/音乐描述",
      "duration": "3"
    }
  ],
  "full_text": "完整口播稿（无口播版写'纯音乐卡点版'）",
  "notes": "导演备注"
}

所有 duration 之和在 4~15 秒之间（推荐 10~12 秒），按叙事节奏自由分配。分镜数按内容需要自由决定，一般 5~8 个为佳，叙事丰富时更多也可以。只返回 JSON 数组。`,
    outputFormat: '[{ variation_id, label, is_creative, has_vo, creative_method, title, hook, creative_approach, music_style, hashtags[], shots[]: {shot_id, shot_type, visual, voice_over, sfx, duration}, full_text, notes }] × 4',
  },
  {
    id: "generate-storyboard-image",
    name: "分镜静帧生成",
    nameEn: "Storyboard Frame Generation",
    endpoint: "/api/generate-storyboard-image",
    source: "src/app/api/generate-storyboard-image/route.ts",
    stage: "创作",
    stageColor: "bg-green-100 text-green-700",
    icon: Image,
    purpose: "用 Gemini 3.1 Flash Image 为单个分镜的 visual 描述渲染高质量电影感静帧（用于预览/演示，不进入 Seedance）",
    purposeEn: "Render a high-quality cinematic storyboard frame for a single shot's visual description using Gemini 3.1 Flash Image (for preview, not piped into Seedance)",
    model: "gemini-3.1-flash-image-preview",
    googleSearch: false,
    timeout: "45s",
    inputs: [
      { name: "visual", desc: "分镜画面文本描述", descEn: "Shot visual description" },
      { name: "sceneNumber", desc: "分镜编号（用于标记）", descEn: "Scene number (for labelling)" },
      { name: "aspectRatio", desc: '画幅比例（默认 "9:16"）', descEn: 'Aspect ratio (default "9:16")' },
    ],
    prompt: `Generate a high-quality storyboard frame for a short video.

Scene \${sceneNumber}:
\${visual}

Style: cinematic storyboard frame, vibrant colors, professional quality,
suitable for a social media short video advertisement.
Do NOT include any text or watermarks in the image.`,
    outputFormat: '{ image: { mimeType, data(base64), dataUrl } }',
  },
  {
    id: "seedance-prompt-builder",
    name: "Seedance 视频提示词组装",
    nameEn: "Seedance Video Prompt Builder",
    endpoint: "/api/generate-video → buildSeedancePrompt()",
    source: "src/lib/seedance.ts",
    stage: "创作",
    stageColor: "bg-green-100 text-green-700",
    icon: Video,
    purpose: '把分镜列表 + 参考图 + 产品名拼成 Seedance 2.0 的单 prompt：连接词 + 镜头 + 视觉 + 口播 + "@图片N" 参考引用 + 时长/分辨率参数',
    purposeEn: 'Concatenates shots + reference images + product name into a single Seedance 2.0 prompt: connectors + shot type + visual + voiceover + "@图片N" reference tokens + duration/resolution params',
    model: "doubao-seedance-2-0-260128 / doubao-seedance-2-0-fast-260128",
    googleSearch: false,
    timeout: "—（本地模板拼接，不走 LLM）",
    inputs: [
      { name: "scenes", desc: "分镜数组（visual / text / shotType / duration）", descEn: "Shot array (visual / text / shotType / duration)" },
      { name: "isVoiceover", desc: "是否带口播（决定是否注入对镜头说...）", descEn: "Whether this variant has voiceover" },
      { name: "productName", desc: "主体产品名（注入参考图绑定语）", descEn: "Subject product name (injected with reference binding)" },
      { name: "referenceImageCount", desc: "参考图张数（决定 @图片N 数量）", descEn: "Reference image count (drives @图片N token count)" },
      { name: "ratio / resolution", desc: '画幅与分辨率（默认 "9:16" / "720p"）', descEn: 'Aspect / resolution (default "9:16" / "720p")' },
    ],
    prompt: `// === 模板拼接逻辑（伪代码，见 src/lib/seedance.ts:buildSeedancePrompt）===

// 1. 每个分镜按顺序拼一个"连接词 + 镜头 + 画面 + 口播"段落：
//    首先，\${shotType}：\${visual} 人物对镜头说："\${voiceover}"
//    接着，... 随后，... 然后，... 最后，...

const segments = scenes.map((scene, i) => {
  const connector = i === 0 ? "首先" : i === total - 1 ? "最后" : ORDINAL[i];
  const segment = \`\${connector}，\${shotType}：\${visual}\`;
  if (isVoiceover && voiceover) {
    segment += \` 人物对镜头说："\${voiceover}"\`;
  }
  return segment;
});

let body = segments.join("。");

// 2. 如果有参考图：在最前面注入"@图片1 @图片2 ... 均为本视频主体「{产品}」的真实多角度参考图..."
//    （Seedance 官方推荐：仅塞图不够，必须 @图片N 显式引用，否则参考图退化为弱参考，
//     产物颜色/外观会偏离，金机身会被渲染成蓝/黑。）

if (productName) {
  if (refCount > 0) {
    const refTags = "@图片1 @图片2 ... @图片N";
    body = \`\${refTags} 均为本视频主体「\${productName}」的真实多角度参考图。\` +
           \`请严格按照这些参考图呈现产品的机身颜色、相机模组、品牌 Logo 位置和外观细节，\` +
           \`视频全程产品外观与配色不可改变（即使场景光影变化也要保持产品本色）。\${body}\`;
  } else {
    body = \`主体\${productName}，全程保持外观与配色一致。\${body}\`;
  }
}

// 3. 收尾电影感 + 拼接参数（resolution / duration / ratio）
body += "。整体电影感、柔光自然、镜头平稳、画面稳定。";
const prompt = \`\${body} --resolution \${resolution} --duration \${totalDur} --ratio \${ratio}\`;

// 4. 总时长强制 4~15s；prompt 超 2000 字自动截断。`,
    outputFormat: '{ prompt: string (≤ 2000 chars), totalDuration: number (4~15s) }',
  },
];

export default function PromptsPage() {
  const { t, lang } = useLang();
  const [activeId, setActiveId] = useState<string>(PROMPTS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    PROMPTS.forEach((p) => {
      const el = document.getElementById(p.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex gap-8">
      {/* ===== Left: sticky nav ===== */}
      <nav className="w-48 shrink-0 sticky top-6 self-start space-y-4 max-h-[calc(100vh-48px)] overflow-y-auto">
        <h2 className="text-sm font-bold mb-3">{t("提示词目录", "Prompt Library")}</h2>
        {STAGES.map((stage) => {
          const items = PROMPTS.filter((p) => p.stage === stage);
          if (items.length === 0) return null;
          return (
            <div key={stage}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{lang === "en" ? STAGES_EN[stage] : stage}</p>
              <div className="space-y-0.5">
                {items.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => scrollTo(p.id)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors truncate ${
                      activeId === p.id
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {lang === "en" ? p.nameEn : p.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ===== Right: content ===== */}
      <div className="flex-1 min-w-0 space-y-12 pb-40">
        <div>
          <h1 className="text-xl font-bold">{t("提示词目录", "Prompt Library")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t(`AlphaTo 全部 AI 节点的系统提示词，共 ${PROMPTS.length} 个`, `System prompts for every AI node in AlphaTo — ${PROMPTS.length} in total`)}</p>
        </div>

        {STAGES.map((stage) => {
          const items = PROMPTS.filter((p) => p.stage === stage);
          if (items.length === 0) return null;
          return (
            <div key={stage}>
              <h2 className="text-base font-semibold border-b pb-2 mb-6">{lang === "en" ? STAGES_EN[stage] : stage}</h2>
              <div className="space-y-10">
                {items.map((p) => {
                  const Icon = p.icon;
                  return (
                    <section key={p.id} id={p.id} className="scroll-mt-6">
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <Icon size={20} className="text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-bold">{lang === "en" ? p.nameEn : p.name}</h3>
                            {p.googleSearch && <Badge variant="outline" className="text-[10px]">Google Search</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{lang === "en" ? p.purposeEn : p.purpose}</p>
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        <div className="rounded-lg border p-2.5">
                          <p className="text-[10px] text-muted-foreground">{t("端点", "Endpoint")}</p>
                          <p className="text-xs font-mono font-medium mt-0.5">{p.endpoint}</p>
                        </div>
                        <div className="rounded-lg border p-2.5">
                          <p className="text-[10px] text-muted-foreground">{t("源文件", "Source")}</p>
                          <p className="text-xs font-mono mt-0.5 truncate" title={p.source}>{p.source.split("/").pop()}</p>
                        </div>
                        <div className="rounded-lg border p-2.5">
                          <p className="text-[10px] text-muted-foreground">{t("模型", "Model")}</p>
                          <p className="text-xs font-medium mt-0.5">{p.model}</p>
                        </div>
                        <div className="rounded-lg border p-2.5">
                          <p className="text-[10px] text-muted-foreground">{t("超时", "Timeout")}</p>
                          <p className="text-xs font-medium mt-0.5">{p.timeout}</p>
                        </div>
                      </div>

                      {/* Inputs */}
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold mb-2">{t("输入参数", "Input Parameters")}</h4>
                        <div className="flex flex-wrap gap-2">
                          {p.inputs.map((inp) => (
                            <span key={inp.name} className="text-xs px-2 py-1 rounded border bg-muted/30" title={lang === "en" ? inp.descEn : inp.desc}>
                              <code className="font-mono text-[11px]">{inp.name}</code>
                              <span className="text-muted-foreground ml-1.5">{lang === "en" ? inp.descEn : inp.desc}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Prompt */}
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold mb-2">{t("系统提示词", "System Prompt")}</h4>
                        <div className="rounded-xl bg-slate-950 text-slate-200 p-5 overflow-x-auto">
                          <pre className="text-[13px] leading-[1.7] whitespace-pre-wrap font-mono">{p.prompt}</pre>
                        </div>
                      </div>

                      {/* Output */}
                      <div>
                        <h4 className="text-xs font-semibold mb-2">{t("输出格式", "Output Format")}</h4>
                        <div className="rounded-lg border bg-muted/20 p-3">
                          <code className="text-xs font-mono text-muted-foreground">{p.outputFormat}</code>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
