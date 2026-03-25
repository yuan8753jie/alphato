import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import type { Account } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { account, trends } = (await req.json()) as {
      account: Account;
      trends: { title: string; description: string }[];
    };

    const brandContext = [
      `品牌：${account.brand.name}`,
      `行业：${account.brand.industry}`,
      `调性：${account.brand.tone}`,
      account.brand.rules.length > 0
        ? `红线规则：${account.brand.rules.join("；")}`
        : "",
      account.products.length > 0
        ? `产品：${account.products.map((p) => `${p.name}（${p.sellingPoints.join("、")}）`).join("；")}`
        : "",
      account.personas.length > 0
        ? `目标受众：${account.personas.map((p) => `${p.name} - ${p.description}`).join("；")}`
        : "",
      // Include brand materials as context
      account.brandMaterials?.length > 0
        ? `品牌资料摘要：\n${account.brandMaterials.map((m) => `[${m.purpose}] ${m.extractedText}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const trendsText = trends
      .map((t, i) => `${i + 1}. ${t.title}：${t.description}`)
      .join("\n");

    const platformName = {
      douyin: "抖音", tiktok: "TikTok", xiaohongshu: "小红书",
      instagram: "Instagram", kuaishou: "快手", wechat: "微信视频号",
      youtube: "YouTube", bilibili: "Bilibili",
    }[account.platform] || "抖音";

    const data = await geminiRequest("gemini-2.5-flash", {
      contents: [
        {
          parts: [
            {
              text: `你是一个顶级的${platformName}内容策划专家，擅长为品牌找到既有流量又符合品牌调性的选题角度。

## 品牌上下文
${brandContext}

## 今日热点
${trendsText}

## 任务
请基于以上热点和品牌上下文，为该品牌的${platformName}账号生成 5~8 个内容选题。

要求：
1. 每个选题要有独特的切入角度，不能是热点的简单复述
2. 要符合品牌调性和红线规则
3. 要考虑目标受众的兴趣和痛点
4. 选题要有${platformName}平台的内容特色（短视频思维、强开头、有记忆点）
5. 如果能自然融入产品就融入，但不要硬广

请以 JSON 数组格式返回（只返回 JSON，不要其他文字）：

[
  {
    "title": "选题标题（简洁有力，像一条短视频的标题）",
    "angle": "切入角度说明（为什么这个角度好）",
    "description": "内容概要（3-5句话描述这条内容大概怎么做）",
    "relatedTrend": "关联的热点标题",
    "estimatedAppeal": "预估吸引力说明（为什么目标受众会想看）"
  }
]`,
            },
          ],
        },
      ],
    });

    const text = extractTextFromResponse(data);

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const topics = JSON.parse(jsonMatch[0]).map(
          (t: Record<string, string>, i: number) => ({
            id: `topic_${Date.now()}_${i}`,
            title: t.title,
            angle: t.angle,
            description: t.description,
            relatedTrend: t.relatedTrend,
            estimatedAppeal: t.estimatedAppeal,
            status: "pending",
            createdAt: new Date().toISOString(),
          })
        );
        return NextResponse.json({ success: true, topics });
      }
    } catch {
      // Fall through
    }

    return NextResponse.json({ success: true, topics: [], raw: text });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
