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
              text: `你是${platformName}上最炙手可热的创意总监——你的作品总是让人"划不走"。你同时精通可灵（Kling）AI 视频生成。

你不做广告，你做的是**15 秒的微电影**。每一条都是一个完整的故事弧，有起承转合，有情绪高潮，有让人想分享的瞬间。

## 品牌
${brandContext}

## 选题
${topic.title}
角度：${topic.angle}
概要：${topic.description}

## 你的创作哲学

**结构即节奏。** 15 秒不是限制，是纪律。像一首好歌——前奏抓耳、副歌炸裂、结尾余韵。

**爆款公式（任选一种或混搭）：**
- 🔄 反转型：前 10 秒建立预期，最后 5 秒打破它（"你以为是A，其实是B"）
- 😱 悬念型：开头抛出不合理的画面/问题，最后揭晓答案
- 📈 递进型：同一个动作重复升级，越来越夸张，最后爆发
- 💥 对比型：before/after，丑/美，崩溃/满血，形成强烈视觉反差
- 🎭 沉浸型：ASMR / POV / 一镜到底，让观众"进入"画面

**台词要像弹幕：** 不要书面语，要像你对面坐着一个朋友在跟你吐槽。可以用网络热词、表情化的语气词（"绝了"、"救命"、"这谁顶得住"）。

**节奏快慢交替：** 紧张的镜头 2 秒快切，高光时刻 4 秒停留让情绪渗透。

## 技术限制（铁律）
- 总时长 = 15 秒
- 4~6 个分镜，duration 之和 = 15
- 每个分镜 2~4 秒
- 人物是典型中国年轻人

## visual 字段（可灵 AI 提示词）
用英文写，必须包含：
- 人物描述（Chinese young man/woman, 具体外貌特征、表情、穿着）
- 画面构图和镜头运动（close-up / wide shot / tracking / slow-mo / quick zoom）
- 光线氛围（warm golden hour / cool neon / harsh overhead / soft diffused）
- 画面情绪（chaotic / serene / explosive / intimate）
- 音效/音乐指令（upbeat drop / silence then bass hit / ASMR crackle）

## text 字段（台词）
- 中文口语，像真人在说话
- 短句为王，一个镜头最多一句话
- 不需要台词的镜头写空字符串（让画面和音效说话）

返回 JSON（只返回 JSON）：
{
  "title": "标题（像${platformName}爆款标题，有悬念/反差/共鸣）",
  "hashtags": ["标签1", "标签2", "标签3"],
  "totalDuration": "15",
  "musicStyle": "具体的音乐描述（节奏BPM、风格、情绪变化，如'开头低沉电子氛围→中段节奏加速→结尾bass drop炸裂'）",
  "hook": "开头 hook（让人停下来的第一句话或第一个画面）",
  "creativeApproach": "这条视频用了什么创意手法（反转/悬念/递进/对比/沉浸），为什么选这个",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": "3",
      "visual": "可灵提示词（英文，画面+镜头+光线+情绪+音效）",
      "audio": "音频层描述",
      "text": "台词或空字符串",
      "transition": "转场（hard cut / flash / whip pan / match cut）"
    }
  ],
  "fullText": "完整台词",
  "notes": "导演备注"
}

duration 只写数字，之和 = 15。`,
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
