import { NextRequest, NextResponse } from "next/server";
import { createSeedanceVideo, type SeedanceVariant } from "@/lib/seedance";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const {
      prompt, variant,
      resolution, ratio, duration, generateAudio, seed,
      referenceImages, referenceVideos,
    } = await req.json() as {
      prompt: string;
      variant: SeedanceVariant;
      resolution?: string;
      ratio?: string;
      duration?: number;
      generateAudio?: boolean;
      seed?: number;
      referenceImages?: string[];
      referenceVideos?: string[];
    };

    if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
    if (!variant) return NextResponse.json({ error: "variant required" }, { status: 400 });

    // Strip inline --ratio / --resolution / --duration / --camerafixed flags from prompt.
    // Trust the dropdown UI values (JSON fields) as the single source of truth.
    const cleanedPrompt = prompt
      .replace(/--(?:resolution|ratio|duration|camerafixed|seed)\s+\S+/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    const task = await createSeedanceVideo({
      prompt: cleanedPrompt,
      variant,
      resolution: resolution || "720p",
      ratio: ratio || "9:16",
      duration: duration || 5,
      generateAudio: generateAudio ?? true,
      seed: typeof seed === "number" ? seed : undefined,
      referenceImages,
      referenceVideos,
    });

    return NextResponse.json({ success: true, task });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
