import { NextRequest, NextResponse } from "next/server";
import { buildSeedancePrompt, createSeedanceVideo } from "@/lib/seedance";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { scenes, aspectRatio, productImage, productName, variant } = await req.json();
    const isVoiceover = !variant || variant.endsWith("voiceover");

    if (!scenes || scenes.length === 0) {
      return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    }

    const { prompt, totalDuration } = buildSeedancePrompt({
      scenes,
      isVoiceover,
      productName,
    });

    // Seedance image_url accepts only HTTP(S) URLs reliably; skip base64 data URIs.
    const productImageUrl =
      productImage && /^https?:\/\//i.test(productImage) ? productImage : undefined;

    const task = await createSeedanceVideo({
      prompt,
      productImageUrl,
      duration: totalDuration,
      ratio: aspectRatio || "9:16",
      resolution: "720p",
      generateAudio: isVoiceover,
    });

    return NextResponse.json({ success: true, task });
  } catch (err) {
    console.error("generate-video error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
