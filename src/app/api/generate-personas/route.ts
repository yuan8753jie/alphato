import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import type { Account } from "@/lib/types";

export const maxDuration = 90;

function buildBrandContext(account: Account): string {
  return [
    `品牌：${account.brand.name}`,
    `行业：${account.brand.industry}`,
    `调性：${account.brand.tone}`,
    account.products.length > 0
      ? `产品：${account.products.map((p) => `${p.name}（${p.sellingPoints.join("、")}）`).join("；")}`
      : "",
    account.personas.length > 0
      ? `品牌方定义的目标受众（仅供参考）：\n${account.personas.map((p) => `  - ${p.name}：${p.description}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n");
}

function getPlatformName(platform: string): string {
  return ({
    douyin: "抖音", tiktok: "TikTok", xiaohongshu: "小红书",
    instagram: "Instagram", kuaishou: "快手", wechat: "微信视频号",
    youtube: "YouTube", bilibili: "Bilibili",
  } as Record<string, string>)[platform] || "抖音";
}

export async function POST(req: NextRequest) {
  try {
    const { account } = (await req.json()) as { account: Account };
    const brandContext = buildBrandContext(account);
    const pName = getPlatformName(account.platform);

    const data = await geminiRequest("gemini-2.5-flash", {
      contents: [{
        parts: [{
          text: `你是一个用户研究专家。请为"${account.brand.name}"（${account.brand.industry}行业）在${pName}平台上的内容，构建一套目标受众画像。

## 品牌信息
${brandContext}

## 任务

请先搜索以下信息作为 Persona 构建的依据：
1. 搜索"${account.brand.name} 目标消费者"或"${account.brand.name} 用户画像"
2. 搜索"${account.brand.industry} 消费人群特征"
3. 搜索"${pName} 用户画像 年龄分布"

然后基于搜索到的真实数据，构建 5~7 个有代表性的 Persona。

## 返回格式

返回 JSON（只返回 JSON）：
{
  "research": {
    "sources": ["参考的数据来源1", "参考的数据来源2"],
    "keyFindings": [
      "关键发现1：如'该品牌核心消费者年龄集中在18-35岁'",
      "关键发现2：如'抖音用户中女性占比55%'",
      "关键发现3"
    ],
    "methodology": "一段话说明你是如何基于这些数据构建 Persona 的（如'基于XX数据，我选择了以下6个代表性群体来覆盖核心用户和潜在用户'）"
  },
  "personas": [
    {
      "id": "persona_1",
      "name": "昵称（如：麻辣小当家）",
      "age": 年龄或年龄段如"18-25",
      "gender": "男/女/不限",
      "occupation": "职业",
      "profile": "50字人物简介（写得像真人，不要像标签）",
      "contentPreference": "在${pName}上喜欢看什么内容",
      "brandAwareness": "对${account.brand.name}品牌的认知和态度",
      "whyIncluded": "为什么要把这个人纳入审稿团（一句话）"
    }
  ]
}`,
        }],
      }],
      tools: [{ googleSearch: {} }],
    }, 60000);

    const text = extractTextFromResponse(data);
    let result: Record<string, unknown> = {};
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) result = JSON.parse(m[0]);
    } catch { /* ignore */ }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const personas = (result as any).personas;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const research = (result as any).research;

    if (!personas || personas.length === 0) {
      return NextResponse.json({ success: false, error: "Persona 生成失败" });
    }

    return NextResponse.json({ success: true, personas, research });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
