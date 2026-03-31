import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import { buildBrandContext, getPlatformName } from "@/lib/brand-context";
import type { Account, Topic } from "@/lib/types";

export const maxDuration = 60;

type ScriptVariant = "free-voiceover" | "free-music" | "creative-voiceover" | "creative-music";

const CREATIVE_METHODS = `
## 创造性思维方法论（从中选择最合适的 1~2 种使用）

**SCAMPER 变形：**
- 替换：把产品放进一个完全不属于它的场景
- 组合：把产品和一个毫不相关的事物混搭
- 夸张：把产品的某个特征放大 100 倍
- 反转：倒过来讲故事，或者从结局开始

**对立碰撞：** 把产品放在反差极大的场景/人群/情绪中，产生化学反应

**POV 转换：** 从产品/气泡/冰块/瓶盖的视角讲故事

**认知失调：** 第一帧就给一个"不对劲"的画面让人停下来

**具身隐喻：** 用身体动作/物理现象来表达抽象感受（如灵魂出窍=缺水，回魂=喝到饮料）

**Rule of Three：** 前两个建立模式，第三个打破预期

你必须在 creativeApproach 字段里写明你用了哪个方法论、怎么用的。`;

function buildPrompt(
  platformName: string,
  brandContext: string,
  topic: Topic,
  variant: ScriptVariant
): string {
  const isCreative = variant.startsWith("creative");
  const isMusic = variant.endsWith("music");

  const roleDesc = isCreative
    ? `你是${platformName}上最天马行空的创意鬼才——你的视频总是让人看完说"什么鬼，但我好喜欢"。你不走寻常路，你用创造性思维方法论来产出让人意想不到的内容。`
    : `你是${platformName}上最炙手可热的创意总监——你的作品总是让人"划不走"。你擅长用简洁有力的方式讲好一个 15 秒的故事。`;

  const styleDesc = isMusic
    ? `**音乐卡点风格：** 这条视频以音乐节奏为核心驱动力。
- 不需要口播台词，全靠画面+音乐+音效讲故事
- 每个镜头的切换要精准卡在音乐的节拍上（beat drop、鼓点、bass）
- text 字段全部写空字符串
- visual 里必须详细描述音乐节奏变化（如"bass drop时画面切换"、"鼓点渐强"）
- 追求视觉冲击力和节奏感，像 MV 一样`
    : `**口播风格：** 这条视频有角色说话/旁白。
- 台词要像弹幕一样自然——不要书面语，要像朋友吐槽
- 可以用网络热词（"绝了"、"救命"、"这谁顶得住"、"DNA动了"）
- 每个镜头的 text 字段写该镜头的台词，短句为王
- 台词和画面要配合，不要画面和话对不上`;

  const creativeBlock = isCreative ? CREATIVE_METHODS : "";

  return `${roleDesc}

## 品牌
${brandContext}

## 选题
${topic.title}
角度：${topic.angle}
概要：${topic.description}

${creativeBlock}

## 风格定义
${styleDesc}

## 结构节奏
15 秒不是限制，是纪律。像一首好歌——前奏抓耳、副歌炸裂、结尾余韵。
- 节奏要快慢交替：紧张的 2 秒快切，高光 4 秒停留
- 必须有一个情绪爆发点/高潮时刻
- 结尾要有记忆点（不一定是 CTA，可以是金句/反转/画面定格）

## 技术铁律
- 总时长 = 15 秒，4~6 分镜，duration 之和 = 15
- 每个分镜 2~4 秒
- 人物是典型中国年轻人
- visual 用英文写可灵 AI 提示词（画面+镜头+光线+情绪+音效音乐）

返回 JSON（只返回 JSON）：
{
  "title": "标题",
  "hashtags": ["标签1", "标签2"],
  "totalDuration": "15",
  "musicStyle": "音乐描述（节奏、BPM、情绪变化）",
  "hook": "开头 hook",
  "creativeApproach": "用了什么创意手法/方法论，为什么",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": "3",
      "visual": "可灵提示词（英文）",
      "audio": "音频层描述",
      "text": "${isMusic ? "" : "台词（中文口语）"}",
      "transition": "转场方式"
    }
  ],
  "fullText": "${isMusic ? "（音乐卡点版，无口播）" : "完整台词"}",
  "notes": "导演备注"
}

duration 只写数字，之和 = 15。`;
}

export async function POST(req: NextRequest) {
  try {
    const { account, topic, variant = "free-voiceover" } = (await req.json()) as {
      account: Account;
      topic: Topic;
      variant?: ScriptVariant;
    };

    const platformName = getPlatformName(account.platform);
    const brandContext = buildBrandContext(account);
    const prompt = buildPrompt(platformName, brandContext, topic, variant);

    const data = await geminiRequest("gemini-2.5-flash", {
      contents: [{ parts: [{ text: prompt }] }],
    });

    const text = extractTextFromResponse(data);

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const scriptData = JSON.parse(jsonMatch[0]);
        const script = {
          id: `script_${variant}_${Date.now()}`,
          topicId: topic.id,
          variant,
          ...scriptData,
          createdAt: new Date().toISOString(),
        };
        return NextResponse.json({ success: true, script });
      }
    } catch { /* ignore */ }

    return NextResponse.json({ success: true, script: null, raw: text });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
