import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { industry, platform } = await req.json();

    const platformName = {
      douyin: "抖音", tiktok: "TikTok", xiaohongshu: "小红书",
      instagram: "Instagram", kuaishou: "快手", wechat: "微信视频号",
      youtube: "YouTube", bilibili: "Bilibili",
    }[platform] || "抖音";

    const data = await geminiRequest("gemini-2.5-flash", {
      contents: [
        {
          parts: [
            {
              text: `你是一个资深的${platformName}社媒运营专家，同时也是一个敏锐的热点观察者。

请帮我搜索并整理今日（${new Date().toLocaleDateString("zh-CN")}）与"${industry}"行业相关的热点和趋势。

请从以下维度搜索：
1. ${platformName}平台上的热门话题和趋势
2. 与${industry}相关的最新新闻和行业事件
3. 社交媒体上的热梗和流行表达
4. 近期的社会热点，可以与${industry}结合的
5. 历史上的今天有什么值得内容创作的事件
6. ${industry}品类的冷知识或反常识的内容

请以 JSON 数组格式返回（只返回 JSON，不要其他文字），每个热点包含：

[
  {
    "title": "热点标题",
    "description": "热点的详细描述（2-3句话）",
    "source": "来源类型：platform_trend / news / social_meme / history / trivia / industry_event",
    "heatScore": 1到10的热度评分,
    "relevance": "与${industry}行业的关联说明"
  }
]

请返回 8~12 个热点，按热度和相关性综合排序。`,
            },
          ],
        },
      ],
    });

    const text = extractTextFromResponse(data);

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const trends = JSON.parse(jsonMatch[0]);
        return NextResponse.json({ success: true, trends });
      }
    } catch {
      // Fall through
    }

    return NextResponse.json({ success: true, trends: [], raw: text });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
