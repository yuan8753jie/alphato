import { NextRequest, NextResponse } from "next/server";
import { geminiRequest } from "@/lib/gemini";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { productName, brandName } = await req.json();

    if (!productName) {
      return NextResponse.json({ error: "No product name" }, { status: 400 });
    }

    // Use Gemini to generate product images
    const data = await geminiRequest("gemini-3.1-flash-image-preview", {
      contents: [{
        parts: [{
          text: `Generate a clean product photography image of "${productName}" by ${brandName || ""}.
The product should be shown on a clean white or light gradient background.
Professional product photography style, high quality, well-lit, showing the product clearly.
No text, no watermarks, no people. Just the product itself.`,
        }],
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    }, 30000);

    // Extract images
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts = (data as any).candidates?.[0]?.content?.parts || [];
    const images: string[] = [];
    for (const part of parts) {
      if (part.inlineData) {
        const { mimeType, data: b64 } = part.inlineData;
        images.push(`data:${mimeType};base64,${b64}`);
      }
    }

    if (images.length === 0) {
      return NextResponse.json({ success: false, error: "No images generated" });
    }

    return NextResponse.json({ success: true, images });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
