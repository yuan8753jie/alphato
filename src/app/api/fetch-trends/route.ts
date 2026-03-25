import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";

export const maxDuration = 120; // Allow up to 120s for search grounding

export async function POST(req: NextRequest) {
  try {
    const { industry, platform } = await req.json();

    const platformName: Record<string, string> = {
      douyin: "抖音", tiktok: "TikTok", xiaohongshu: "小红书",
      instagram: "Instagram", kuaishou: "快手", wechat: "微信视频号",
      youtube: "YouTube", bilibili: "Bilibili",
    };
    const pName = platformName[platform] || "抖音";

    const today = new Date().toLocaleDateString("zh-CN", {
      year: "numeric", month: "long", day: "numeric", weekday: "long",
    });

    // Google Search grounding takes longer, use 90s timeout
    const data = await geminiRequest("gemini-2.5-flash", {
      contents: [
        {
          parts: [
            {
              text: `你是一个资深的社媒内容运营专家。请通过搜索，帮我收集今天（${today}）可以用于${pName}内容创作的真实热点信息。

严格要求：
- 所有信息必须来自搜索结果，不允许编造或猜测任何热点
- 每条热点必须注明信息来源（如：抖音热搜榜、微博热搜、新闻网站名称等）
- 如果搜索不到某个维度的信息，就跳过，不要凑数

请从以下维度搜索：
1. ${pName}平台当前的热搜榜/热门话题（搜索"${pName}热搜"或"${pName}热门话题"）
2. 与"${industry}"行业直接相关的最新新闻（搜索"${industry} 新闻 最新"）
3. 当前社交媒体上正在流行的梗/表达方式（搜索"最近流行的梗"或"社交媒体热梗"）
4. 可以与"${industry}"结合的社会热点新闻（搜索"今日热点新闻"）
5. 历史上的今天（${today}）发生过的、适合内容创作的事件（搜索"历史上的今天 ${new Date().getMonth() + 1}月${new Date().getDate()}日"）
6. "${industry}"品类的冷知识或反常识内容（搜索"${industry} 冷知识"或"${industry} 你不知道的事"）

请以 JSON 数组格式返回（只返回 JSON，不要其他文字），每条包含：

[
  {
    "title": "热点标题",
    "description": "2-3句话描述这个热点的具体内容",
    "source": "信息来源（如：抖音热搜榜、新浪新闻、百度百科等具体来源）",
    "sourceType": "platform_trend / news / social_meme / history / trivia / industry_event",
    "heatScore": 1到10的热度评分（基于搜索结果判断），
    "relevance": "这个热点与${industry}行业的潜在关联（即使是非行业热点，也说明可以怎么关联）"
  }
]

宁缺毋滥，只返回有真实来源的信息，数量不限。`,
            },
          ],
        },
      ],
      tools: [{ googleSearch: {} }],
    }, 90000);

    const text = extractTextFromResponse(data);

    // Extract grounding sources from response metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groundingChunks = (data as any).candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks.map((chunk: { web?: { title?: string; uri?: string } }) => ({
      title: chunk.web?.title || "",
      uri: chunk.web?.uri || "",
    }));

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const trends = JSON.parse(jsonMatch[0]);
        return NextResponse.json({ success: true, trends, groundingSources: sources });
      }
    } catch {
      // Fall through
    }

    return NextResponse.json({ success: true, trends: [], raw: text, groundingSources: sources });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
