import { NextRequest, NextResponse } from "next/server";
import { geminiRequest } from "@/lib/gemini";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { productName, brandName } = await req.json();

    if (!productName) {
      return NextResponse.json({ error: "No product name" }, { status: 400 });
    }

    const query = brandName
      ? `${brandName} ${productName} 产品图 白底图`
      : `${productName} 产品图 白底图`;

    // Use Gemini with Google Search to find real product images
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await geminiRequest("gemini-2.5-flash", {
      contents: [{
        parts: [{
          text: `搜索"${query}"的产品白底图/官方产品图片。

请搜索并返回该产品的真实图片URL链接。优先找：
1. 品牌官网的产品图
2. 电商平台（天猫、京东）的产品主图
3. 白底产品图

返回 JSON（只返回 JSON）：
{
  "images": [
    {
      "url": "图片的直接URL链接",
      "source": "图片来源网站"
    }
  ]
}

只返回真实可访问的图片URL，不要编造。如果找不到就返回空数组。`,
        }],
      }],
      tools: [{ googleSearch: {} }],
    }, 20000);

    // Extract text response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = (data as any).candidates?.[0]?.content?.parts?.[0]?.text || "";

    let images: { url: string; source: string }[] = [];
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        images = parsed.images || [];
      }
    } catch { /* ignore */ }

    // Also extract image URLs from grounding metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groundingChunks = (data as any).candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingUrls = groundingChunks
      .filter((c: { web?: { uri?: string } }) => c.web?.uri)
      .map((c: { web: { title?: string; uri: string } }) => ({
        url: c.web.uri,
        source: c.web.title || "",
      }));

    return NextResponse.json({
      success: true,
      images,
      groundingUrls,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
