import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mimeType = file.type;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: { mimeType, data: base64 },
              },
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
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: `Gemini API error: ${err}` }, { status: 500 });
  }

  const data = await response.json();
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Try to parse JSON from response
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
}
