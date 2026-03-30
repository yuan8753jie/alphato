import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import type { Account, Topic } from "@/lib/types";

export const maxDuration = 120;

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
    const { account, topics } = (await req.json()) as {
      account: Account;
      topics: Topic[];
    };

    const brandContext = buildBrandContext(account);
    const pName = getPlatformName(account.platform);

    // ============================================================
    // Phase 1: Generate Reviewer Personas
    // ============================================================

    const phase1Data = await geminiRequest("gemini-2.5-flash", {
      contents: [{
        parts: [{
          text: `你是一个用户研究专家。请为"${account.brand.name}"（${account.brand.industry}行业）在${pName}平台上的内容，定义 5~7 个典型目标受众画像。

## 品牌信息
${brandContext}

## 要求
- 这些 Persona 要能代表该品牌在${pName}上的核心受众群体
- 每个 Persona 要有明显差异（年龄、性别、生活阶段、消费习惯不同）
- 包含该品牌的核心用户，也要包含潜在用户
- 品牌方可能提供了参考 Persona，你可以参考但不必照搬，应该基于市场洞察给出更精准的画像

返回 JSON 数组（只返回 JSON）：
[
  {
    "id": "persona_1",
    "name": "昵称（如：大学生小李）",
    "age": 年龄数字,
    "gender": "男/女",
    "city": "城市级别（一线/二线/三线）",
    "occupation": "职业",
    "profile": "一段50字左右的人物简介",
    "douyinHabit": "刷${pName}的习惯（什么时候刷、每次多久、喜欢看什么）",
    "contentPreference": "内容偏好（喜欢什么类型、反感什么类型）",
    "brandAwareness": "对${account.brand.name}品牌的认知程度和态度",
    "purchaseBehavior": "消费决策习惯"
  }
]`,
        }],
      }],
    });

    const phase1Text = extractTextFromResponse(phase1Data);
    let personas: Record<string, unknown>[] = [];
    try {
      const m = phase1Text.match(/\[[\s\S]*\]/);
      if (m) personas = JSON.parse(m[0]);
    } catch { /* ignore */ }

    if (personas.length === 0) {
      return NextResponse.json({ success: false, error: "Persona 生成失败，请重试" });
    }

    // ============================================================
    // Phase 2: Each Persona reviews all topics
    // ============================================================

    const topicsList = topics.map((t, i) =>
      `${i + 1}. [${t.type}] ${t.title}\n   角度：${t.angle}\n   概要：${t.description}`
    ).join("\n\n");

    const personasSummary = personas.map((p) =>
      `- ${p.name}（${p.age}岁${p.gender}，${p.occupation}）：${p.profile}`
    ).join("\n");

    const phase2Data = await geminiRequest("gemini-2.5-flash", {
      contents: [{
        parts: [{
          text: `你现在要扮演以下 ${personas.length} 个真实用户，逐一对 ${topics.length} 条${pName}短视频选题进行评审。

## 审稿人
${personasSummary}

## 待审选题
${topicsList}

## 评审维度（每项1~10分）
- **停留** (stop)：刷到这个标题/封面，你会不会停下来看？
- **完播** (watch)：你会看完整条视频吗？
- **互动** (engage)：你会点赞/评论/收藏/转发吗？
- **转化** (convert)：看完后你会想了解/购买这个产品吗？

## 要求
- 每个审稿人必须从自己的真实视角出发，不同人的评分应该有明显差异
- 每条选题每个审稿人给一句"心里话"（用口语，像真人在说话）
- 打分要诚实，不好的就给低分

返回 JSON（只返回 JSON）：
{
  "reviews": [
    {
      "topicIndex": 1,
      "topicTitle": "选题标题",
      "personaReviews": [
        {
          "personaName": "审稿人名字",
          "stop": 分数,
          "watch": 分数,
          "engage": 分数,
          "convert": 分数,
          "comment": "一句心里话"
        }
      ],
      "averageScore": 所有审稿人所有维度的平均分（保留1位小数）
    }
  ]
}`,
        }],
      }],
    }, 90000);

    const phase2Text = extractTextFromResponse(phase2Data);
    let reviewResult: Record<string, unknown> = {};
    try {
      const m = phase2Text.match(/\{[\s\S]*\}/);
      if (m) reviewResult = JSON.parse(m[0]);
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      personas,
      reviews: reviewResult,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
