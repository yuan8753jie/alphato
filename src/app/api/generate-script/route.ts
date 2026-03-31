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

技术限制（必须严格遵守）：
- 总时长严格 15 秒
- 最多 6 个分镜，最少 3 个
- 每个分镜 2~5 秒，所有分镜时长之和 = 15 秒
- 每个分镜的 visual 是一个独立的 AI 视频生成镜头

脚本要求：
1. 开头第一个镜头必须有强 hook，2~3 秒内抓住注意力
2. 每个镜头只传递一个核心信息，不要塞太多内容
3. 最后一个镜头放 CTA 或品牌收尾
4. 语言口语化，符合${platformName}风格
5. 产品融入自然，不要硬广
6. 节奏紧凑，15 秒内讲完一个完整的故事

返回 JSON（只返回 JSON）：

{
  "title": "视频标题（发布时用的标题）",
  "hashtags": ["话题标签1", "话题标签2"],
  "totalDuration": "15",
  "musicStyle": "背景音乐风格和节奏描述",
  "hook": "开头 hook 文案",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": "3",
      "visual": "AI 视频生成提示词（详细描述画面内容、镜头类型、运动方式、光线色调、风格）",
      "audio": "声音描述（旁白/口播/音效/音乐）",
      "text": "字幕/口播文案",
      "transition": "转场方式"
    }
  ],
  "fullText": "完整口播逐字稿（15秒内能说完）",
  "notes": "导演备注"
}

重要：scenes 数组的所有 duration 数字之和必须等于 15。duration 只写数字不写单位。`,
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
