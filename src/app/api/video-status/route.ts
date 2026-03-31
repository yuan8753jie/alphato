import { NextRequest, NextResponse } from "next/server";
import { getVideoTaskStatus, klingRequest } from "@/lib/kling";

export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get("taskId");
    const omni = req.nextUrl.searchParams.get("omni");
    if (!taskId) {
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    if (omni === "true") {
      // Use Omni endpoint
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await klingRequest("GET", `/v1/videos/omni-video/${taskId}`) as any;
      if (data.code !== 0) throw new Error(`Kling error ${data.code}: ${data.message}`);
      const task = {
        taskId: data.data.task_id,
        status: data.data.task_status,
        statusMsg: data.data.task_status_msg,
        videoUrl: data.data.task_result?.videos?.[0]?.url,
        duration: data.data.task_result?.videos?.[0]?.duration,
      };
      return NextResponse.json({ success: true, task });
    }

    const task = await getVideoTaskStatus(taskId);
    return NextResponse.json({ success: true, task });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
