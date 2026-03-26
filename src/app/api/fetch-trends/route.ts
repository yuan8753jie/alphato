import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import type { TrendCategory } from "@/lib/types";

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

// ============================================================
// Brand safety filter — appended to every search round prompt
// ============================================================

const SAFETY_FILTER = `

品牌安全过滤（必须严格执行）：
直接剔除以下类型的内容，不要返回：
- 政治敏感：国家领导人、国际冲突、领土争议、政策争议、政治运动
- 负面社会新闻：犯罪、事故、灾难、死亡、暴力事件
- 明星塌房：出轨、吸毒、违法、粉丝对立
- 自然灾害：地震、洪水、台风等
- 宗教/民族争议
- 公共卫生恐慌：食品安全丑闻、疫情恐慌
- 未经证实的谣言/爆料
- 涉及未成年人的负面新闻

例外：如果某条热点涉及竞品的负面新闻（如竞品食品安全问题、竞品公关危机等），仍然保留，但在返回的 JSON 中加上 "warning": "竞品负面" 字段。这类热点需要谨慎使用，但对品牌有参考价值。

对于正常的热点，不需要 warning 字段。`;

// ============================================================
// Search round definitions — grouped into 3 sections
// ============================================================

interface Round {
  section: "global" | "industry" | "brand";
  defaultCategory: TrendCategory;
  prompt: (c: Ctx) => string;
}

const ROUNDS: Round[] = [
  // --- Global (no brand/industry context) ---
  {
    section: "global",
    defaultCategory: "platform_hot",
    prompt: ({ pName, today }) =>
      `搜索${today}${pName}平台的热搜榜/热门话题，以及当前社交媒体上正在流行的梗和表达方式。

搜索建议："${pName}热搜榜"、"最近流行梗"、"抖音热梗 2026"

严格要求：全部来自搜索结果，禁止编造，每条标注来源。
${SAFETY_FILTER}
返回 JSON 数组（只返回 JSON）：
[{"title":"","description":"2-3句","category":"platform_hot 或 social_meme","source":"来源网站名","heatScore":1到10,"relevance":"内容创作价值","warning":"仅竞品负面时填写，否则不要此字段"}]`,
  },
  {
    section: "global",
    defaultCategory: "sports_event",
    prompt: ({ year, month }) =>
      `搜索${year}年${month}月至${Math.min(month + 2, 12)}月期间的重大事件：

1. 体育赛事（搜索"${year}年${month}月 体育赛事"）
2. 热门综艺/即将上映电影电视剧（搜索"${year}年${month}月 热门综艺 上映电影"）
3. 节日、节气、纪念日（搜索"${year}年${month}月 节日节气"）

严格要求：来自搜索结果，标注来源和日期。
${SAFETY_FILTER}
返回 JSON 数组（只返回 JSON）：
[{"title":"","description":"2-3句","category":"sports_event 或 entertainment 或 holiday_calendar","source":"来源名","heatScore":1到10,"relevance":"内容创作价值","eventDate":"YYYY-MM-DD","warning":"仅竞品负面时填写，否则不要此字段"}]`,
  },
  // --- Industry (needs industry keyword) ---
  {
    section: "industry",
    defaultCategory: "industry_news",
    prompt: ({ industry, today, month, day }) =>
      `搜索以下与"${industry}"行业相关的内容：

1. ${industry}行业最新新闻动态（搜索"${industry} 最新新闻 ${today}"）
2. ${industry}品类的冷知识、反常识内容（搜索"${industry} 冷知识"）
3. 历史上的${month}月${day}日发生过的有趣事件（搜索"历史上的今天 ${month}月${day}日"）

严格要求：来自搜索结果，标注来源。
${SAFETY_FILTER}
返回 JSON 数组（只返回 JSON）：
[{"title":"","description":"2-3句","category":"industry_news 或 trivia 或 history_today","source":"来源名","heatScore":1到10,"relevance":"与${industry}的关联","warning":"仅竞品负面时填写，否则不要此字段"}]`,
  },
  // --- Brand signals (needs brand name + benchmark accounts) ---
  {
    section: "brand",
    defaultCategory: "brand_related",
    prompt: ({ brandName, benchmarkNames }) => {
      const parts = [`搜索与"${brandName}"品牌相关的最新动态：
1. 品牌最新新闻、活动、代言人动态（搜索"${brandName} 最新动态"、"${brandName} 代言人"）`];

      if (benchmarkNames.length > 0) {
        parts.push(`2. 对标/竞品账号的近期内容动态：${benchmarkNames.map((n) => `搜索"${n} 抖音 最新"`).join("、")}`);
      }

      parts.push(`严格要求：来自搜索结果，标注来源。
${SAFETY_FILTER}
返回 JSON 数组（只返回 JSON）：
[{"title":"","description":"2-3句","category":"brand_related","source":"来源名","heatScore":1到10,"relevance":"对品牌内容创作的价值","warning":"仅竞品负面时填写，否则不要此字段"}]`);

      return parts.join("\n\n");
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const { industry, platform, brandName, benchmarkAccounts, sections } = await req.json();

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

    // Filter rounds by requested sections, or run all
    const requestedSections = sections as string[] | undefined;
    const roundsToRun = requestedSections
      ? ROUNDS.filter((r) => requestedSections.includes(r.section))
      : ROUNDS;

    // Run all rounds in parallel
    const results = await Promise.allSettled(
      roundsToRun.map(async (round) => {
        const data = await geminiRequest(
          "gemini-2.5-flash",
          {
            contents: [{ parts: [{ text: round.prompt(ctx) }] }],
            tools: [{ googleSearch: {} }],
          },
          90000
        );
        const text = extractTextFromResponse(data);

        // Extract REAL source URLs from Google Search grounding metadata
        // Grounding chunks contain: { web: { title: "domain.com", uri: "redirect URL" } }
        // The uri is a Google redirect that leads to the real page — this is trustworthy
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const groundingChunks: { web?: { title?: string; uri?: string } }[] =
          (data as any).candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const realSources = groundingChunks
          .filter((c) => c.web?.uri)
          .map((c) => ({ domain: (c.web?.title || "").toLowerCase(), uri: c.web!.uri! }));

        return parseTrends(text).map((t: Record<string, unknown>, i: number) => {
          const title = String(t.title || "");
          const source = String(t.source || "").toLowerCase();

          // Match by source name → grounding chunk domain
          // e.g. source="新浪新闻" matches domain="sina.cn"
          // Also try: source contains domain, or domain contains part of source
          const matchedSource = realSources.find((s) =>
            source.includes(s.domain) ||
            s.domain.includes(source.split(/[,，、\s]/)[0]) ||
            // Fallback: match any grounding source by index
            false
          ) || (realSources.length > 0 ? realSources[i % realSources.length] : undefined);

          return {
            id: `trend_${crypto.randomUUID().slice(0, 8)}_${i}`,
            title,
            description: String(t.description || ""),
            category: normalizeCategory(t.category, round.defaultCategory),
            source: String(t.source || ""),
            sourceUrl: matchedSource?.uri || undefined,  // Only real URLs from grounding
            heatScore: t.heatScore || 5,
            relevance: String(t.relevance || ""),
            eventDate: t.eventDate ? String(t.eventDate) : undefined,
            warning: t.warning ? String(t.warning) : undefined,
            section: round.section,
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
      roundsCompleted: results.filter((r) => r.status === "fulfilled").length,
      roundsTotal: roundsToRun.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
