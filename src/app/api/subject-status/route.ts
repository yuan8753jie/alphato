import { NextRequest, NextResponse } from "next/server";
import { getSubjectStatus } from "@/lib/kling";

export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get("taskId");
    if (!taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    const result = await getSubjectStatus(taskId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
