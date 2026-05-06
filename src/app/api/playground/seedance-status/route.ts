import { NextRequest, NextResponse } from "next/server";
import { getSeedanceTaskStatus } from "@/lib/seedance";

export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get("taskId");
    if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

    const task = await getSeedanceTaskStatus(taskId);
    return NextResponse.json({ success: true, task });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
