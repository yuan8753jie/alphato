// ============================================================
// Seedance 2.0 client — Volcengine Ark direct
// ============================================================

const ARK_BASE = "https://ark.cn-beijing.volces.com/api/v3";
const ARK_API_KEY = process.env.ARK_API_KEY || "";

export type SeedanceVariant = "standard" | "fast";
export type SeedanceStatus = "queued" | "running" | "succeeded" | "failed" | "expired" | "cancelled";

export const SEEDANCE_MODELS: Record<SeedanceVariant, string> = {
  standard: "doubao-seedance-2-0-260128",
  fast: "doubao-seedance-2-0-fast-260128",
};

// Back-compat exports
export const SEEDANCE_MODEL = SEEDANCE_MODELS.standard;
export const SEEDANCE_MODEL_FAST = SEEDANCE_MODELS.fast;

export function getVariantLabel(variant: SeedanceVariant): string {
  return variant === "fast" ? "Seedance 2.0 Fast" : "Seedance 2.0";
}

export interface SeedanceVideoTask {
  taskId: string;
  status: SeedanceStatus;
  videoUrl?: string;
  statusMsg?: string;
}

// ============================================================
// HTTP helper
// ============================================================

async function arkRequest(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!ARK_API_KEY) throw new Error("ARK_API_KEY not configured");
  const res = await fetch(`${ARK_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ARK_API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Seedance API error (${res.status}): ${err}`);
  }
  return res.json();
}

// ============================================================
// Prompt builder
// ============================================================

const ORDINAL_CONNECTORS = ["首先", "接着", "随后", "然后", "之后", "紧接着", "再然后", "最后"];

function connectorFor(index: number, total: number): string {
  if (index === 0) return "首先";
  if (index === total - 1 && total > 1) return "最后";
  return ORDINAL_CONNECTORS[Math.min(index, ORDINAL_CONNECTORS.length - 2)];
}

export interface SeedanceScene {
  visual: string;
  text?: string;
  shotType?: string;
  duration?: number | string;
}

export function buildSeedancePrompt(params: {
  scenes: SeedanceScene[];
  isVoiceover: boolean;
  productName?: string;
  resolution?: string;
  ratio?: string;
}): { prompt: string; totalDuration: number } {
  const scenes = params.scenes;
  const total = scenes.length;

  const segments = scenes.map((scene, i) => {
    const connector = connectorFor(i, total);
    const shot = String(scene.shotType || "").trim();
    const visual = String(scene.visual || "").trim();
    const voiceover = String(scene.text || "").trim();

    const shotPrefix = shot ? `${shot}：` : "";
    let segment = `${connector}，${shotPrefix}${visual}`;
    if (params.isVoiceover && voiceover) {
      segment += ` 人物对镜头说："${voiceover}"`;
    }
    return segment.replace(/\s+/g, " ");
  });

  let body = segments.join("。");
  if (params.productName) {
    body = `主体${params.productName}，全程保持外观与配色一致。${body}`;
  }
  body += "。整体电影感、柔光自然、镜头平稳、画面稳定。";

  let totalDur = scenes.reduce((sum, s) => {
    const d = Number(String(s.duration || "3").replace(/[^0-9]/g, "")) || 3;
    return sum + d;
  }, 0);
  if (totalDur < 4) totalDur = 4;
  if (totalDur > 15) totalDur = 15;

  const ratio = params.ratio || "9:16";
  const resolution = params.resolution || "720p";
  const params_inline = `--resolution ${resolution} --duration ${totalDur} --ratio ${ratio}`;

  let prompt = `${body} ${params_inline}`;
  if (prompt.length > 2000) {
    const overflow = prompt.length - 2000;
    body = body.substring(0, body.length - overflow - 4) + "...";
    prompt = `${body} ${params_inline}`;
  }
  return { prompt, totalDuration: totalDur };
}

// ============================================================
// Create video task
// ============================================================

export interface CreateSeedanceVideoParams {
  prompt: string;
  variant?: SeedanceVariant;
  productImageUrl?: string;
  referenceImages?: string[];
  referenceVideos?: string[];
  duration: number;
  ratio?: string;
  resolution?: string;
  generateAudio?: boolean;
  seed?: number;
  // Back-compat alias
  fast?: boolean;
}

export async function createSeedanceVideo(params: CreateSeedanceVideoParams): Promise<SeedanceVideoTask> {
  const variant: SeedanceVariant = params.variant || (params.fast ? "fast" : "standard");
  const model = SEEDANCE_MODELS[variant];

  const refImages: string[] = [];
  if (params.productImageUrl) refImages.push(params.productImageUrl);
  if (params.referenceImages) refImages.push(...params.referenceImages);
  const refVideos: string[] = params.referenceVideos || [];

  const content: Array<Record<string, unknown>> = [{ type: "text", text: params.prompt }];
  for (const url of refImages) {
    content.push({ type: "image_url", image_url: { url } });
  }
  for (const url of refVideos) {
    content.push({ type: "video_url", video_url: { url } });
  }

  const body: Record<string, unknown> = {
    model,
    content,
    resolution: params.resolution || "720p",
    ratio: params.ratio || "9:16",
    duration: params.duration,
    watermark: false,
  };
  if (params.generateAudio) body.generate_audio = true;
  if (typeof params.seed === "number") body.seed = params.seed;

  const data = await arkRequest("POST", "/contents/generations/tasks", body) as {
    id?: string;
  };
  if (!data.id) throw new Error(`Seedance: missing task id — ${JSON.stringify(data)}`);
  return { taskId: data.id, status: "queued" };
}

// ============================================================
// Status query
// ============================================================

function parseStatus(raw: string | undefined): SeedanceStatus {
  const s = (raw || "").toLowerCase();
  if (s === "succeeded" || s === "success") return "succeeded";
  if (s === "failed") return "failed";
  if (s === "expired") return "expired";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "running" || s === "in_progress" || s === "processing") return "running";
  return "queued";
}

export async function getSeedanceTaskStatus(taskId: string): Promise<SeedanceVideoTask> {
  const data = await arkRequest("GET", `/contents/generations/tasks/${taskId}`) as {
    id?: string;
    status?: string;
    content?: { video_url?: string };
    error?: { message?: string };
  };
  return {
    taskId: data.id || taskId,
    status: parseStatus(data.status),
    videoUrl: data.content?.video_url,
    statusMsg: data.error?.message,
  };
}
