import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { persona, topic, brandName, platform } = await req.json();

    const pName = ({
      douyin: "抖音", tiktok: "TikTok", xiaohongshu: "小红书",
      instagram: "Instagram", kuaishou: "快手", wechat: "微信视频号",
      youtube: "YouTube", bilibili: "Bilibili",
    } as Record<string, string>)[platform] || "抖音";

    const data = await geminiRequest("gemini-2.5-flash", {
      contents: [{
        parts: [{
          text: `你现在是"${persona.name}"，${persona.age}岁${persona.gender}，${persona.occupation}。

你的特征：${persona.profile}
你的内容偏好：${persona.contentPreference || ""}
你对${brandName}的认知：${persona.brandAwareness || ""}

你在刷${pName}的时候看到了下面这条内容：

标题：${topic.title}
类型：${topic.type}
角度：${topic.angle}
内容概要：${topic.description}

请以"${persona.name}"的身份，真实地评价这条内容。先思考，再打分。打分要诚实，不好就给低分。

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
        }],
      }],
    });

    const text = extractTextFromResponse(data);
    let review = null;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) review = JSON.parse(m[0]);
    } catch { /* ignore */ }

    if (!review) {
      return NextResponse.json({ success: false, error: "评审解析失败" });
    }

    // Normalize: support both { stop: 9 } and { stop: { score: 9, reason: "..." } }
    const normalize = (field: unknown): { score: number; reason: string } => {
      if (typeof field === "object" && field !== null && "score" in field) {
        return field as { score: number; reason: string };
      }
      return { score: Number(field) || 5, reason: "" };
    };

    const normalized = {
      personaName: persona.name,
      stop: normalize(review.stop),
      watch: normalize(review.watch),
      engage: normalize(review.engage),
      convert: normalize(review.convert),
      comment: review.comment || "",
    };

    return NextResponse.json({ success: true, review: normalized });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
