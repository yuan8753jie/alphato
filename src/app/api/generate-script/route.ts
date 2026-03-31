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
              text: `你是一个顶级的${platformName}短视频编导，同时精通可灵（Kling）AI 视频生成工具。

## 品牌上下文
${brandContext}

## 选题
标题：${topic.title}
类型：${topic.type}
角度：${topic.angle}
概要：${topic.description}

## 任务
为这个选题写一份 15 秒短视频脚本，要有创意、有节奏感、有记忆点。

## 创意要求（最重要）
- 不要写平铺直叙的广告，要有**反转、对比、悬念、或情绪爆发点**
- 参考${platformName}上的爆款视频套路：先制造冲突/好奇，再给出答案
- 每条视频要有一个让人忍不住看完的"钩子"
- 节奏要快慢交替，不要每个镜头都一样长——有的 2 秒快切，有的 4 秒停留

## 视频生成技术限制（必须严格遵守）
- 总时长严格 15 秒
- 4~6 个分镜，所有 duration 之和 = 15
- 每个分镜 2~4 秒（允许快切）
- 人物必须是**典型的中国年轻人**（Chinese young person, East Asian features）
- 每个分镜的 visual 会被直接发送给可灵 AI 生成视频
- 每个分镜的 text 会作为该镜头的台词/旁白由 AI 朗读

## visual 字段写法（可灵提示词）
每个 visual 必须包含：
1. 画面主体和动作（用英文写，具体描述人物外观、表情、动作）
2. 必须写明 "Chinese young man/woman"
3. 镜头类型和运动（close-up, medium shot, tracking shot 等）
4. 光线和色调
5. 节奏感描述（dynamic, energetic, slow motion 等）
6. 音乐/音效指令（如 "upbeat pop music", "sound of bottle opening"）

## text 字段写法（台词）
- 每个镜头的 text 是该镜头的口播台词
- 台词由 AI 朗读，所以要自然、口语化、简短有力
- 如果某个镜头不需要台词（如纯画面+音效），text 写空字符串

返回 JSON（只返回 JSON）：

{
  "title": "视频标题",
  "hashtags": ["标签1", "标签2"],
  "totalDuration": "15",
  "musicStyle": "音乐风格（如：节奏感强的电子流行、轻快吉他、紧张悬疑感等）",
  "hook": "开头 hook",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": "3",
      "visual": "可灵视频生成提示词（英文为主，详细描述画面+镜头+动作+光线+音乐音效）",
      "audio": "音频描述",
      "text": "这个镜头的台词（中文，口语化）或空字符串",
      "transition": "转场方式"
    }
  ],
  "fullText": "完整台词稿",
  "notes": "导演备注"
}

duration 只写数字。所有 duration 之和必须 = 15。`,
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
