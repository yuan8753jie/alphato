import { NextRequest, NextResponse } from "next/server";
import { getVideoTaskStatus, klingRequest } from "@/lib/kling";
import { getSeedanceTaskStatus } from "@/lib/seedance";

export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get("taskId");
    const omni = req.nextUrl.searchParams.get("omni");
    const model = req.nextUrl.searchParams.get("model");
    if (!taskId) {
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    if (model === "seedance") {
      const result = await getSeedanceTaskStatus(taskId);
      // Normalize Seedance status enum into the same shape the UI expects
      // (succeeded -> succeed, failed -> failed, others -> processing)
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
    }

    if (omni === "true") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await klingRequest("GET", `/v1/videos/omni-video/${taskId}`)) as any;
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
