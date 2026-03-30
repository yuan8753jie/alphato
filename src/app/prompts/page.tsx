"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Image, Compass, Users, MessageSquare, ClipboardCheck, Clapperboard,
} from "lucide-react";

interface PromptEntry {
  id: string;
  name: string;
  endpoint: string;
  source: string;
  stage: string;
  stageColor: string;
  icon: React.ElementType;
  purpose: string;
  model: string;
  googleSearch: boolean;
  timeout: string;
  inputs: { name: string; desc: string }[];
  prompt: string;
  outputFormat: string;
}

const STAGES = ["账号设置", "发现", "选题", "评审", "创作"];

const PROMPTS: PromptEntry[] = [
  {
    id: "extract-brand",
    name: "品牌资料提取",
    endpoint: "/api/extract-brand",
    source: "src/app/api/extract-brand/route.ts",
    stage: "账号设置",
    stageColor: "bg-gray-100 text-gray-700",
    icon: Image,
    purpose: "从上传的品牌手册/规范图片中，用 Gemini Vision 提取品牌名称、行业、调性、规则等信息",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "60s",
    inputs: [
      { name: "image", desc: "用户上传的图片（base64 编码）" },
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

如果某个字段无法从图片中提取，设为空字符串或空数组。
summary 字段务必尽可能完整地提取图片中的文字内容。`,
    outputFormat: '{ brandName, industry, tone, rules[], summary }',
  },
  {
    id: "fetch-trends",
    name: "热点抓取（9 个 Agent 并行）",
    endpoint: "/api/fetch-trends",
    source: "src/app/api/fetch-trends/route.ts",
    stage: "发现",
    stageColor: "bg-blue-100 text-blue-700",
    icon: Compass,
    purpose: "9 个专业 Agent 并行搜索，覆盖：平台热搜、社交热梗、体育赛事、综艺影视、节日节气、行业动态、冷知识、历史今天、品牌信号",
    model: "gemini-2.5-flash + Google Search",
    googleSearch: true,
    timeout: "90s / agent",
    inputs: [
      { name: "industry", desc: "品牌所属行业" },
      { name: "platform", desc: "目标平台（如 douyin）" },
      { name: "brandName", desc: "品牌名称" },
      { name: "benchmarkAccounts", desc: "对标账号列表" },
    ],
    prompt: `【以 platform_hot Agent 为例，共 9 个 Agent 结构相同】

你是\${pName}平台热搜分析师。
搜索\${today}\${pName}平台的热搜榜和热门话题。
搜索建议："\${pName}热搜榜"、"\${pName}今日热门"
请返回 10~15 条当前最热门的话题。
每条必须来自搜索结果，标注来源。

━━ 品牌安全过滤（所有 Agent 共用）━━
直接剔除：政治敏感、负面社会新闻、明星塌房、
自然灾害、宗教民族争议、公共卫生恐慌、
未经证实的谣言、涉及未成年人的负面新闻。
例外：竞品负面新闻保留，加 "warning": "竞品负面"。

━━ 9 个 Agent 分工 ━━
1. platform_hot  — 平台热搜榜
2. social_meme   — 社交热梗 / 流行语
3. sports_event  — 体育赛事（未来3个月）
4. entertainment — 综艺 / 电影 / 电视剧
5. holiday_calendar — 节日 / 节气 / 纪念日
6. industry_news — 行业新闻动态
7. trivia        — 品类冷知识
8. history_today — 历史上的今天
9. brand_related — 品牌 + 竞品动态`,
    outputFormat: '[{ title, description, source(域名), heatScore, relevance, eventDate?, warning? }]',
  },
  {
    id: "generate-topics-p1",
    name: "Phase 1：热点筛选",
    endpoint: "/api/generate-topics",
    source: "src/app/api/generate-topics/route.ts",
    stage: "选题",
    stageColor: "bg-amber-100 text-amber-700",
    icon: MessageSquare,
    purpose: "从 100+ 条热点中，基于品牌相关度精选 15~20 条最适合的",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "60s",
    inputs: [
      { name: "account", desc: "完整账号信息（品牌/产品/受众/资料）" },
      { name: "trends", desc: "热点池全部数据" },
    ],
    prompt: `你是"\${brand.name}"品牌的\${pName}内容总监。

## 你的品牌
\${brandContext}

## 候选热点池（共 \${trends.length} 条）
\${formatTrendList(trends)}

## 任务
精选 15~20 条最适合做内容的热点。

选择标准：
1. 与品牌行业的关联度
2. 与目标受众兴趣/痛点的匹配度
3. 能否自然融入品牌产品
4. 时效性和传播潜力
5. 是否符合品牌调性

按 relevanceScore 从高到低排序。`,
    outputFormat: '[{ originalIndex, title, relevanceScore(1-10), reason }]',
  },
  {
    id: "generate-topics-p2",
    name: "Phase 2：创意策划",
    endpoint: "/api/generate-topics",
    source: "src/app/api/generate-topics/route.ts",
    stage: "选题",
    stageColor: "bg-amber-100 text-amber-700",
    icon: MessageSquare,
    purpose: "基于精选热点，按流量/信任/转化/人设配比生成 8 条选题",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "60s",
    inputs: [
      { name: "brandContext", desc: "品牌完整上下文" },
      { name: "selectedTrends", desc: "Phase 1 精选的热点" },
    ],
    prompt: `你是一个顶级的\${pName}内容策划专家。

## 品牌上下文
\${brandContext}

## 精选热点
\${selectedTrendsText}

## 任务
策划 8 个内容选题，严格按以下配比：
• 流量型（traffic）3 个 — 蹭热点拉曝光
• 信任型（trust）2 个 — 输出专业干货
• 转化型（conversion）2 个 — 自然种草
• 人设型（persona）1 个 — 展示品牌真实面

标题要像真实的\${pName}爆款。
产品融入要自然，不能硬广。`,
    outputFormat: '[{ title, type, angle, description, basedOnTrends[], estimatedAppeal }]',
  },
  {
    id: "generate-personas",
    name: "Persona 审稿团生成",
    endpoint: "/api/generate-personas",
    source: "src/app/api/generate-personas/route.ts",
    stage: "评审",
    stageColor: "bg-violet-100 text-violet-700",
    icon: Users,
    purpose: "基于品牌/行业/平台知识，构建 5~7 个差异化的虚拟目标受众",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "60s",
    inputs: [
      { name: "account", desc: "完整账号信息" },
    ],
    prompt: `你是一个资深的用户研究专家。

## 品牌信息
\${brandContext}

## 任务
构建 5~7 个有代表性的 Persona：
• 行业消费者结构和行为特征
• 品牌市场定位和目标人群
• 平台用户群体特征
• 不同年龄/性别/生活阶段的差异

先写出分析思路（维度、逻辑、覆盖度），
每个 Persona 之间要有明显差异，
既包含核心用户，也包含潜在用户。`,
    outputFormat: '{ reasoning: {dimensions[], logic, coverage}, personas[]: {name, age, gender, occupation, profile, contentPreference, brandAwareness, whyIncluded} }',
  },
  {
    id: "review-single",
    name: "单条选题独立评审",
    endpoint: "/api/review-single",
    source: "src/app/api/review-single/route.ts",
    stage: "评审",
    stageColor: "bg-violet-100 text-violet-700",
    icon: ClipboardCheck,
    purpose: "一个 Persona 独立评审一条选题，4 维度打分 + 推理依据 + 口语化评语",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "60s",
    inputs: [
      { name: "persona", desc: "单个 Persona 画像" },
      { name: "topic", desc: "单条选题" },
      { name: "brandName", desc: "品牌名" },
      { name: "platform", desc: "平台" },
    ],
    prompt: `你现在是"\${persona.name}"，
\${persona.age}岁\${persona.gender}，\${persona.occupation}。

你的特征：\${persona.profile}
内容偏好：\${persona.contentPreference}
品牌认知：\${persona.brandAwareness}

你在刷\${pName}看到了这条内容：
标题：\${topic.title}
角度：\${topic.angle}
概要：\${topic.description}

先思考，再打分。打分要诚实，不好就给低分。

每个维度给出分数和理由：
• stop  — 刷到标题会停下来看吗
• watch — 会看完整条视频吗
• engage — 会点赞/评论/收藏/转发吗
• convert — 看完想了解/购买产品吗`,
    outputFormat: '{ stop: {score, reason}, watch: {score, reason}, engage: {score, reason}, convert: {score, reason}, comment }',
  },
  {
    id: "generate-script",
    name: "短视频脚本生成",
    endpoint: "/api/generate-script",
    source: "src/app/api/generate-script/route.ts",
    stage: "创作",
    stageColor: "bg-green-100 text-green-700",
    icon: Clapperboard,
    purpose: "基于选题生成完整的短视频脚本：分镜表、口播逐字稿、导演备注",
    model: "gemini-2.5-flash",
    googleSearch: false,
    timeout: "60s",
    inputs: [
      { name: "account", desc: "完整账号信息" },
      { name: "topic", desc: "选定的选题" },
    ],
    prompt: `你是一个顶级的\${platformName}短视频编导。

## 品牌上下文
\${brandContext}

## 选题
标题：\${topic.title}
角度：\${topic.angle}
概要：\${topic.description}

## 任务
写一份完整的短视频脚本 + 分镜表。

要求：
1. 时长 30~60 秒
2. 开头 3 秒强 hook
3. 每 5~8 秒一个信息点
4. 结尾明确 CTA
5. 语言口语化
6. 产品融入自然
7. 标注背景音乐风格`,
    outputFormat: '{ title, hashtags[], totalDuration, musicStyle, hook, scenes[]: {sceneNumber, duration, visual, audio, text}, fullText, notes }',
  },
];

export default function PromptsPage() {
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
        <h2 className="text-sm font-bold mb-3">提示词目录</h2>
        {STAGES.map((stage) => {
          const items = PROMPTS.filter((p) => p.stage === stage);
          if (items.length === 0) return null;
          return (
            <div key={stage}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{stage}</p>
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
                    {p.name}
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
          <h1 className="text-xl font-bold">提示词目录</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AlphaTo 全部 AI 节点的系统提示词，共 {PROMPTS.length} 个</p>
        </div>

        {STAGES.map((stage) => {
          const items = PROMPTS.filter((p) => p.stage === stage);
          if (items.length === 0) return null;
          return (
            <div key={stage}>
              <h2 className="text-base font-semibold border-b pb-2 mb-6">{stage}</h2>
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
                            <h3 className="text-base font-bold">{p.name}</h3>
                            {p.googleSearch && <Badge variant="outline" className="text-[10px]">Google Search</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{p.purpose}</p>
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        <div className="rounded-lg border p-2.5">
                          <p className="text-[10px] text-muted-foreground">端点</p>
                          <p className="text-xs font-mono font-medium mt-0.5">{p.endpoint}</p>
                        </div>
                        <div className="rounded-lg border p-2.5">
                          <p className="text-[10px] text-muted-foreground">源文件</p>
                          <p className="text-xs font-mono mt-0.5 truncate" title={p.source}>{p.source.split("/").pop()}</p>
                        </div>
                        <div className="rounded-lg border p-2.5">
                          <p className="text-[10px] text-muted-foreground">模型</p>
                          <p className="text-xs font-medium mt-0.5">{p.model}</p>
                        </div>
                        <div className="rounded-lg border p-2.5">
                          <p className="text-[10px] text-muted-foreground">超时</p>
                          <p className="text-xs font-medium mt-0.5">{p.timeout}</p>
                        </div>
                      </div>

                      {/* Inputs */}
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold mb-2">输入参数</h4>
                        <div className="flex flex-wrap gap-2">
                          {p.inputs.map((inp) => (
                            <span key={inp.name} className="text-xs px-2 py-1 rounded border bg-muted/30" title={inp.desc}>
                              <code className="font-mono text-[11px]">{inp.name}</code>
                              <span className="text-muted-foreground ml-1.5">{inp.desc}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Prompt */}
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold mb-2">系统提示词</h4>
                        <div className="rounded-xl bg-slate-950 text-slate-200 p-5 overflow-x-auto">
                          <pre className="text-[13px] leading-[1.7] whitespace-pre-wrap font-mono">{p.prompt}</pre>
                        </div>
                      </div>

                      {/* Output */}
                      <div>
                        <h4 className="text-xs font-semibold mb-2">输出格式</h4>
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
