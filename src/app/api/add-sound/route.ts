import { NextRequest, NextResponse } from "next/server";
import { addSoundToVideo } from "@/lib/kling";

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, bgmPrompt, soundEffectPrompt, asmrMode } = await req.json();
    const result = await addSoundToVideo({ videoUrl, bgmPrompt, soundEffectPrompt, asmrMode });
    return NextResponse.json({ success: true, taskId: result.taskId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
