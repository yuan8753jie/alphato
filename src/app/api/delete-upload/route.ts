import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { deleteByUrl, isOssUrl } from "@/lib/oss";

export async function POST(req: NextRequest) {
  try {
    const { fileUrl } = (await req.json()) as { fileUrl?: string };
    if (!fileUrl || typeof fileUrl !== "string") {
      return NextResponse.json({ error: "Missing fileUrl" }, { status: 400 });
    }

    // 新数据：完整 OSS / CDN URL → 走 OSS 删除
    if (isOssUrl(fileUrl)) {
      const ok = await deleteByUrl(fileUrl);
      return NextResponse.json({ success: ok });
    }

    // 旧数据兼容：之前存在 /public/uploads/ 下的本地文件
    if (fileUrl.startsWith("/uploads/")) {
      const abs = path.join(process.cwd(), "public", fileUrl);
      const uploadsRoot = path.join(process.cwd(), "public", "uploads");
      if (!abs.startsWith(uploadsRoot)) {
        return NextResponse.json({ error: "Path traversal blocked" }, { status: 400 });
      }
      try {
        await unlink(abs);
      } catch {
        // 文件已不存在，视为幂等成功
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
