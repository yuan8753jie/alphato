import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import { buildBrandContext, getPlatformName } from "@/lib/brand-context";
import type { Account, Trend } from "@/lib/types";

export const maxDuration = 120;

function formatTrendList(trends: Trend[]): string {
  return trends.map((t, i) =>
    `${i + 1}. [${t.category}] ${t.title}：${t.description}（来源：${t.source}）`
  ).join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const { account, trends, focusProductId } = (await req.json()) as {
      account: Account;
      trends: Trend[];
      focusProductId?: string;
    };

    const focusProduct = focusProductId
      ? account.products.find((p) => p.id === focusProductId)
      : null;

    const brandContext = buildBrandContext(account, focusProduct?.id);
    const pName = getPlatformName(account.platform);

    // 给 LLM 看到的产品名→后端按名字映射回 id
    const productNameList = account.products.map((p) => p.name).filter(Boolean);
    const productIdByName = new Map(account.products.map((p) => [p.name, p.id]));

    // ============================================================
    // Phase 1: Trend Relevance Analysis — select the best 15~20
    // ============================================================

    const phase1Data = await geminiRequest("gemini-2.5-flash", {
      contents: [{
        parts: [{
          text: `你是"${account.brand.name}"品牌的${pName}内容总监。

## 你的品牌
${brandContext}

## 候选热点池（共${trends.length}条）
${formatTrendList(trends)}

## 任务
从以上${trends.length}条热点中，精选 15~20 条最适合"${account.brand.name}"做${pName}内容的热点。

选择标准：
1. 与品牌行业（${account.brand.industry}）的关联度
2. 与目标受众兴趣/痛点的匹配度
3. 能否自然融入品牌产品
4. 热点的时效性和传播潜力
5. 是否符合品牌调性（不违反红线规则）

返回 JSON 数组（只返回 JSON，不要其他文字）：
[
  {
    "originalIndex": 原始编号（1开始）,
    "title": "热点标题",
    "relevanceScore": 1到10的品牌相关度评分,
    "reason": "一句话说明为什么选这条（跟品牌/产品/受众的具体关联）"
  }
]

按 relevanceScore 从高到低排序。`,
        }],
      }],
    });

    const phase1Text = extractTextFromResponse(phase1Data);
    let selectedTrends: { originalIndex: number; title: string; relevanceScore: number; reason: string }[] = [];

    try {
      const m = phase1Text.match(/\[[\s\S]*\]/);
      if (m) selectedTrends = JSON.parse(m[0]);
    } catch { /* ignore */ }

    if (selectedTrends.length === 0) {
      return NextResponse.json({ success: false, error: "热点筛选失败，请重试" });
    }

    // Build the selected trends text for Phase 2
    const selectedTrendsText = selectedTrends.map((s, i) => {
      const original = trends[s.originalIndex - 1];
      const desc = original?.description || "";
      return `${i + 1}. ${s.title}（相关度：${s.relevanceScore}/10）\n   ${desc}\n   选择理由：${s.reason}`;
    }).join("\n\n");

    // ============================================================
    // Phase 2: Topic Generation — create topics from selected trends
    // ============================================================

    // 产品绑定指令：focus 状态下强制绑定单产品；否则让 LLM 按选题内容自己挑
    const productBindingInstruction = focusProduct
      ? `## 产品绑定（必须遵守）
本批选题全部围绕 **${focusProduct.name}** 这一款产品。每个选题的 \`productNames\` 字段必须严格设为：["${focusProduct.name}"]。
不要写其他产品。`
      : productNameList.length > 0
        ? `## 产品绑定
品牌有以下产品：${productNameList.join("、")}
对每个选题，判断它最适合主推哪几款产品：
- 选题天然只关一款产品（如某款产品的使用场景） → productNames 只填那一款
- 选题适合多款产品（如对比、合集） → productNames 填多款
- 选题不关具体产品（如品牌故事、行业洞察） → productNames 为空数组 []
productNames 里的名字必须严格来自品牌产品列表，逐字一致。`
        : "";

    const phase2Data = await geminiRequest("gemini-2.5-flash", {
      contents: [{
        parts: [{
          text: `你是一个顶级的${pName}内容策划专家。

## 品牌上下文
${brandContext}

## 精选热点（已按品牌相关度筛选）
${selectedTrendsText}

${productBindingInstruction}

## 任务
基于以上精选热点，为"${account.brand.name}"的${pName}账号策划 **8 个内容选题**，严格按以下配比：

- **流量型（traffic）3个**：蹭热点拉曝光，追求播放量和互动，要有话题性和传播力
- **信任型（trust）2个**：输出专业干货，建立品牌可信度，如品类知识、科普、洞察
- **转化型（conversion）2个**：自然种草，突出产品卖点和使用场景，让观众想买
- **人设型（persona）1个**：展示品牌真实面，拉近距离，如幕后、日常、互动

要求：
1. 每个选题要有独特创意角度，不是热点的简单复述
2. 必须遵守品牌调性和红线规则
3. 标题要像真实的${pName}爆款——短、有力、有悬念或共鸣
4. 产品融入要自然，不能硬广
5. 明确标注基于哪条精选热点

返回 JSON 数组（只返回 JSON，不要其他文字）：
[
  {
    "title": "选题标题",
    "type": "traffic / trust / conversion / persona",
    "angle": "切入角度说明",
    "description": "3-5句内容概要，描述这条视频具体怎么做",
    "basedOnTrends": ["基于的精选热点标题1", "精选热点标题2"],
    "productNames": ["最相关的产品名"],
    "estimatedAppeal": "目标受众为什么会想看"
  }
]`,
        }],
      }],
    });

    const phase2Text = extractTextFromResponse(phase2Data);

    let topics: Record<string, unknown>[] = [];
    try {
      const m = phase2Text.match(/\[[\s\S]*\]/);
      if (m) topics = JSON.parse(m[0]);
    } catch { /* ignore */ }

    if (topics.length === 0) {
      return NextResponse.json({
        success: false,
        error: "选题生成失败，请重试",
        selectedTrends, // Still return Phase 1 results for debugging
      });
    }

    const formattedTopics = topics.map((t, i) => {
      // 名字 → id 映射；focus 模式强制写成 focusProduct
      let productIds: string[] = [];
      if (focusProduct) {
        productIds = [focusProduct.id];
      } else if (Array.isArray(t.productNames)) {
        productIds = (t.productNames as unknown[])
          .map((n) => productIdByName.get(String(n)))
          .filter((id): id is string => Boolean(id));
      }
      return {
        id: `topic_${Date.now()}_${i}`,
        title: String(t.title || ""),
        type: String(t.type || "traffic"),
        angle: String(t.angle || ""),
        description: String(t.description || ""),
        relatedTrendIds: Array.isArray(t.basedOnTrends) ? t.basedOnTrends : [],
        productIds,
        estimatedAppeal: String(t.estimatedAppeal || ""),
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      topics: formattedTopics,
      selectedTrends, // Return Phase 1 results so UI can show them
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
