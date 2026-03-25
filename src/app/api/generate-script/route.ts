import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import type { Account, Topic } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { account, topic } = (await req.json()) as {
      account: Account;
      topic: Topic;
    };

    const platformName = {
      douyin: "抖音", tiktok: "TikTok", xiaohongshu: "小红书",
      instagram: "Instagram", kuaishou: "快手", wechat: "微信视频号",
      youtube: "YouTube", bilibili: "Bilibili",
    }[account.platform] || "抖音";

    const brandContext = [
      `品牌：${account.brand.name}`,
      `行业：${account.brand.industry}`,
      `调性：${account.brand.tone}`,
      account.brand.rules.length > 0
        ? `红线规则：${account.brand.rules.join("；")}`
        : "",
      account.products.length > 0
        ? `产品信息：\n${account.products.map((p) => `  - ${p.name}：${p.description}（卖点：${p.sellingPoints.join("、")}）`).join("\n")}`
        : "",
      account.personas.length > 0
        ? `目标受众：\n${account.personas.map((p) => `  - ${p.name}：${p.description}`).join("\n")}`
        : "",
      account.brandMaterials?.length > 0
        ? `品牌资料：\n${account.brandMaterials.map((m) => `  [${m.purpose}] ${m.extractedText.slice(0, 500)}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const data = await geminiRequest("gemini-2.5-flash", {
      contents: [
        {
          parts: [
            {
              text: `你是一个顶级的${platformName}短视频编导，擅长写出既有流量又有品牌质感的脚本。

## 品牌上下文
${brandContext}

## 选题
标题：${topic.title}
角度：${topic.angle}
概要：${topic.description}

## 任务
请为这个选题写一份完整的${platformName}短视频脚本，包含分镜表。

要求：
1. 视频时长控制在 30~60 秒
2. 开头 3 秒必须有强 hook，抓住观众注意力
3. 中间内容要有节奏感，每 5~8 秒一个信息点
4. 结尾有明确的 CTA（关注/点赞/评论引导）
5. 语言要口语化，符合${platformName}平台风格和品牌调性
6. 如果能自然融入产品就融入，但不要硬广
7. 标注适合的背景音乐风格

请以 JSON 格式返回（只返回 JSON，不要其他文字）：

{
  "title": "视频标题（发布时用的标题）",
  "hashtags": ["话题标签1", "话题标签2"],
  "totalDuration": "总时长，如 45秒",
  "musicStyle": "建议的背景音乐风格",
  "hook": "开头3秒的 hook 文案",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": "时长，如 3秒",
      "visual": "画面描述（镜头角度、场景、动作）",
      "audio": "声音描述（旁白/口播/音效/音乐）",
      "text": "字幕/口播文案（逐字稿）"
    }
  ],
  "fullText": "完整的口播逐字稿（所有 text 串起来的完整版本）",
  "notes": "导演备注（拍摄建议、注意事项等）"
}`,
            },
          ],
        },
      ],
    });

    const text = extractTextFromResponse(data);

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const scriptData = JSON.parse(jsonMatch[0]);
        const script = {
          id: `script_${Date.now()}`,
          topicId: topic.id,
          ...scriptData,
          createdAt: new Date().toISOString(),
        };
        return NextResponse.json({ success: true, script });
      }
    } catch {
      // Fall through
    }

    return NextResponse.json({ success: true, script: null, raw: text });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
