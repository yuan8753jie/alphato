import { ProxyAgent } from "undici";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  return key;
}

function getProxyDispatcher(): ProxyAgent | undefined {
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxy) {
    return new ProxyAgent(proxy);
  }
  return undefined;
}

export async function geminiRequest(
  model: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const apiKey = getApiKey();
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const dispatcher = getProxyDispatcher();

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // @ts-expect-error dispatcher is a valid undici option for Node fetch
    dispatcher,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${err}`);
  }

  return response.json();
}

export function extractTextFromResponse(data: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (data as any).candidates;
  return candidates?.[0]?.content?.parts?.[0]?.text || "";
}
