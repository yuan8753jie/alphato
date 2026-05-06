import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import { buildBrandContext, getPlatformName } from "@/lib/brand-context";
import type { Account, Topic } from "@/lib/types";

export const maxDuration = 120;

const CREATIVE_METHODS = `可用的创造性思维方法论：
- 强制关联法：把产品和完全不相关的事物强行建立联系
- 逆向思维法：从结果倒推、或反着来讲故事
- 降维打击法：用高维度的视角看低维度的事情
- 跨界平移法：把其他领域的爆款套路搬过来
- SCAMPER（替换/组合/夸张/反转）
- POV 转换（从产品/气泡/冰块的视角）
- 认知失调（第一帧"不对劲"的画面）
- Rule of Three（前两个建预期，第三个打破）`;

// Seedance 2.0 spec: total 4-15s, free scene count, native lip-sync + audio.
// Don't over-constrain — let the LLM decide structure based on content needs.
const SEEDANCE_TECHNICAL_RULES = `## 技术说明（Seedance 2.0）
- 总时长：Seedance 2.0 支持 4~15 秒，按叙事节奏自己定（推荐 10~12 秒）
- 分镜数：Seedance 2.0 单 prompt 可以串联多分镜，按内容需要自由决定（一般 5~8 个，叙事丰富时更多也可以）
- 每分镜 duration 自己分配，总和在 4~15 之间即可
- 人物是典型中国年轻人（Chinese young person）
- Seedance 2.0 原生支持 lip-sync 和音频合成，voice_over 和 sfx 会被自动发声`;

const SEEDANCE_VISUAL_INSTRUCTION = `visual：中文画面描述，按"主体 + 动作 + 场景 + 光影 + 氛围"自由组织，写出电影感细节。所有分镜会串成一个大 prompt 交给 Seedance，**让画面细节饱满而不啰嗦**即可。
- 禁止否定词（不要 / 避免 / 没有）：Seedance 不支持 negative prompt，改用正面描述（如"保持画面稳定"）`;

function buildIdeationPrompt(
  platformName: string,
  brandContext: string,
  topic: Topic
): string {
  return `忘掉一切格式限制。你现在只需要做一件事：

想出 4 个让人在${platformName}上**划不走**的 12 秒视频创意。

品牌：${brandContext}

选题：${topic.title}
角度：${topic.angle}
概要：${topic.description}

目标视频模型：Seedance 2.0（5~8 分镜 / 总 10~12 秒）

4 个创意分别是：
1. **稳健常规版（带口播）**：符合直觉逻辑，有中文旁白/口播，追求"情理之中，意料之外"
2. **稳健常规版（纯音乐）**：符合直觉逻辑，无口播，全靠画面+音乐+音效讲故事
3. **极致创意版（带口播）**：运用创造性思维方法论，有中文旁白，出其不意
4. **极致创意版（纯音乐）**：运用创造性思维方法论，无口播，纯视觉和音效震撼

${CREATIVE_METHODS}

核心准则：极强的"网感"，追求"情理之中，意料之外"。

对每个创意，用 50~100 字描述：
- 这 12 秒讲了什么故事？有什么反转/惊喜？
- 开头第一秒观众看到什么？为什么停下来？
- 情绪爆发点在哪里？
- 如果是创意版，用了什么思维方法论？

自由地说，不要 JSON，像跟同事 pitch 创意一样。`;
}

function buildStructurePrompt(
  platformName: string,
  concepts: string
): string {
  return `你是一个视频制作人。下面是创意总监给你的 4 个创意概念，请把它们精确地拆成 4 个可执行的分镜脚本。

目标视频模型：**Seedance 2.0（豆包）**

## 创意概念
${concepts}

${SEEDANCE_TECHNICAL_RULES}

## 分镜写法
每个 shot 需要：
- shot_type: 镜头类型（如：极致特写、全景、低角度、跟拍、POV主观镜头 等）
- ${SEEDANCE_VISUAL_INSTRUCTION}
- voice_over: 中文口播内容（无口播版留空字符串）
- sfx: 中文音效/音乐描述
- duration: 秒数（纯数字）

## 4 个变体的分类
1. variation_id=1, label="稳健常规版（口播）", has_vo=true, is_creative=false
2. variation_id=2, label="稳健常规版（音乐）", has_vo=false, is_creative=false
3. variation_id=3, label="极致创意版（口播）", has_vo=true, is_creative=true
4. variation_id=4, label="极致创意版（音乐）", has_vo=false, is_creative=true

输出严格的 JSON 数组，包含 4 个变体对象。每个对象结构：
{
  "variation_id": 1,
  "label": "稳健常规版（口播）",
  "is_creative": false,
  "has_vo": true,
  "creative_method": "如果是创意版，写用了什么方法论",
  "title": "视频标题（像${platformName}爆款标题）",
  "hook": "开头 hook",
  "creative_approach": "创意核心（一句话）",
  "music_style": "音乐描述",
  "hashtags": ["标签1", "标签2"],
  "shots": [
    {
      "shot_id": 1,
      "shot_type": "极致特写",
      "visual": "按上述规则写的画面描述",
      "voice_over": "中文口播（无口播留空字符串）",
      "sfx": "中文音效/音乐描述",
      "duration": "3"
    }
  ],
  "full_text": "完整口播稿（无口播版写'纯音乐卡点版'）",
  "notes": "导演备注"
}

所有 duration 之和在 4~15 秒之间（推荐 10~12 秒），按叙事节奏自由分配。分镜数按内容需要自由决定，一般 5~8 个为佳，叙事丰富时更多也可以。只返回 JSON 数组。`;
}

export async function POST(req: NextRequest) {
  try {
    const { account, topic } = (await req.json()) as {
      account: Account;
      topic: Topic;
    };

    const platformName = getPlatformName(account.platform);
    const brandContext = buildBrandContext(account);

    // ===== Step 1: Free creative ideation =====
    const ideationData = await geminiRequest("gemini-2.5-flash", {
      contents: [{ parts: [{ text: buildIdeationPrompt(platformName, brandContext, topic) }] }],
    });
    const concepts = extractTextFromResponse(ideationData);

    if (!concepts) {
      return NextResponse.json({ success: false, error: "创意构思失败" });
    }

    // ===== Step 2: Structure all 4 variants in ONE call =====
    const structureData = await geminiRequest("gemini-2.5-flash", {
      contents: [{ parts: [{ text: buildStructurePrompt(platformName, concepts) }] }],
    }, 120000);
    const structureText = extractTextFromResponse(structureData);

    try {
      const jsonMatch = structureText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const variations = JSON.parse(jsonMatch[0]) as any[];

        const scripts = variations.map((v) => {
          const shots = (v.shots || []) as Record<string, unknown>[];
          const sumDuration = shots.reduce((sum, s) => {
            const d = Number(String(s.duration || "0").replace(/[^0-9]/g, "")) || 0;
            return sum + d;
          }, 0) || 12;
          return {
            id: `script_v${v.variation_id}_${Date.now()}`,
            topicId: topic.id,
            variant: v.variation_id === 1 ? "free-voiceover"
              : v.variation_id === 2 ? "free-music"
              : v.variation_id === 3 ? "creative-voiceover"
              : "creative-music",
            label: v.label,
            isCreative: v.is_creative,
            hasVo: v.has_vo,
            creativeMethod: v.creative_method || "",
            title: v.title,
            hook: v.hook,
            creativeApproach: v.creative_approach || "",
            musicStyle: v.music_style,
            hashtags: v.hashtags || [],
            totalDuration: String(sumDuration),
            scenes: shots.map((s: Record<string, unknown>) => ({
              sceneNumber: s.shot_id,
              shotType: s.shot_type,
              visual: s.visual,
              audio: s.sfx,
              text: s.voice_over || "",
              duration: s.duration,
              transition: "",
            })),
            fullText: v.full_text || "",
            notes: v.notes || "",
            concept: concepts,
            createdAt: new Date().toISOString(),
          };
        });

        return NextResponse.json({ success: true, scripts });
      }
    } catch { /* ignore */ }

    return NextResponse.json({ success: false, error: "脚本结构化失败", raw: structureText });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
