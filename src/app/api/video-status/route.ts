import { NextRequest, NextResponse } from "next/server";
import { getSeedanceTaskStatus } from "@/lib/seedance";
import { uploadToOss } from "@/lib/oss";

// 内存级幂等缓存：同一 taskId 多次轮询只上传一次（cold start 会丢，不影响正确性）
const persistedTaskUrls = new Map<string, string>();

/**
 * Seedance 视频 URL 24 小时后过期。任务成功时把视频拉回本地、
 * 上传到 OSS，之后所有引用都用 OSS 公网 URL。
 */
async function persistSeedanceVideo(taskId: string, remoteUrl: string): Promise<string | null> {
  const cached = persistedTaskUrls.get(taskId);
  if (cached) return cached;

  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const { url } = await uploadToOss(
      "videos",
      taskId,
      `${taskId}.mp4`,
      buf,
      "video/mp4",
    );
    persistedTaskUrls.set(taskId, url);
    return url;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get("taskId");
    if (!taskId) {
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    const result = await getSeedanceTaskStatus(taskId);
    const status =
      result.status === "succeeded"
        ? "succeed"
        : result.status === "failed" || result.status === "expired" || result.status === "cancelled"
        ? "failed"
        : "processing";

    // 成功了：上传到 OSS，把响应里的 videoUrl 替换为 OSS URL
    let videoUrl = result.videoUrl;
    if (status === "succeed" && videoUrl) {
      const ossUrl = await persistSeedanceVideo(result.taskId, videoUrl);
      if (ossUrl) videoUrl = ossUrl;
      // 上传失败时仍返回 Seedance URL，24h 内还能用
    }

    return NextResponse.json({
      success: true,
      task: {
        taskId: result.taskId,
        status,
        statusMsg: result.statusMsg,
        errorCode: result.errorCode,
        videoUrl,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
