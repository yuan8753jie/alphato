import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import type { Account } from "@/lib/types";

export const maxDuration = 60;

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
          text: `你是一个用户研究专家。请为"${account.brand.name}"（${account.brand.industry}行业）在${pName}平台上的内容，定义 5~7 个典型目标受众画像。

## 品牌信息
${brandContext}

## 要求
- 这些 Persona 要能代表该品牌在${pName}上的核心受众群体
- 每个 Persona 要有明显差异（年龄、性别、生活阶段、消费习惯不同）
- 包含核心用户和潜在用户
- 品牌方可能提供了参考 Persona，你可以参考但不必照搬

返回 JSON 数组（只返回 JSON）：
[
  {
    "id": "persona_1",
    "name": "昵称",
    "age": 年龄,
    "gender": "男/女",
    "occupation": "职业",
    "profile": "50字人物简介",
    "contentPreference": "内容偏好",
    "brandAwareness": "对品牌的认知"
  }
]`,
        }],
      }],
    });

    const text = extractTextFromResponse(data);
    let personas: Record<string, unknown>[] = [];
    try {
      const m = text.match(/\[[\s\S]*\]/);
      if (m) personas = JSON.parse(m[0]);
    } catch { /* ignore */ }

    if (personas.length === 0) {
      return NextResponse.json({ success: false, error: "Persona 生成失败" });
    }

    return NextResponse.json({ success: true, personas });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
