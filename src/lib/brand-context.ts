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

export function buildBrandContext(account: Account): string {
  return [
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
      ? `品牌方定义的目标受众（仅供参考）：\n${account.personas.map((p) => `  - ${p.name}：${p.description}`).join("\n")}`
      : "",
    account.brandMaterials?.length > 0
      ? `品牌资料摘要：\n${account.brandMaterials.map((m) => `  [${m.purpose}] ${m.extractedText.slice(0, 200)}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n");
}
