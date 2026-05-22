import { NextRequest, NextResponse } from "next/server";
import { buildSeedancePrompt, createSeedanceVideo } from "@/lib/seedance";

export const maxDuration = 60;

// Seedance 智能参考上限：9 图（官方文档）
const MAX_REFERENCE_IMAGES = 9;

/**
 * 只接受公网可达的 http(s):// URL。本地 /uploads/ 路径（旧数据）和 data:
 * URI 一律拒收——新数据应该都是 OSS / CDN 域名。
 */
function normalizeRefUrl(raw: string): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
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

    // 合并新旧两个字段，去重 + 取前 9 张（先做这一步，prompt 构建要知道实际有几张图）
    const raw = [
      ...(referenceImages || []),
      ...(productImage ? [productImage] : []),
    ];
    const normalized: string[] = [];
    const seen = new Set<string>();
    const rejectedNonHttp: string[] = [];
    for (const r of raw) {
      const url = normalizeRefUrl(r);
      if (!url) {
        rejectedNonHttp.push(r);
        continue;
      }
      if (seen.has(url)) continue;
      seen.add(url);
      normalized.push(url);
      if (normalized.length >= MAX_REFERENCE_IMAGES) break;
    }

    const { prompt, totalDuration } = buildSeedancePrompt({
      scenes: scenes as import("@/lib/seedance").SeedanceScene[],
      isVoiceover,
      productName,
      referenceImageCount: normalized.length,
    });

    // Debug：发给 Seedance 之前打印请求摘要
    console.log("[generate-video] sending to Seedance:", JSON.stringify({
      productName,
      refCount: normalized.length,
      refRejected: rejectedNonHttp.length,
      refUrls: normalized,
      duration: totalDuration,
      ratio: aspectRatio || "9:16",
      generateAudio: isVoiceover,
      promptHead: prompt.slice(0, 300),
    }, null, 2));

    const task = await createSeedanceVideo({
      prompt,
      referenceImages: normalized,
      duration: totalDuration,
      ratio: aspectRatio || "9:16",
      resolution: "720p",
      generateAudio: isVoiceover,
    });

    return NextResponse.json({
      success: true,
      task,
      prompt,                                     // 客户端保存为快照
      referenceImagesUsed: normalized.length,
      referenceImages: normalized,                // 实际发给 Seedance 的参考图 URL，供历史页用
      referenceImagesRejected: rejectedNonHttp.length,
    });
  } catch (err) {
    console.error("generate-video error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
