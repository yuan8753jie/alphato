import { NextRequest, NextResponse } from "next/server";
import { createTextToVideo, createSubject, getSubjectStatus } from "@/lib/kling";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { scenes, duration, aspectRatio, productImage, productName, variant } = await req.json();
    const isVoiceover = !variant || variant.endsWith("voiceover");

    // If product image provided, register it as a Kling subject first
    let elementId: number | undefined;
    if (productImage && productName) {
      try {
        const subjectResult = await createSubject({
          name: productName,
          description: `${productName} product, maintain exact appearance`,
          imageBase64OrUrl: productImage,
        });

        // Poll for subject registration (max 30s)
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 2500));
          const status = await getSubjectStatus(subjectResult.taskId);
          if (status.status === "succeed" && status.elementId) {
            elementId = status.elementId;
            break;
          } else if (status.status === "failed") {
            break;
          }
        }
      } catch {
        // Subject registration failed, continue without it
      }
    }

    // Build multi-prompt from storyboard scenes
    if (scenes && scenes.length > 0) {
      // Multi-shot: up to 6 scenes
      const maxScenes = Math.min(scenes.length, 6);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let multiPrompt = scenes.slice(0, maxScenes).map((scene: any, i: number) => {
        const visual = String(scene.visual || scene.prompt || "");
        const voiceover = String(scene.text || "").trim();

        // Build prompt with subject reference if available
        const subjectRef = elementId ? `<<<element_${elementId}>>>` : "";
        let prompt: string;
        if (voiceover) {
          prompt = `A Chinese young person says: "${voiceover}". ${subjectRef} ${visual}`;
        } else {
          prompt = `${subjectRef} ${visual}`;
        }

        // Kling limit: 512 chars per scene prompt — truncate visual if needed, keep voiceover intact
        if (prompt.length > 510) {
          if (voiceover) {
            // Keep the voiceover part, truncate visual
            const voiceoverPart = `A Chinese young person says: "${voiceover}". `;
            const remainingChars = 510 - voiceoverPart.length;
            prompt = voiceoverPart + visual.substring(0, Math.max(50, remainingChars));
          } else {
            prompt = visual.substring(0, 510);
          }
        }

        return {
          index: i + 1,
          prompt,
          duration: Math.max(1, Number(String(scene.duration || "3").replace(/[^0-9]/g, "")) || 3),
        };
      });

      // Kling requires: total duration 5~15s, each scene ≥ 1s, sum(durations) = total
      let totalSec = multiPrompt.reduce((sum: number, s: { duration: number }) => sum + s.duration, 0);

      // If total exceeds 15, distribute evenly across scenes
      if (totalSec > 15) {
        const perScene = Math.max(1, Math.floor(15 / multiPrompt.length));
        multiPrompt = multiPrompt.map((s: { index: number; prompt: string; duration: number }) => ({
          ...s,
          duration: perScene,
        }));
        // Give remainder to first scene
        const remaining = 15 - perScene * multiPrompt.length;
        if (remaining > 0) multiPrompt[0].duration += remaining;
        totalSec = multiPrompt.reduce((sum: number, s: { duration: number }) => sum + s.duration, 0);
      } else if (totalSec < 5) {
        // Pad to minimum 5s
        multiPrompt[multiPrompt.length - 1].duration += 5 - totalSec;
        totalSec = 5;
      }

      const totalDuration = String(totalSec);
      const formattedPrompt = multiPrompt.map((s: { index: number; prompt: string; duration: number }) => ({
        index: s.index,
        prompt: s.prompt,
        duration: String(s.duration),
      }));

      const task = await createTextToVideo({
        multiShot: true,
        multiPrompt: formattedPrompt,
        duration: duration || totalDuration,
        aspectRatio: aspectRatio || "9:16",
        modelName: elementId ? "kling-v3-omni" : "kling-v3", // Use Omni when referencing subjects
        mode: "std",
        sound: isVoiceover ? "on" : "off", // voiceover: on for speech; music: off, use video-to-audio API
      });

      return NextResponse.json({ success: true, task });
    }

    return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
  } catch (err) {
    console.error("generate-video error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
