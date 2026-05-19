import type { Account } from "./types";

export function getPlatformName(platform: string): string {
  return ({
    douyin: "抖音",
    tiktok: "TikTok",
    xiaohongshu: "小红书",
    instagram: "Instagram",
    kuaishou: "快手",
    wechat: "微信视频号",
    youtube: "YouTube",
    bilibili: "Bilibili",
  } as Record<string, string>)[platform] || "抖音";
}

/**
 * 构建用于 LLM 的品牌上下文文本。
 * - focusProductId 指定时：该产品被标记为本次创作核心，附完整卖点；其他产品压缩为名称列表
 * - focusProductId 为空：按现状列出所有产品
 */
export function buildBrandContext(
  account: Account,
  focusProductId?: string,
): string {
  const focusProduct = focusProductId
    ? account.products.find((p) => p.id === focusProductId)
    : null;

  let productsBlock = "";
  if (focusProduct) {
    const otherNames = account.products
      .filter((p) => p.id !== focusProduct.id)
      .map((p) => p.name)
      .filter(Boolean);
    const focusLines = [
      `★ 本次创作核心产品：${focusProduct.name}`,
      focusProduct.description ? `  描述：${focusProduct.description}` : "",
      focusProduct.sellingPoints.length > 0
        ? `  卖点：${focusProduct.sellingPoints.join("、")}`
        : "",
    ].filter(Boolean).join("\n");
    productsBlock =
      focusLines +
      (otherNames.length > 0
        ? `\n其他在售产品（仅作背景，不要重点提）：${otherNames.join("、")}`
        : "");
  } else if (account.products.length > 0) {
    productsBlock = `产品：\n${account.products
      .map((p) => `  - ${p.name}：${p.description}（卖点：${p.sellingPoints.join("、")}）`)
      .join("\n")}`;
  }

  return [
    `品牌：${account.brand.name}`,
    `行业：${account.brand.industry}`,
    `调性：${account.brand.tone}`,
    account.brand.rules.length > 0
      ? `红线规则：${account.brand.rules.join("；")}`
      : "",
    productsBlock,
    account.personas.length > 0
      ? `品牌方定义的目标受众（仅供参考）：\n${account.personas.map((p) => `  - ${p.name}：${p.description}`).join("\n")}`
      : "",
    account.brandMaterials?.length > 0
      ? `品牌资料摘要：\n${account.brandMaterials.map((m) => `  [${m.purpose}] ${m.extractedText.slice(0, 200)}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n");
}
