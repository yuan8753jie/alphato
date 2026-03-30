import { NextRequest, NextResponse } from "next/server";
import { geminiRequest } from "@/lib/gemini";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { visual, sceneNumber, aspectRatio } = await req.json();

    if (!visual) {
      return NextResponse.json({ error: "No visual prompt" }, { status: 400 });
    }

    const data = await geminiRequest("gemini-3.1-flash-image-preview", {
      contents: [{
        parts: [{
          text: `Generate a high-quality storyboard frame for a short video.

Scene ${sceneNumber || ""}:
${visual}

Style: cinematic storyboard frame, vibrant colors, professional quality,
suitable for a social media short video advertisement.
Do NOT include any text or watermarks in the image.`,
        }],
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: aspectRatio || "9:16",
        },
      },
    }, 45000);

    // Extract image from response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts = (data as any).candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        const { mimeType, data: b64 } = part.inlineData;
        return NextResponse.json({
          success: true,
          image: {
            mimeType,
            data: b64,
            dataUrl: `data:${mimeType};base64,${b64}`,
          },
        });
      }
    }

    return NextResponse.json({ success: false, error: "No image generated" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
