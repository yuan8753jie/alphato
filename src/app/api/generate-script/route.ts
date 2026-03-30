import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import { buildBrandContext, getPlatformName } from "@/lib/brand-context";
import type { Account, Topic } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { account, topic } = (await req.json()) as {
      account: Account;
      topic: Topic;
    };

    const platformName = getPlatformName(account.platform);
    const brandContext = buildBrandContext(account);

    const data = await geminiRequest("gemini-2.5-flash", {
      contents: [
        {
          parts: [
            {
              text: `你是一个顶级的${platformName}短视频编导，同时精通 AI 视频生成工具。

## 品牌上下文
${brandContext}

## 选题
标题：${topic.title}
类型：${topic.type}
角度：${topic.angle}
概要：${topic.description}

## 任务
为这个选题写一份完整的${platformName}短视频脚本，包含分镜表。

重要：每个分镜的 visual 字段要写成**可直接用于 AI 视频生成的提示词**，需要包含：
- 具体的画面内容（人物/物体/场景）
- 镜头类型（特写/中景/远景/俯拍/跟拍等）
- 运动方式（推/拉/摇/移/固定等）
- 光线和色调（明亮/暖色/冷色/自然光等）
- 风格关键词（如：电影质感、vlog风格、动感剪辑等）

脚本要求：
1. 视频时长 30~60 秒
2. 开头 3 秒有强 hook，抓住注意力
3. 每 5~8 秒一个信息点，节奏感强
4. 结尾有 CTA（关注/点赞/评论引导）
5. 语言口语化，符合${platformName}风格
6. 产品融入自然，不要硬广
7. 标注背景音乐风格和节奏

返回 JSON（只返回 JSON）：

{
  "title": "视频标题（发布时用的标题）",
  "hashtags": ["话题标签1", "话题标签2"],
  "totalDuration": "总时长，如 45秒",
  "musicStyle": "背景音乐风格和节奏描述",
  "hook": "开头3秒的 hook 文案",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": "时长，如 3秒",
      "visual": "AI 视频生成提示词（英文+中文混合，详细描述画面、镜头、运动、光线、风格）",
      "audio": "声音描述（旁白/口播/音效/音乐变化）",
      "text": "字幕/口播文案（逐字稿）",
      "transition": "转场方式（如：硬切/淡入淡出/闪白/滑动等）"
    }
  ],
  "fullText": "完整口播逐字稿",
  "notes": "导演备注（拍摄/生成建议、注意事项）"
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
