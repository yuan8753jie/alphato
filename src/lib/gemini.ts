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
  body: Record<string, unknown>,
  timeoutMs: number = 60000
): Promise<Record<string, unknown>> {
  const apiKey = getApiKey();
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const dispatcher = getProxyDispatcher();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      // @ts-expect-error dispatcher is a valid undici option for Node fetch
      dispatcher,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${err}`);
    }

    return response.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Gemini API timeout after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function extractTextFromResponse(data: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (data as any).candidates;
  return candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  thoughtsTokens?: number;
}

export function extractTokenUsage(data: Record<string, unknown>): TokenUsage | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usage = (data as any).usageMetadata;
  if (!usage) return null;
  return {
    promptTokens: usage.promptTokenCount || 0,
    candidatesTokens: usage.candidatesTokenCount || 0,
    totalTokens: usage.totalTokenCount || 0,
    thoughtsTokens: usage.thoughtsTokenCount || undefined,
  };
}
