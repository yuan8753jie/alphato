import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import type { TrendCategory, TrendSection } from "@/lib/types";

export const maxDuration = 120;

const VALID_CATEGORIES = new Set<string>([
  "platform_hot", "industry_news", "social_meme",
  "sports_event", "entertainment", "holiday_calendar",
  "brand_related", "trivia", "history_today",
]);

function normalizeCategory(raw: unknown, fallback: TrendCategory): TrendCategory {
  if (typeof raw === "string" && VALID_CATEGORIES.has(raw)) return raw as TrendCategory;
  return fallback;
}

function parseTrends(text: string): Record<string, unknown>[] {
  try {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]);
  } catch { /* ignore */ }
  return [];
}

// ============================================================
// Brand safety filter
// ============================================================

const SAFETY_FILTER = `
品牌安全过滤（必须严格执行）：
直接剔除：政治敏感、负面社会新闻、明星塌房、自然灾害、宗教民族争议、公共卫生恐慌、未经证实的谣言、涉及未成年人的负面新闻。
例外：竞品负面新闻保留，但加上 "warning": "竞品负面"。`;

const JSON_FORMAT = `返回 JSON 数组（只返回 JSON，不要其他文字），每条包含：
{"title":"标题","description":"2-3句描述","source":"来源网站域名如 people.com.cn","heatScore":1到10,"relevance":"内容创作关联说明"}
如有预计日期加 "eventDate":"YYYY-MM-DD"，如有竞品负面加 "warning":"竞品负面"。`;

// ============================================================
// 9 category agents — each one focused on a single category
// ============================================================

interface Agent {
  category: TrendCategory;
  section: TrendSection;
  count: string; // "10~15" etc.
  prompt: (c: Ctx) => string;
}

interface Ctx {
  pName: string;
  industry: string;
  today: string;
  month: number;
  day: number;
  year: number;
  brandName: string;
  benchmarkNames: string[];
}

const AGENTS: Agent[] = [
  {
    category: "platform_hot",
    section: "global",
    count: "10~15",
    prompt: ({ pName, today }) =>
      `你是${pName}平台热搜分析师。搜索${today}${pName}平台的热搜榜和热门话题。
搜索建议："${pName}热搜榜"、"${pName}今日热门"
请返回 10~15 条当前最热门的话题。每条必须来自搜索结果，标注来源。
${SAFETY_FILTER}
${JSON_FORMAT}`,
  },
  {
    category: "social_meme",
    section: "global",
    count: "10~15",
    prompt: ({ today }) =>
      `你是社交媒体梗文化研究员。搜索${today}前后社交媒体上正在流行的梗、热门表达方式、网络流行语。
搜索建议："最近流行梗 2026"、"抖音热梗"、"网络流行语"、"社交媒体热梗"
请返回 10~15 条正在流行的梗/表达。每条必须来自搜索结果，标注来源。
${SAFETY_FILTER}
${JSON_FORMAT}`,
  },
  {
    category: "sports_event",
    section: "global",
    count: "10~15",
    prompt: ({ year, month }) =>
      `你是体育赛事日历专家。搜索${year}年${month}月至${Math.min(month + 3, 12)}月期间的重大体育赛事。
搜索建议："${year}年体育赛事日程"、"${year}年${month}月体育赛事"、"近期体育比赛"
请返回 10~15 场即将举行或正在进行的重要赛事。每条标注日期和来源。
${SAFETY_FILTER}
${JSON_FORMAT}`,
  },
  {
    category: "entertainment",
    section: "global",
    count: "10~15",
    prompt: ({ year, month }) =>
      `你是影视综艺情报员。搜索${year}年${month}月至${Math.min(month + 2, 12)}月的热门综艺节目、即将上映的电影和电视剧。
搜索建议："${year}年${month}月上映电影"、"${year}年热门综艺"、"最近热播电视剧"
请返回 10~15 部作品。每条标注上映/播出日期和来源。
${SAFETY_FILTER}
${JSON_FORMAT}`,
  },
  {
    category: "holiday_calendar",
    section: "global",
    count: "10~15",
    prompt: ({ year, month }) =>
      `你是节日节气日历专家。搜索${year}年${month}月至${Math.min(month + 3, 12)}月的节日、节气、纪念日、国际日。
搜索建议："${year}年${month}月节日节气"、"${year}年节假日安排"、"国际纪念日 ${month}月"
请返回 10~15 个重要日期。每条标注日期和来源。
${SAFETY_FILTER}
${JSON_FORMAT}`,
  },
  {
    category: "industry_news",
    section: "industry",
    count: "10~15",
    prompt: ({ industry, today }) =>
      `你是${industry}行业分析师。搜索${today}前后"${industry}"行业的最新新闻、市场动态、企业动向。
搜索建议："${industry}行业新闻"、"${industry}市场动态"、"${industry}企业最新"
请返回 10~15 条行业资讯。每条必须来自搜索结果，标注来源。
${SAFETY_FILTER}
${JSON_FORMAT}`,
  },
  {
    category: "trivia",
    section: "industry",
    count: "10~15",
    prompt: ({ industry }) =>
      `你是${industry}品类的冷知识收集者。搜索与"${industry}"相关的冷知识、反常识内容、有趣的科普知识。
搜索建议："${industry}冷知识"、"${industry}你不知道的"、"${industry}有趣事实"、"${industry}科普"
请返回 10~15 条有趣且可验证的冷知识。每条必须来自搜索结果，标注来源。
${SAFETY_FILTER}
${JSON_FORMAT}`,
  },
  {
    category: "history_today",
    section: "industry",
    count: "10~15",
    prompt: ({ month, day }) =>
      `你是历史事件研究员。搜索历史上的${month}月${day}日发生过的有趣、积极、适合内容创作的事件。
搜索建议："历史上的今天 ${month}月${day}日"、"${month}月${day}日大事记"
请返回 10~15 件历史事件。每条必须来自搜索结果，标注来源。
${SAFETY_FILTER}
${JSON_FORMAT}`,
  },
  {
    category: "brand_related",
    section: "brand",
    count: "10~15",
    prompt: ({ brandName, benchmarkNames }) => {
      let text = `你是品牌情报分析师。搜索与"${brandName}"品牌相关的最新动态：
1. 品牌新闻、活动、代言人动态（搜索"${brandName} 最新动态"、"${brandName} 代言人"、"${brandName} 新品"）`;

      if (benchmarkNames.length > 0) {
        text += `\n2. 竞品/对标品牌动态：${benchmarkNames.map((n) => `搜索"${n} 最新动态"`).join("、")}`;
      }

      text += `\n请返回 10~15 条品牌相关资讯。每条必须来自搜索结果，标注来源。
${SAFETY_FILTER}
${JSON_FORMAT}`;

      return text;
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const { industry, platform, brandName, benchmarkAccounts, categories } = await req.json();

    const pName: string = ({
      douyin: "抖音", tiktok: "TikTok", xiaohongshu: "小红书",
      instagram: "Instagram", kuaishou: "快手", wechat: "微信视频号",
      youtube: "YouTube", bilibili: "Bilibili",
    } as Record<string, string>)[platform] || "抖音";

    const now = new Date();
    const ctx: Ctx = {
      pName,
      industry: industry || "",
      today: now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }),
      month: now.getMonth() + 1,
      day: now.getDate(),
      year: now.getFullYear(),
      brandName: brandName || "",
      benchmarkNames: (benchmarkAccounts || [])
        .map((b: { notes?: string }) => b.notes)
        .filter(Boolean),
    };

    // Allow fetching specific categories, or all
    const requestedCategories = categories as string[] | undefined;
    const agentsToRun = requestedCategories
      ? AGENTS.filter((a) => requestedCategories.includes(a.category))
      : AGENTS;

    // Run ALL agents in parallel — each one is a focused search
    const results = await Promise.allSettled(
      agentsToRun.map(async (agent) => {
        const data = await geminiRequest(
          "gemini-2.5-flash",
          {
            contents: [{ parts: [{ text: agent.prompt(ctx) }] }],
            tools: [{ googleSearch: {} }],
          },
          90000
        );
        const text = extractTextFromResponse(data);

        // Real source URLs from Google Search grounding metadata
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const groundingChunks: { web?: { title?: string; uri?: string } }[] =
          (data as any).candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const realSources = groundingChunks
          .filter((c) => c.web?.uri)
          .map((c) => ({ domain: (c.web?.title || "").toLowerCase(), uri: c.web!.uri! }));

        return parseTrends(text).map((t: Record<string, unknown>, i: number) => {
          // Match source domain to grounding chunk domain
          // LLM now returns domains (e.g. "sina.com.cn") instead of Chinese names
          const sourceDomain = String(t.source || "").toLowerCase().trim();
          const matchedSource = realSources.find((s) =>
            sourceDomain && (s.domain.includes(sourceDomain) || sourceDomain.includes(s.domain))
          );

          return {
            id: `trend_${crypto.randomUUID().slice(0, 8)}_${i}`,
            title: String(t.title || ""),
            description: String(t.description || ""),
            category: normalizeCategory(t.category, agent.category),
            source: String(t.source || ""),
            sourceUrl: matchedSource?.uri || undefined,
            heatScore: t.heatScore || 5,
            relevance: String(t.relevance || ""),
            eventDate: t.eventDate ? String(t.eventDate) : undefined,
            warning: t.warning ? String(t.warning) : undefined,
            section: agent.section,
            fetchedAt: now.toISOString(),
          };
        });
      })
    );

    const allTrends = results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason?.message || "Unknown error");

    return NextResponse.json({
      success: true,
      trends: allTrends,
      agentsCompleted: results.filter((r) => r.status === "fulfilled").length,
      agentsTotal: agentsToRun.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
