// 阿里云 OSS 上传/删除封装
// Bucket: tezign-videomixer（公开读，多个工具共享）
// alphato 自己的资源全部落到 alphato/ 子目录下，避免与 videomixer 冲突
//
// 公网读 URL 优先返回 CDN 域名（更快），删除时同时认 CDN 和 OSS 默认域名。

import OSS from "ali-oss";
import { randomUUID } from "crypto";

const ALPHATO_PREFIX = "alphato";

function getClient(): OSS {
  const region = process.env.OSS_REGION;
  const bucket = process.env.OSS_BUCKET;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  if (!region || !bucket || !accessKeyId || !accessKeySecret) {
    throw new Error("OSS credentials not configured (OSS_REGION/OSS_BUCKET/OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET)");
  }
  return new OSS({ region, accessKeyId, accessKeySecret, bucket, secure: true });
}

function cdnBase(): string {
  return (process.env.OSS_CDN_BASE || "").replace(/\/$/, "");
}

function ossDefaultBase(): string {
  const region = process.env.OSS_REGION || "";
  const bucket = process.env.OSS_BUCKET || "";
  return `https://${bucket}.${region}.aliyuncs.com`;
}

function publicUrl(objectKey: string): string {
  const cdn = cdnBase();
  if (cdn) return `${cdn}/${objectKey}`;
  return `${ossDefaultBase()}/${objectKey}`;
}

function safeSegment(s: string): string {
  return s
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80) || "_";
}

/**
 * 上传二进制内容到 OSS，返回公网可达的 URL（优先 CDN 域名）
 *
 * @param category 资源类别，作为路径段之一，如 "product-images" / "product-docs" / "videos"
 * @param scope 路径段（如 accountId、productId、taskId），多段用数组传，单段直接传 string
 * @param fileName 原始文件名，用于扩展名 + UUID 拼装；为空则只用 UUID
 * @param body 文件二进制
 * @param contentType MIME 类型，会写到 OSS 对象的 Content-Type header
 */
export async function uploadToOss(
  category: string,
  scope: string | string[],
  fileName: string,
  body: Buffer,
  contentType?: string,
): Promise<{ url: string; key: string }> {
  const segs = Array.isArray(scope) ? scope : [scope];
  const safeSegs = segs.map(safeSegment);
  const safeName = safeSegment(fileName || "file");
  const id = randomUUID();
  const objectKey = [ALPHATO_PREFIX, safeSegment(category), ...safeSegs, `${id}-${safeName}`]
    .filter(Boolean)
    .join("/");

  const client = getClient();
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = contentType;
  await client.put(objectKey, body, { headers });
  return { url: publicUrl(objectKey), key: objectKey };
}

/**
 * 从 URL 反推 object key，仅识别 CDN / OSS 默认域名 + alphato/ 前缀。
 * 旧的 /uploads/... 本地路径返回 null。
 */
export function urlToObjectKey(url: string): string | null {
  if (!url) return null;
  const cdn = cdnBase();
  if (cdn && url.startsWith(cdn + "/")) {
    return url.slice(cdn.length + 1);
  }
  const ossBase = ossDefaultBase();
  if (url.startsWith(ossBase + "/")) {
    return url.slice(ossBase.length + 1);
  }
  return null;
}

/**
 * 按 URL 删除 OSS 对象。识别失败/不在我们 bucket 时返回 false。
 */
export async function deleteByUrl(url: string): Promise<boolean> {
  const key = urlToObjectKey(url);
  if (!key) return false;
  // 安全护栏：必须在 alphato/ 前缀下，防止误删其他工具的文件
  if (!key.startsWith(`${ALPHATO_PREFIX}/`)) return false;
  try {
    const client = getClient();
    await client.delete(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * 判断一个 URL 是否归我们管（OSS 自家域名或 CDN）。用于删除时区分本地遗留 vs 外链。
 */
export function isOssUrl(url: string): boolean {
  return urlToObjectKey(url) !== null;
}
