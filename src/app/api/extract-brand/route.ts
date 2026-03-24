import { NextRequest, NextResponse } from "next/server";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type;

    const data = await geminiRequest("gemini-2.5-flash", {
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: base64 } },
            {
              text: `你是一个品牌分析专家。请仔细查看这张图片，提取其中与品牌运营相关的所有信息。

请按以下 JSON 格式返回（只返回 JSON，不要其他文字）：

{
  "brandName": "品牌名称（如果图中能识别出来）",
  "industry": "所属行业",
  "tone": "品牌调性/风格描述",
  "rules": ["规则1", "规则2"],
  "summary": "图片中所有文字内容的完整摘要，保留关键细节"
}

如果某个字段无法从图片中提取，设为空字符串或空数组。summary 字段务必尽可能完整地提取图片中的文字内容。`,
            },
          ],
        },
      ],
    });

    const text = extractTextFromResponse(data);

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({ success: true, extracted: parsed });
      }
    } catch {
      // Fall through to return raw text
    }

    return NextResponse.json({ success: true, extracted: { summary: text } });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
