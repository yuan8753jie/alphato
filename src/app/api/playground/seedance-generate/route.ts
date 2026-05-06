import { NextRequest, NextResponse } from "next/server";
import { createSeedanceVideo, type SeedanceProvider, type SeedanceVariant } from "@/lib/seedance";

export const maxDuration = 60;
// Allow large bodies for base64-encoded reference assets (up to ~100MB)
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const {
      prompt, provider, variant,
      resolution, ratio, duration, generateAudio, seed,
      referenceImages, referenceVideos,
    } = await req.json() as {
      prompt: string;
      provider: SeedanceProvider;
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
    if (!provider) return NextResponse.json({ error: "provider required" }, { status: 400 });
    if (!variant) return NextResponse.json({ error: "variant required" }, { status: 400 });

    // Strip inline --ratio / --resolution / --duration / --camerafixed flags from prompt.
    // These conflict with the JSON fields and can be parsed inconsistently by upstream.
    // Trust the dropdown UI values (JSON fields) as the single source of truth.
    const cleanedPrompt = prompt
      .replace(/--(?:resolution|ratio|duration|camerafixed|seed)\s+\S+/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    const task = await createSeedanceVideo({
      prompt: cleanedPrompt,
      provider,
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
