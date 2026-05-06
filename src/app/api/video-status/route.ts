import { NextRequest, NextResponse } from "next/server";
import { getSeedanceTaskStatus } from "@/lib/seedance";

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

    return NextResponse.json({
      success: true,
      task: {
        taskId: result.taskId,
        status,
        statusMsg: result.statusMsg,
        videoUrl: result.videoUrl,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
