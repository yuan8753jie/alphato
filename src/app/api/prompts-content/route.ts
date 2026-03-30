import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "docs", "prompts.md");
    const content = await readFile(filePath, "utf-8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ content: "# 提示词目录\n\n文件未找到。" });
  }
}
