import { NextRequest, NextResponse } from "next/server";
import { buildSeedancePrompt, createSeedanceVideo } from "@/lib/seedance";

export const maxDuration = 60;

// Seedance 智能参考上限：9 图（官方文档）
const MAX_REFERENCE_IMAGES = 9;

/**
 * 把入参里的相对 /uploads/ 路径拼成 Seedance 能访问的绝对 URL。
 * Seedance 是公网服务，需要 http(s):// 开头且可达。本地 dev 跑 localhost
 * 时拼出来的 URL Seedance 访问不到——这是部署期才能根治的事，先尽力。
 */
function normalizeRefUrl(raw: string, origin: string): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/uploads/") && origin) return `${origin}${raw}`;
  // data: 等 Seedance 不接受
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      scenes,
      aspectRatio,
      productImage,           // back-compat：旧的单图字段
      referenceImages,        // 新：多图参考（最多 9 张）
      productName,
      variant,
    } = body as {
      scenes: unknown[];
      aspectRatio?: string;
      productImage?: string;
      referenceImages?: string[];
      productName?: string;
      variant?: string;
    };
    const isVoiceover = !variant || variant.endsWith("voiceover");

    if (!scenes || scenes.length === 0) {
      return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    }

    const { prompt, totalDuration } = buildSeedancePrompt({
      scenes: scenes as import("@/lib/seedance").SeedanceScene[],
      isVoiceover,
      productName,
    });

    // 合并新旧两个字段，去重 + 取前 9 张 + 拼绝对 URL
    const origin = req.nextUrl.origin;
    const raw = [
      ...(referenceImages || []),
      ...(productImage ? [productImage] : []),
    ];
    const normalized: string[] = [];
    const seen = new Set<string>();
    for (const r of raw) {
      const url = normalizeRefUrl(r, origin);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      normalized.push(url);
      if (normalized.length >= MAX_REFERENCE_IMAGES) break;
    }

    const task = await createSeedanceVideo({
      prompt,
      referenceImages: normalized,
      duration: totalDuration,
      ratio: aspectRatio || "9:16",
      resolution: "720p",
      generateAudio: isVoiceover,
    });

    return NextResponse.json({ success: true, task, referenceImagesUsed: normalized.length });
  } catch (err) {
    console.error("generate-video error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
