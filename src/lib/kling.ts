const KLING_BASE = "https://api-beijing.klingai.com";
const KLING_AK = process.env.KLING_ACCESS_KEY || "";
const KLING_SK = process.env.KLING_SECRET_KEY || "";

async function generateJWT(): Promise<string> {
  // JWT: Header.Payload.Signature (HS256)
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: KLING_AK,
    exp: now + 1800, // 30 min
    nbf: now - 5,
  };

  const enc = new TextEncoder();

  function base64url(data: Uint8Array): string {
    let str = "";
    for (const byte of data) str += String.fromCharCode(byte);
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function strToBase64url(s: string): string {
    return base64url(enc.encode(s));
  }

  const headerB64 = strToBase64url(JSON.stringify(header));
  const payloadB64 = strToBase64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(KLING_SK),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  const sigB64 = base64url(new Uint8Array(signature));

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

export async function klingRequest(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const token = await generateJWT();
  const url = `${KLING_BASE}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kling API error (${res.status}): ${err}`);
  }

  return res.json();
}

export interface KlingVideoTask {
  taskId: string;
  status: "submitted" | "processing" | "succeed" | "failed";
  statusMsg?: string;
  videoUrl?: string;
  duration?: string;
}

export async function createTextToVideo(params: {
  prompt?: string;
  multiShot?: boolean;
  multiPrompt?: { index: number; prompt: string; duration: string }[];
  duration?: string;
  aspectRatio?: string;
  mode?: string;
  modelName?: string;
  sound?: string;
}): Promise<KlingVideoTask> {
  const body: Record<string, unknown> = {
    model_name: params.modelName || "kling-v3",
    duration: params.duration || "5",
    aspect_ratio: params.aspectRatio || "9:16",
    mode: params.mode || "std",
    sound: params.sound || "off",
  };

  if (params.multiShot && params.multiPrompt) {
    body.multi_shot = true;
    body.shot_type = "customize";
    body.multi_prompt = params.multiPrompt;
    body.prompt = "";
  } else {
    body.prompt = params.prompt || "";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await klingRequest("POST", "/v1/videos/text2video", body) as any;

  if (data.code !== 0) {
    throw new Error(`Kling error ${data.code}: ${data.message}`);
  }

  return {
    taskId: data.data.task_id,
    status: data.data.task_status,
  };
}

export async function addSoundToVideo(params: {
  videoUrl: string;
  bgmPrompt?: string;
  soundEffectPrompt?: string;
  asmrMode?: boolean;
}): Promise<{ taskId: string }> {
  const body: Record<string, unknown> = {
    video_url: params.videoUrl,
  };
  if (params.bgmPrompt) body.bgm_prompt = params.bgmPrompt.substring(0, 200);
  if (params.soundEffectPrompt) body.sound_effect_prompt = params.soundEffectPrompt.substring(0, 200);
  if (params.asmrMode) body.asmr_mode = true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await klingRequest("POST", "/v1/audio/video-to-audio", body) as any;
  if (data.code !== 0) throw new Error(`Kling error ${data.code}: ${data.message}`);
  return { taskId: data.data.task_id };
}

export async function getSoundTaskStatus(taskId: string): Promise<{
  status: string;
  videoUrl?: string;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await klingRequest("GET", `/v1/audio/video-to-audio/${taskId}`) as any;
  if (data.code !== 0) throw new Error(`Kling error ${data.code}: ${data.message}`);
  return {
    status: data.data.task_status,
    videoUrl: data.data.task_result?.videos?.[0]?.url,
  };
}

export async function getVideoTaskStatus(taskId: string): Promise<KlingVideoTask> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await klingRequest("GET", `/v1/videos/text2video/${taskId}`) as any;

  if (data.code !== 0) {
    throw new Error(`Kling error ${data.code}: ${data.message}`);
  }

  const task = data.data;
  return {
    taskId: task.task_id,
    status: task.task_status,
    statusMsg: task.task_status_msg,
    videoUrl: task.task_result?.videos?.[0]?.url,
    duration: task.task_result?.videos?.[0]?.duration,
  };
}
