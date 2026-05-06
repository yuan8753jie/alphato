// ============================================================
// Seedance 2.0 unified client — supports multiple providers
// ============================================================

export type SeedanceProvider = "tezign" | "shanhai";
export type SeedanceVariant = "standard" | "fast";
export type SeedanceStatus = "queued" | "running" | "succeeded" | "failed" | "expired" | "cancelled";

export interface SeedanceProviderConfig {
  label: string;
  baseUrl: string;
  apiKey: string;
  createPath: string;
  statusPath: (taskId: string) => string;
  models: Record<SeedanceVariant, string>;
}

const PROVIDERS: Record<SeedanceProvider, SeedanceProviderConfig> = {
  tezign: {
    label: "Tezign SD2",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    apiKey: process.env.ARK_API_KEY || "",
    createPath: "/contents/generations/tasks",
    statusPath: (id) => `/contents/generations/tasks/${id}`,
    models: {
      standard: "doubao-seedance-2-0-260128",
      fast: "doubao-seedance-2-0-fast-260128",
    },
  },
  shanhai: {
    label: "Shanhai SD2",
    baseUrl: "https://api.shaiengine.com",
    apiKey: process.env.SHAI_API_KEY || "",
    createPath: "/v1/video/generations",
    statusPath: (id) => `/v1/video/generations/${id}`,
    models: {
      standard: "doubao-seedance-2-0-260128",
      fast: "doubao-seedance-2-0-fast-260128",
    },
  },
};

export function getProviderConfig(provider: SeedanceProvider): SeedanceProviderConfig {
  return PROVIDERS[provider];
}

export function getVariantLabel(provider: SeedanceProvider, variant: SeedanceVariant): string {
  const base = PROVIDERS[provider].label;
  return variant === "fast" ? `${base} Fast API` : `${base} API`;
}

export interface SeedanceVideoTask {
  taskId: string;
  status: SeedanceStatus;
  videoUrl?: string;
  statusMsg?: string;
  provider: SeedanceProvider;
}

// Back-compat: legacy code imports these
export const SEEDANCE_MODEL = PROVIDERS.tezign.models.standard;
export const SEEDANCE_MODEL_FAST = PROVIDERS.tezign.models.fast;

// ============================================================
// Prompt builder (provider-agnostic)
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
// HTTP helpers
// ============================================================

async function providerRequest(
  provider: SeedanceProvider,
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const cfg = PROVIDERS[provider];
  if (!cfg.apiKey) throw new Error(`${cfg.label}: API key not configured`);
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${cfg.label} API error (${res.status}): ${err}`);
  }
  return res.json();
}

// ============================================================
// Create video — provider-aware request body
// ============================================================

export interface CreateSeedanceVideoParams {
  prompt: string;
  provider?: SeedanceProvider;
  variant?: SeedanceVariant;
  productImageUrl?: string;
  // Multi-modal reference inputs (Seedance 2.0 supports up to 9 images + 3 videos)
  referenceImages?: string[];
  referenceVideos?: string[];
  duration: number;
  ratio?: string;
  resolution?: string;
  generateAudio?: boolean;
  // Fixed seed for reproducibility (two calls with same seed should yield identical output)
  seed?: number;
  // Back-compat alias for `variant === "fast"`
  fast?: boolean;
}

export async function createSeedanceVideo(params: CreateSeedanceVideoParams): Promise<SeedanceVideoTask> {
  const provider: SeedanceProvider = params.provider || "tezign";
  const variant: SeedanceVariant = params.variant || (params.fast ? "fast" : "standard");
  const cfg = PROVIDERS[provider];
  const model = cfg.models[variant];

  // Collect all reference assets into unified arrays
  const refImages: string[] = [];
  if (params.productImageUrl) refImages.push(params.productImageUrl);
  if (params.referenceImages) refImages.push(...params.referenceImages);
  const refVideos: string[] = params.referenceVideos || [];

  let body: Record<string, unknown>;
  if (provider === "tezign") {
    // Volcengine-native content array format
    const content: Array<Record<string, unknown>> = [{ type: "text", text: params.prompt }];
    for (const url of refImages) {
      content.push({ type: "image_url", image_url: { url } });
    }
    for (const url of refVideos) {
      content.push({ type: "video_url", video_url: { url } });
    }
    body = {
      model,
      content,
      resolution: params.resolution || "720p",
      ratio: params.ratio || "9:16",
      duration: params.duration,
      watermark: false,
    };
    if (params.generateAudio) body.generate_audio = true;
    if (typeof params.seed === "number") body.seed = params.seed;
  } else {
    // Shanhai wrapper format — top-level prompt + passthrough content array for multi-modal
    body = {
      model,
      prompt: params.prompt,
      resolution: params.resolution || "720p",
      ratio: params.ratio || "9:16",
      duration: params.duration,
      watermark: false,
    };
    if (refImages.length > 0 || refVideos.length > 0) {
      // Pass both single-url fields (for single reference) and a content array (for multi)
      if (refImages[0]) body.image_url = refImages[0];
      const content: Array<Record<string, unknown>> = [{ type: "text", text: params.prompt }];
      for (const url of refImages) content.push({ type: "image_url", image_url: { url } });
      for (const url of refVideos) content.push({ type: "video_url", video_url: { url } });
      body.content = content;
    }
    if (params.generateAudio) body.generate_audio = true;
    if (typeof params.seed === "number") body.seed = params.seed;
  }

  const data = await providerRequest(provider, "POST", cfg.createPath, body);

  if (provider === "tezign") {
    const d = data as { id?: string };
    if (!d.id) throw new Error(`Tezign: missing task id — ${JSON.stringify(data)}`);
    return { taskId: d.id, status: "queued", provider };
  } else {
    const d = data as { task_id?: string; id?: string };
    const id = d.task_id || d.id;
    if (!id) throw new Error(`Shanhai: missing task id — ${JSON.stringify(data)}`);
    return { taskId: String(id), status: "queued", provider };
  }
}

// ============================================================
// Status query — provider-aware response parsing
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

export async function getSeedanceTaskStatus(
  taskId: string,
  provider: SeedanceProvider = "tezign"
): Promise<SeedanceVideoTask> {
  const cfg = PROVIDERS[provider];
  const data = await providerRequest(provider, "GET", cfg.statusPath(taskId));

  if (provider === "tezign") {
    const d = data as {
      id?: string;
      status?: string;
      content?: { video_url?: string };
      error?: { message?: string };
    };
    return {
      taskId: d.id || taskId,
      status: parseStatus(d.status),
      videoUrl: d.content?.video_url,
      statusMsg: d.error?.message,
      provider,
    };
  }

  // Shanhai: wraps inner Volcengine response. Try to surface video url from both layers.
  const d = data as {
    code?: string;
    message?: string;
    data?: {
      task_id?: string;
      status?: string;
      fail_reason?: string;
      data?: {
        status?: string;
        content?: { video_url?: string };
      };
    };
  };
  const inner = d.data?.data;
  // Prefer inner (Volcengine) status — it matches the canonical enum
  const rawStatus = inner?.status || d.data?.status;
  const videoUrl = inner?.content?.video_url;
  return {
    taskId: d.data?.task_id || taskId,
    status: parseStatus(rawStatus),
    videoUrl,
    statusMsg: d.data?.fail_reason || d.message,
    provider,
  };
}
