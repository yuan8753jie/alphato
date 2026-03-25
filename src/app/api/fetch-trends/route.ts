import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import type { TrendCategory } from "@/lib/types";

const VALID_CATEGORIES = new Set<string>([
  "platform_hot", "industry_news", "social_meme",
  "sports_event", "entertainment", "holiday_calendar",
  "brand_related", "trivia", "history_today",
]);

function normalizeCategory(raw: unknown, fallback: TrendCategory): TrendCategory {
  if (typeof raw === "string" && VALID_CATEGORIES.has(raw)) return raw as TrendCategory;
  return fallback;
}

export const maxDuration = 120;

interface SearchRound {
  name: string;
  categories: TrendCategory[];
  buildPrompt: (ctx: { pName: string; industry: string; today: string; month: number; day: number; year: number; brandName?: string }) => string;
}

const SEARCH_ROUNDS: SearchRound[] = [
  {
    name: "实时热点",
    categories: ["platform_hot", "industry_news", "social_meme"],
    buildPrompt: ({ pName, industry, today }) => `你是社媒热点分析师。请搜索以下三类今日（${today}）的真实热点：

1. ${pName}平台当前热搜榜上的热门话题（搜索"${pName}热搜榜"）
2. "${industry}"行业最新新闻动态（搜索"${industry} 最新新闻"）
3. 当前社交媒体上正在流行的梗和表达方式（搜索"最近流行梗 2026"或"抖音热梗"）

严格要求：所有信息必须来自搜索结果，禁止编造。每条必须标注来源。

返回 JSON 数组（只返回 JSON）：
[
  {
    "title": "标题",
    "description": "2-3句具体描述",
    "category": "platform_hot 或 industry_news 或 social_meme",
    "source": "具体来源网站名",
    "heatScore": 1到10,
    "relevance": "与${industry}的关联说明"
  }
]`,
  },
  {
    name: "预测事件",
    categories: ["sports_event", "entertainment", "holiday_calendar", "brand_related"],
    buildPrompt: ({ industry, year, month, brandName }) => `你是内容日历规划师。请搜索${year}年${month}月至${month + 2 > 12 ? 12 : month + 2}月期间，以下类型的即将发生的重要事件：

1. 重大体育赛事（搜索"${year}年体育赛事日程"或"近期体育赛事"）
2. 热门综艺节目、即将上映的电影/电视剧（搜索"${year}年${month}月 热门综艺"、"${year}年${month}月 上映电影"）
3. 节日、节气、纪念日（搜索"${year}年${month}月 节日节气"）
${brandName ? `4. 与"${brandName}"品牌相关的动态，如代言人新闻、品牌活动（搜索"${brandName} 最新动态"或"${brandName} 代言人"）` : ""}

严格要求：所有信息必须来自搜索结果。每条标注来源和预计日期。

返回 JSON 数组（只返回 JSON）：
[
  {
    "title": "事件标题",
    "description": "2-3句具体描述",
    "category": "sports_event 或 entertainment 或 holiday_calendar 或 brand_related",
    "source": "具体来源",
    "heatScore": 1到10（预估热度）,
    "relevance": "与${industry}行业的内容创作关联",
    "eventDate": "YYYY-MM-DD（预计日期，如知道的话）"
  }
]`,
  },
  {
    name: "常青素材",
    categories: ["trivia", "history_today"],
    buildPrompt: ({ industry, today, month, day }) => `你是内容创意顾问。请搜索以下两类常青内容素材：

1. "${industry}"品类的冷知识、反常识内容（搜索"${industry} 冷知识"或"${industry} 你不知道的"）
2. 历史上的${month}月${day}日发生过的有趣事件，适合做内容创作的（搜索"历史上的今天 ${month}月${day}日"）

今天是${today}。

严格要求：必须来自搜索结果，标注来源。冷知识要有趣且可验证。

返回 JSON 数组（只返回 JSON）：
[
  {
    "title": "标题",
    "description": "2-3句具体描述",
    "category": "trivia 或 history_today",
    "source": "具体来源",
    "heatScore": 1到10,
    "relevance": "与${industry}的内容创作关联"
  }
]`,
  },
];

function parseTrendsFromText(text: string): Record<string, unknown>[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // ignore
  }
  return [];
}

export async function POST(req: NextRequest) {
  try {
    const { industry, platform, brandName, rounds } = await req.json();

    const platformName: Record<string, string> = {
      douyin: "抖音", tiktok: "TikTok", xiaohongshu: "小红书",
      instagram: "Instagram", kuaishou: "快手", wechat: "微信视频号",
      youtube: "YouTube", bilibili: "Bilibili",
    };
    const pName = platformName[platform] || "抖音";
    const now = new Date();
    const today = now.toLocaleDateString("zh-CN", {
      year: "numeric", month: "long", day: "numeric", weekday: "long",
    });

    const ctx = {
      pName,
      industry: industry || "",
      today,
      month: now.getMonth() + 1,
      day: now.getDate(),
      year: now.getFullYear(),
      brandName,
    };

    // Allow client to request specific rounds, or run all
    const roundsToRun = rounds
      ? SEARCH_ROUNDS.filter((r) => (rounds as string[]).includes(r.name))
      : SEARCH_ROUNDS;

    // Run rounds in parallel
    const results = await Promise.allSettled(
      roundsToRun.map(async (round) => {
        const data = await geminiRequest(
          "gemini-2.5-flash",
          {
            contents: [{ parts: [{ text: round.buildPrompt(ctx) }] }],
            tools: [{ googleSearch: {} }],
          },
          90000
        );
        const text = extractTextFromResponse(data);
        const parsed = parseTrendsFromText(text);
        return parsed.map((t: Record<string, unknown>, i: number) => ({
          id: `trend_${round.categories[0]}_${crypto.randomUUID().slice(0, 8)}_${i}`,
          title: t.title || "",
          description: t.description || "",
          category: normalizeCategory(t.category, round.categories[0]),
          source: t.source || "",
          heatScore: t.heatScore || 5,
          relevance: t.relevance || "",
          eventDate: t.eventDate || undefined,
          fetchedAt: new Date().toISOString(),
        }));
      })
    );

    const allTrends = results.flatMap((r) =>
      r.status === "fulfilled" ? r.value : []
    );

    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason?.message || "Unknown error");

    return NextResponse.json({
      success: true,
      trends: allTrends,
      roundsCompleted: results.filter((r) => r.status === "fulfilled").length,
      roundsTotal: roundsToRun.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
