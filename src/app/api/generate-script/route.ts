import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import { buildBrandContext, getPlatformName } from "@/lib/brand-context";
import type { Account, Topic } from "@/lib/types";

export const maxDuration = 90;

type ScriptVariant = "free-voiceover" | "free-music" | "creative-voiceover" | "creative-music";

const CREATIVE_METHODS = `可用的创造性方法论：
- SCAMPER（替换/组合/夸张/反转）
- 对立碰撞（产品×反差场景/人群/情绪）
- POV 转换（从产品/气泡/冰块的视角）
- 认知失调（第一帧"不对劲"的画面）
- 具身隐喻（用动作表达抽象感受）
- Rule of Three（前两个建预期，第三个打破）
请从中选择最合适的方法论。`;

// ============================================================
// Step 1: Free creative ideation — no format constraints
// ============================================================
function buildIdeationPrompt(
  platformName: string,
  brandContext: string,
  topic: Topic,
  variant: ScriptVariant
): string {
  const isCreative = variant.startsWith("creative");
  const isMusic = variant.endsWith("music");

  const styleHint = isMusic
    ? "这条是纯视觉+音乐节奏驱动的，没有台词，全靠画面和节拍讲故事。"
    : "这条有口播/旁白，台词要像弹幕一样自然、有网感。";

  const creativeHint = isCreative ? `\n\n${CREATIVE_METHODS}` : "";

  return `忘掉一切格式限制。你现在只需要做一件事：

想出一个让人在${platformName}上**划不走**的 15 秒视频创意。

品牌：${brandContext}

选题：${topic.title}
角度：${topic.angle}
概要：${topic.description}

风格：${styleHint}${creativeHint}

请用 100~200 字描述你的创意：
1. 这 15 秒讲了一个什么故事？有什么反转/惊喜/情绪高潮？
2. 开头第一秒观众看到什么？为什么他们会停下来？
3. 什么时刻是情绪爆发点？
4. 结束的瞬间观众会有什么反应？（想分享？笑了？被打动？）

不要写分镜、不要写 JSON、不要写技术参数。就像你在跟同事口头 pitch 一个创意一样，自由地说。`;
}

// ============================================================
// Step 2: Structure the creative concept into production format
// ============================================================
function buildStructurePrompt(
  platformName: string,
  concept: string,
  variant: ScriptVariant
): string {
  const isMusic = variant.endsWith("music");

  const textInstruction = isMusic
    ? `text 字段全部写空字符串（音乐卡点版无台词）`
    : `text 字段写该镜头的中文口播台词（口语化、短句、像弹幕）`;

  return `你是一个视频制作人。下面是创意总监给你的创意概念，请把它精确地拆成可执行的分镜脚本。

## 创意概念
${concept}

## 技术铁律
- 总时长 = 15 秒
- 4~6 个分镜，duration 之和 = 15
- 每个分镜 2~4 秒
- 人物是典型中国年轻人（Chinese young person）
- ${textInstruction}

## visual 字段写法（这个字段会直接发给可灵 AI 生成视频）
用英文写，必须包含：
- 画面主体和动作（Chinese young man/woman, 具体外貌、表情、动作）
- 镜头类型和运动（close-up / wide shot / tracking / slow-mo / quick zoom）
- 光线氛围（warm / cool / neon / natural / dramatic）
- 音乐/音效指令（beat drop / bass hit / ASMR crackle / upbeat pop）

只返回 JSON：
{
  "title": "视频标题（像${platformName}爆款标题）",
  "hashtags": ["标签1", "标签2"],
  "totalDuration": "15",
  "musicStyle": "音乐描述（风格、节奏、情绪变化）",
  "hook": "开头 hook",
  "creativeApproach": "这条视频的创意核心是什么（一句话）",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": "3",
      "visual": "可灵提示词（英文）",
      "audio": "音频层",
      "text": "${isMusic ? "" : "台词"}",
      "transition": "转场"
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

    // ===== Step 1: Free creative ideation =====
    const ideationPrompt = buildIdeationPrompt(platformName, brandContext, topic, variant);
    const ideationData = await geminiRequest("gemini-2.5-flash", {
      contents: [{ parts: [{ text: ideationPrompt }] }],
    });
    const concept = extractTextFromResponse(ideationData);

    if (!concept) {
      return NextResponse.json({ success: false, error: "创意构思失败" });
    }

    // ===== Step 2: Structure into production format =====
    const structurePrompt = buildStructurePrompt(platformName, concept, variant);
    const structureData = await geminiRequest("gemini-2.5-flash", {
      contents: [{ parts: [{ text: structurePrompt }] }],
    });
    const structureText = extractTextFromResponse(structureData);

    try {
      const jsonMatch = structureText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const scriptData = JSON.parse(jsonMatch[0]);
        const script = {
          id: `script_${variant}_${Date.now()}`,
          topicId: topic.id,
          variant,
          concept, // Store the raw creative concept for transparency
          ...scriptData,
          createdAt: new Date().toISOString(),
        };
        return NextResponse.json({ success: true, script });
      }
    } catch { /* ignore */ }

    return NextResponse.json({ success: false, error: "脚本结构化失败", raw: structureText });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
