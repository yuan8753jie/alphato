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

请以"${persona.name}"的身份，真实地评价这条内容。打分要诚实，不好就给低分。

返回 JSON（只返回 JSON）：
{
  "stop": 1到10（刷到标题你会停下来看吗）,
  "watch": 1到10（你会看完整条视频吗）,
  "engage": 1到10（你会点赞/评论/收藏/转发吗）,
  "convert": 1到10（看完后你想了解/购买产品吗）,
  "comment": "用你自己的口吻说一句真实感受（口语化，像发朋友圈或弹幕）"
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

    return NextResponse.json({
      success: true,
      review: {
        personaName: persona.name,
        ...review,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
