import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import { buildBrandContext, getPlatformName } from "@/lib/brand-context";
import type { Account } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { account } = (await req.json()) as { account: Account };
    const brandContext = buildBrandContext(account);
    const pName = getPlatformName(account.platform);

    const data = await geminiRequest("gemini-2.5-flash", {
      contents: [{
        parts: [{
          text: `你是一个资深的用户研究专家，对消费品市场和社交媒体用户行为有深刻理解。

请为"${account.brand.name}"（${account.brand.industry}行业）在${pName}平台上的内容，构建一套目标受众画像。

## 品牌信息
${brandContext}

## 任务

请基于你对以下方面的专业知识，构建 5~7 个有代表性的 Persona：
- ${account.brand.industry}行业的消费者结构和行为特征
- ${account.brand.name}品牌的市场定位和目标人群
- ${pName}平台的用户群体特征和内容消费习惯
- 不同年龄段、性别、生活阶段的消费差异

## 要求
- 先写出你的分析思路（你考虑了哪些维度、为什么选择这些群体）
- 每个 Persona 之间要有明显差异
- 既包含核心用户，也包含有增长潜力的边缘用户
- 品牌方可能提供了参考 Persona，你可以参考但不必照搬

## 返回格式

返回 JSON（只返回 JSON）：
{
  "reasoning": {
    "dimensions": ["构建 Persona 时考虑的维度1", "维度2", "维度3"],
    "logic": "2-3句话说明你的整体思路：为什么选择这些群体，它们如何覆盖品牌在${pName}上的核心受众和潜在受众",
    "coverage": "一句话说明这组 Persona 覆盖了哪些关键人群，遗漏了哪些（如有）"
  },
  "personas": [
    {
      "id": "persona_1",
      "name": "昵称",
      "age": "年龄或年龄段",
      "gender": "男/女/不限",
      "occupation": "职业",
      "profile": "50字人物简介（像真人，不像标签）",
      "contentPreference": "在${pName}上喜欢看什么内容",
      "brandAwareness": "对${account.brand.name}品牌的认知和态度",
      "whyIncluded": "为什么纳入审稿团（这个人代表了什么样的用户群体）"
    }
  ]
}`,
        }],
      }],
    });

    const text = extractTextFromResponse(data);
    let result: Record<string, unknown> = {};
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) result = JSON.parse(m[0]);
    } catch { /* ignore */ }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const personas = (result as any).personas;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const research = (result as any).reasoning;

    if (!personas || personas.length === 0) {
      return NextResponse.json({ success: false, error: "Persona 生成失败" });
    }

    return NextResponse.json({ success: true, personas, research });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
