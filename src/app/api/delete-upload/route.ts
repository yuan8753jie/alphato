import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { fileUrl } = (await req.json()) as { fileUrl?: string };
    if (!fileUrl || typeof fileUrl !== "string") {
      return NextResponse.json({ error: "Missing fileUrl" }, { status: 400 });
    }
    // 限定只能删 /uploads/ 下的文件，防止越权
    if (!fileUrl.startsWith("/uploads/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    const abs = path.join(process.cwd(), "public", fileUrl);
    // 二次校验：绝对路径必须在 public/uploads 内
    const uploadsRoot = path.join(process.cwd(), "public", "uploads");
    if (!abs.startsWith(uploadsRoot)) {
      return NextResponse.json({ error: "Path traversal blocked" }, { status: 400 });
    }
    try {
      await unlink(abs);
    } catch {
      // 文件可能已不存在；视为幂等成功
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
