import { NextRequest, NextResponse } from "next/server";
import { getSoundTaskStatus } from "@/lib/kling";

export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get("taskId");
    if (!taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    const task = await getSoundTaskStatus(taskId);
    return NextResponse.json({ success: true, task });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
