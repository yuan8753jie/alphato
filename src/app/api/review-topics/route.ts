import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import type { Account, Topic } from "@/lib/types";

export const maxDuration = 300;

function getPlatformName(platform: string): string {
  return ({
    douyin: "抖音", tiktok: "TikTok", xiaohongshu: "小红书",
    instagram: "Instagram", kuaishou: "快手", wechat: "微信视频号",
    youtube: "YouTube", bilibili: "Bilibili",
  } as Record<string, string>)[platform] || "抖音";
}

export async function POST(req: NextRequest) {
  try {
    const { account, topics, personas } = (await req.json()) as {
      account: Account;
      topics: Topic[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personas: any[];
    };

    const pName = getPlatformName(account.platform);

    const topicsList = topics.map((t, i) =>
      `${i + 1}. [${t.type}] ${t.title}\n   角度：${t.angle}\n   概要：${t.description}`
    ).join("\n\n");

    const personasSummary = personas.map((p) =>
      `- ${p.name}（${p.age}岁${p.gender}，${p.occupation}）：${p.profile}。内容偏好：${p.contentPreference}。品牌认知：${p.brandAwareness}`
    ).join("\n");

    const data = await geminiRequest("gemini-2.5-flash", {
      contents: [{
        parts: [{
          text: `你现在要扮演以下 ${personas.length} 个真实用户，逐一对 ${topics.length} 条${pName}短视频选题进行评审。

## 审稿人
${personasSummary}

## 待审选题
${topicsList}

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
        }],
      }],
    }, 180000);

    const text = extractTextFromResponse(data);
    let reviewResult: Record<string, unknown> = {};
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) reviewResult = JSON.parse(m[0]);
    } catch { /* ignore */ }

    return NextResponse.json({ success: true, reviews: reviewResult });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
