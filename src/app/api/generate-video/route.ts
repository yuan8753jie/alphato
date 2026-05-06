import { NextRequest, NextResponse } from "next/server";
import { createTextToVideo, createSubject, getSubjectStatus } from "@/lib/kling";
import { buildSeedancePrompt, createSeedanceVideo } from "@/lib/seedance";

export const maxDuration = 60;

type ModelKind = "kling" | "seedance";

export async function POST(req: NextRequest) {
  try {
    const { scenes, duration, aspectRatio, productImage, productName, variant, model } = await req.json();
    const isVoiceover = !variant || variant.endsWith("voiceover");
    const modelKind: ModelKind = model === "seedance" ? "seedance" : "kling";

    if (!scenes || scenes.length === 0) {
      return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    }

    if (modelKind === "seedance") {
      const { prompt, totalDuration } = buildSeedancePrompt({
        scenes,
        isVoiceover,
        productName,
      });

      // Seedance image_url only accepts HTTP(S) URLs reliably; skip base64 data URIs.
      const productImageUrl =
        productImage && /^https?:\/\//i.test(productImage) ? productImage : undefined;

      const task = await createSeedanceVideo({
        prompt,
        productImageUrl,
        duration: totalDuration,
        ratio: aspectRatio || "9:16",
        resolution: "720p",
        generateAudio: isVoiceover,
      });

      return NextResponse.json({ success: true, task, model: "seedance" });
    }

    // Kling path (existing behavior)
    let elementId: number | undefined;
    if (productImage && productName) {
      try {
        const subjectResult = await createSubject({
          name: productName,
          description: `${productName} product, maintain exact appearance`,
          imageBase64OrUrl: productImage,
        });

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
        /* continue without subject */
      }
    }

    const maxScenes = Math.min(scenes.length, 6);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let multiPrompt = scenes.slice(0, maxScenes).map((scene: any, i: number) => {
      const visual = String(scene.visual || scene.prompt || "");
      const voiceover = String(scene.text || "").trim();

      const subjectRef = elementId ? `<<<element_${elementId}>>>` : "";
      let prompt: string;
      if (voiceover) {
        prompt = `${subjectRef}画面中的人说："${voiceover}"。${visual}`;
      } else {
        prompt = `${subjectRef}${visual}`;
      }

      if (prompt.length > 510) {
        if (voiceover) {
          const voiceoverPart = `${subjectRef}画面中的人说："${voiceover}"。`;
          const remainingChars = 510 - voiceoverPart.length;
          prompt = voiceoverPart + visual.substring(0, Math.max(30, remainingChars));
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

    let totalSec = multiPrompt.reduce((sum: number, s: { duration: number }) => sum + s.duration, 0);

    if (totalSec > 15) {
      const perScene = Math.max(1, Math.floor(15 / multiPrompt.length));
      multiPrompt = multiPrompt.map((s: { index: number; prompt: string; duration: number }) => ({
        ...s,
        duration: perScene,
      }));
      const remaining = 15 - perScene * multiPrompt.length;
      if (remaining > 0) multiPrompt[0].duration += remaining;
      totalSec = multiPrompt.reduce((sum: number, s: { duration: number }) => sum + s.duration, 0);
    } else if (totalSec < 5) {
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
      modelName: "kling-v3",
      elementIds: elementId ? [elementId] : undefined,
      mode: "std",
      sound: isVoiceover ? "on" : "off",
    });

    return NextResponse.json({ success: true, task, useOmni: !!elementId, model: "kling" });
  } catch (err) {
    console.error("generate-video error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
