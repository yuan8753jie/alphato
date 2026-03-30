import { NextRequest, NextResponse } from "next/server";
import { createTextToVideo } from "@/lib/kling";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { scenes, duration, aspectRatio } = await req.json();

    // Build multi-prompt from storyboard scenes
    if (scenes && scenes.length > 0) {
      // Multi-shot: up to 6 scenes, each with prompt and duration
      const maxScenes = Math.min(scenes.length, 6);
      const multiPrompt = scenes.slice(0, maxScenes).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (scene: any, i: number) => ({
          index: i + 1,
          prompt: String(scene.visual || scene.prompt || ""),
          duration: String(scene.duration?.replace(/[^0-9]/g, "") || "3"),
        })
      );

      // Calculate total duration
      const totalDuration = String(
        Math.min(
          15,
          Math.max(
            5,
            multiPrompt.reduce((sum: number, s: { duration: string }) => sum + Number(s.duration), 0)
          )
        )
      );

      const task = await createTextToVideo({
        multiShot: true,
        multiPrompt,
        duration: duration || totalDuration,
        aspectRatio: aspectRatio || "9:16",
        modelName: "kling-v3",
        mode: "std",
        sound: "on",
      });

      return NextResponse.json({ success: true, task });
    }

    return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
