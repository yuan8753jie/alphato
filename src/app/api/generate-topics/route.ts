import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import type { Account, Trend } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { account, trends } = (await req.json()) as {
      account: Account;
      trends: Trend[];
    };

    const brandContext = [
      `品牌：${account.brand.name}`,
      `行业：${account.brand.industry}`,
      `调性：${account.brand.tone}`,
      account.brand.rules.length > 0
        ? `红线规则：${account.brand.rules.join("；")}`
        : "",
      account.products.length > 0
        ? `产品：\n${account.products.map((p) => `  - ${p.name}：${p.description}（卖点：${p.sellingPoints.join("、")}）`).join("\n")}`
        : "",
      account.personas.length > 0
        ? `目标受众：\n${account.personas.map((p) => `  - ${p.name}：${p.description}`).join("\n")}`
        : "",
      account.brandMaterials?.length > 0
        ? `品牌资料：\n${account.brandMaterials.map((m) => `  [${m.purpose}] ${m.extractedText.slice(0, 300)}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Group trends by category for structured context
    const trendsByCategory: Record<string, Trend[]> = {};
    for (const t of trends) {
      const cat = t.category || "other";
      if (!trendsByCategory[cat]) trendsByCategory[cat] = [];
      trendsByCategory[cat].push(t);
    }

    const trendsText = Object.entries(trendsByCategory)
      .map(([cat, items]) => {
        const catLabel: Record<string, string> = {
          platform_hot: "平台热搜",
          industry_news: "行业动态",
          social_meme: "社交热梗",
          sports_event: "体育赛事",
          entertainment: "综艺/影视",
          holiday_calendar: "节日/节气",
          brand_related: "品牌相关",
          trivia: "冷知识",
          history_today: "历史今天",
        };
        return `### ${catLabel[cat] || cat}\n${items.map((t) => `- ${t.title}：${t.description}（来源：${t.source}）`).join("\n")}`;
      })
      .join("\n\n");

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
              text: `你是一个顶级的${platformName}内容策划专家，擅长为品牌打造既有流量又有品牌质感的内容矩阵。

## 品牌上下文
${brandContext}

## 热点池（按类型分类）
${trendsText}

## 任务
基于以上热点池和品牌上下文，为该品牌的${platformName}账号策划 **8 个内容选题**，严格按以下配比：

- **流量型（traffic）3个**：蹭热点拉曝光，追求播放量和互动量，选题要有话题性和传播力
- **信任型（trust）2个**：输出专业干货，建立品牌可信度，如品类知识、测评科普、行业洞察
- **转化型（conversion）2个**：自然种草带货，突出产品卖点和使用场景，让观众产生购买欲
- **人设型（persona）1个**：展示品牌/团队真实面，拉近与观众的距离，如幕后、日常、互动

要求：
1. 每个选题必须有独特的切入角度，不是热点的简单复述
2. 必须严格遵守品牌调性和红线规则
3. 深入考虑目标受众的具体画像、兴趣和痛点
4. 选题标题要像一个真实的${platformName}爆款标题——短、有力、有悬念或共鸣
5. 产品融入要自然，不能硬广
6. 优先使用热点池中有真实来源的素材

请以 JSON 数组格式返回（只返回 JSON，不要其他文字）：

[
  {
    "title": "选题标题（像真实的${platformName}视频标题）",
    "type": "traffic / trust / conversion / persona",
    "angle": "切入角度（为什么选这个角度，好在哪里）",
    "description": "内容概要（3-5句话，描述这条视频具体怎么做）",
    "relatedTrendIds": ["关联的热点标题1", "关联的热点标题2"],
    "estimatedAppeal": "目标受众为什么会想看这条"
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
          (t: Record<string, unknown>, i: number) => ({
            id: `topic_${Date.now()}_${i}`,
            title: t.title || "",
            type: t.type || "traffic",
            angle: t.angle || "",
            description: t.description || "",
            relatedTrendIds: Array.isArray(t.relatedTrendIds) ? t.relatedTrendIds : [],
            estimatedAppeal: t.estimatedAppeal || "",
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
