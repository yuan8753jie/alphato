import { NextRequest, NextResponse } from "next/server";
import { uploadToOss } from "@/lib/oss";

export const maxDuration = 60;

const ALLOWED_MIME_PREFIX = "image/";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const accountId = String(formData.get("accountId") || "");
    const productId = String(formData.get("productId") || "");

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (!accountId || !productId) {
      return NextResponse.json({ error: "Missing accountId or productId" }, { status: 400 });
    }
    if (!file.type.startsWith(ALLOWED_MIME_PREFIX)) {
      return NextResponse.json({ error: `仅支持图片文件，收到 ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `图片过大（${(file.size / 1024 / 1024).toFixed(1)} MB），最大 10 MB` }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const { url } = await uploadToOss(
      "product-images",
      [accountId, productId],
      file.name,
      Buffer.from(bytes),
      file.type,
    );

    return NextResponse.json({ success: true, url });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
