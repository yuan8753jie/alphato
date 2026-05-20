import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, access } from "fs/promises";
import path from "path";
import { getSeedanceTaskStatus } from "@/lib/seedance";

const VIDEOS_REL_DIR = path.join("uploads", "videos");

async function fileExists(absPath: string): Promise<boolean> {
  try {
    await access(absPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Seedance 视频 URL 24 小时后过期。任务成功时把视频拉回本地，
 * 之后所有引用都用本地路径。幂等：本地已有就直接返回。
 */
async function persistVideoLocally(taskId: string, remoteUrl: string): Promise<string | null> {
  const fileName = `${taskId}.mp4`;
  const absDir = path.join(process.cwd(), "public", VIDEOS_REL_DIR);
  const absPath = path.join(absDir, fileName);
  const localUrl = `/${VIDEOS_REL_DIR.split(path.sep).join("/")}/${fileName}`;

  if (await fileExists(absPath)) return localUrl;

  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(absDir, { recursive: true });
    await writeFile(absPath, buf);
    return localUrl;
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
    // Normalize status enum to what the topics UI expects
    const status =
      result.status === "succeeded"
        ? "succeed"
        : result.status === "failed" || result.status === "expired" || result.status === "cancelled"
        ? "failed"
        : "processing";

    // 成功了：落盘 + 把响应里的 videoUrl 替换为本地 URL
    let videoUrl = result.videoUrl;
    if (status === "succeed" && videoUrl) {
      const local = await persistVideoLocally(result.taskId, videoUrl);
      if (local) videoUrl = local;
      // 下载失败时仍返回 Seedance URL 让前端能播放（24h 内还能用）
    }

    return NextResponse.json({
      success: true,
      task: {
        taskId: result.taskId,
        status,
        statusMsg: result.statusMsg,
        videoUrl,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
