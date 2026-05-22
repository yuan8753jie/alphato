import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { randomUUID } from "crypto";
import { geminiRequest, extractTextFromResponse } from "@/lib/gemini";
import { uploadToOss } from "@/lib/oss";
import type { ProductDocument, ProductDocumentExtracted, ProductDocumentFileType } from "@/lib/types";

export const maxDuration = 120;

const ALLOWED_EXTS = new Set([".pdf", ".md", ".markdown", ".txt"]);
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

function detectFileType(fileName: string, mime: string): ProductDocumentFileType {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf" || mime === "application/pdf") return "pdf";
  if (ext === ".md" || ext === ".markdown") return "markdown";
  if (ext === ".txt" || mime.startsWith("text/")) return "text";
  if (mime.startsWith("image/")) return "image";
  return "other";
}

const EXTRACT_INSTRUCTION = `你是一个产品分析专家，请仔细阅读以下产品文档，提取对内容营销有价值的信息。

请严格按如下 JSON 格式返回（只返回 JSON，不要其他文字）：

{
  "sellingPoints": ["卖点1", "卖点2", ...],
  "targetAudience": "对目标受众的画像描述（年龄段、生活方式、痛点、决策因子等）",
  "keyFeatures": ["关键功能/规格1", "关键功能/规格2", ...],
  "positioning": "一句话总结这款产品的定位（在品类中差异化于哪里）",
  "scenarios": ["典型使用场景1", "典型使用场景2", ...],
  "summary": "300-500 字的完整摘要，保留具体参数、价格、容量等数字"
}

要求：
- 卖点、功能、场景列表至少 3 条，越具体越好（避免"性价比高""体验好"这种空话）
- 受众画像要具体到能让人脑补出一个真人，不要罗列年龄段
- summary 务必保留产品文档里的数字与硬指标（如续航、容量、价格、尺寸），不要省略`;

function parseExtracted(raw: string): ProductDocumentExtracted {
  const fallback: ProductDocumentExtracted = {
    sellingPoints: [],
    targetAudience: "",
    keyFeatures: [],
    positioning: "",
    scenarios: [],
    summary: raw.slice(0, 800),
  };
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]);
    return {
      sellingPoints: Array.isArray(parsed.sellingPoints) ? parsed.sellingPoints.map(String) : [],
      targetAudience: String(parsed.targetAudience || ""),
      keyFeatures: Array.isArray(parsed.keyFeatures) ? parsed.keyFeatures.map(String) : [],
      positioning: String(parsed.positioning || ""),
      scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios.map(String) : [],
      summary: String(parsed.summary || ""),
    };
  } catch {
    return fallback;
  }
}

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

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: `不支持的文件类型：${ext}，仅支持 .pdf / .md / .markdown / .txt` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `文件过大（${(file.size / 1024 / 1024).toFixed(1)} MB），最大 20 MB` }, { status: 400 });
    }

    const fileType = detectFileType(file.name, file.type);
    const bytes = await file.arrayBuffer();
    const buf = Buffer.from(bytes);

    // 1) 上传到 OSS（公网可达，Seedance 等服务能直接拉）
    const docId = randomUUID();
    const { url: fileUrl } = await uploadToOss(
      "product-docs",
      [accountId, productId],
      file.name,
      buf,
      file.type || undefined,
    );

    // 2) 调 Gemini 提取
    let extractedRaw = "";
    if (fileType === "pdf") {
      const data = await geminiRequest("gemini-2.5-flash", {
        contents: [{
          parts: [
            { inlineData: { mimeType: "application/pdf", data: buf.toString("base64") } },
            { text: EXTRACT_INSTRUCTION },
          ],
        }],
      }, 90000);
      extractedRaw = extractTextFromResponse(data);
    } else if (fileType === "markdown" || fileType === "text") {
      const rawText = buf.toString("utf-8");
      const data = await geminiRequest("gemini-2.5-flash", {
        contents: [{
          parts: [{ text: `${EXTRACT_INSTRUCTION}\n\n---\n以下是产品文档全文：\n\n${rawText}` }],
        }],
      }, 60000);
      extractedRaw = extractTextFromResponse(data);
    } else if (fileType === "image") {
      const data = await geminiRequest("gemini-2.5-flash", {
        contents: [{
          parts: [
            { inlineData: { mimeType: file.type, data: buf.toString("base64") } },
            { text: EXTRACT_INSTRUCTION },
          ],
        }],
      }, 60000);
      extractedRaw = extractTextFromResponse(data);
    } else {
      return NextResponse.json({ error: "unsupported file type after detection" }, { status: 400 });
    }

    const extracted = parseExtracted(extractedRaw);

    const doc: ProductDocument = {
      id: docId,
      fileName: file.name,
      fileType,
      fileUrl,
      sizeBytes: file.size,
      extracted,
      uploadedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, document: doc });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
