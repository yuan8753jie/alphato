"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccount, getTopics, getScripts, saveScript } from "@/lib/store";
import type { Account, Topic } from "@/lib/types";
import { TOPIC_TYPE_LABELS } from "@/lib/types";
import { buildSeedancePrompt } from "@/lib/seedance";

const TYPE_COLORS: Record<string, string> = {
  traffic: "bg-red-100 text-red-800",
  trust: "bg-blue-100 text-blue-800",
  conversion: "bg-green-100 text-green-800",
  persona: "bg-purple-100 text-purple-800",
};

const VARIANTS = [
  { key: "free-voiceover", label: "稳健版·口播", desc: "常规热门模式 + 有台词旁白" },
  { key: "free-music", label: "稳健版·音乐", desc: "常规热门模式 + 纯音乐驱动" },
  { key: "creative-voiceover", label: "创意版·口播", desc: "创造性思维方法论 + 有台词" },
  { key: "creative-music", label: "创意版·音乐", desc: "创造性思维方法论 + 纯音乐" },
] as const;

type VariantKey = typeof VARIANTS[number]["key"];

export default function TopicDetailPage() {
  const router = useRouter();
  const params = useParams();
  const topicId = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  // 选定用于本次脚本生成的产品 id。空字符串 = 不指定（通用）
  const [scriptProductId, setScriptProductId] = useState<string>("");
  // 视频引用产品图：是否开启 + 选中的图 URL 集合（Seedance 上限 9 张）
  const [useRefImages, setUseRefImages] = useState(false);
  const [refImageUrls, setRefImageUrls] = useState<string[]>([]);
  const MAX_REF_IMAGES = 9;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scripts, setScripts] = useState<Record<VariantKey, any>>({} as Record<VariantKey, any>);
  const [loadingVariants, setLoadingVariants] = useState<Set<VariantKey>>(new Set());
  const [activeTab, setActiveTab] = useState<VariantKey>("free-voiceover");
  const [error, setError] = useState<string | null>(null);
  const [sceneImages, setSceneImages] = useState<Record<string, string>>({});
  const [generatingScene, setGeneratingScene] = useState<string | null>(null);
  // Per-tab video state
  const [videoStates, setVideoStates] = useState<Record<VariantKey, {
    taskId?: string;
    status?: string;
    url?: string;
    loading: boolean;
    error?: string;       // 人话错误描述，用于 UI 展示
    errorCode?: string;   // 原始 Seedance 错误码，用于分类
  }>>({} as Record<VariantKey, { taskId?: string; status?: string; url?: string; loading: boolean; error?: string; errorCode?: string }>);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) { router.push("/settings"); return; }
    setAccount(acc);
    const topics = getTopics();
    const found = topics.find((t) => t.id === topicId);
    if (!found) { router.push("/topics"); return; }
    setTopic(found);

    // 初始化产品选择：优先 topic 绑定的第一个，否则品牌第一个产品，否则空（通用）
    const initialProductId = found.productIds?.[0]
      || acc.products[0]?.id
      || "";
    setScriptProductId(initialProductId);

    const existing = getScripts().filter((s) => s.topicId === topicId);
    const map: Record<string, unknown> = {};
    const restoredVideoStates: Record<string, { taskId?: string; status?: string; url?: string; loading: boolean }> = {};
    for (const s of existing) {
      if (s.variant) {
        map[s.variant] = s;
        // 恢复已有视频（本地 URL，刷新页面还能看）
        if (s.videoUrl) {
          restoredVideoStates[s.variant] = {
            url: s.videoUrl,
            taskId: s.videoTaskId,
            status: "完成",
            loading: false,
          };
        }
      }
    }
    if (Object.keys(map).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setScripts(map as any);
    }
    if (Object.keys(restoredVideoStates).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setVideoStates(restoredVideoStates as any);
    }
  }, [topicId, router]);

  // 切产品时清空参考图选择（URL 不通用）
  useEffect(() => {
    setRefImageUrls([]);
  }, [scriptProductId]);

  async function generateAllVariants() {
    if (!account || !topic) return;
    setError(null);
    const allKeys = VARIANTS.map((v) => v.key);
    setLoadingVariants(new Set(allKeys));

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 150000);
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account,
          topic,
          productId: scriptProductId || undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();

      if (data.success && data.scripts) {
        const newScripts: Record<string, unknown> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const script of data.scripts as any[]) {
          if (script.variant) {
            newScripts[script.variant] = script;
            saveScript(script);
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setScripts(newScripts as any);
      } else {
        setError(data.error || "脚本生成失败");
      }
    } catch (err) {
      setError("请求失败：" + String(err));
    } finally {
      setLoadingVariants(new Set());
    }
  }

  async function generateSceneImage(key: string, visual: string) {
    setGeneratingScene(key);
    try {
      const res = await fetch("/api/generate-storyboard-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visual, aspectRatio: "9:16" }),
      });
      const data = await res.json();
      if (data.success && data.image?.dataUrl) {
        setSceneImages((prev) => ({ ...prev, [key]: data.image.dataUrl }));
      }
    } catch { /* ignore */ }
    finally { setGeneratingScene(null); }
  }

  function updateVideoState(tab: VariantKey, updates: Partial<{ taskId: string; status: string; url: string; loading: boolean; error: string; errorCode: string }>) {
    setVideoStates((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], ...updates },
    }));
  }

  async function generateVideo() {
    const tab = activeTab;
    const script = scripts[tab];
    if (!script?.scenes) return;
    // 重试时清掉上一轮的错误
    setVideoStates((prev) => ({
      ...prev,
      [tab]: { loading: true, status: "提交视频生成...", url: undefined, error: undefined, errorCode: undefined },
    }));

    try {
      // 当前选中产品（跟脚本主推产品一致）
      const focusProduct = scriptProductId
        ? account?.products.find((p) => p.id === scriptProductId)
        : undefined;
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: script.scenes,
          aspectRatio: "9:16",
          variant: tab,
          referenceImages: useRefImages ? refImageUrls : [],
          productName: focusProduct?.name || account?.products?.[0]?.name || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success || !data.task?.taskId) {
        setError(data.error || "提交失败");
        updateVideoState(tab, { loading: false });
        return;
      }

      updateVideoState(tab, { taskId: data.task.taskId, status: "视频生成中..." });
      const videoUrl = await pollVideoUntilDone(tab, data.task.taskId);
      if (!videoUrl) return;

      updateVideoState(tab, { url: videoUrl, status: "完成", loading: false });

      // 持久化：把视频成片 + 当时的 prompt / 参考图 / 时间戳全部快照到 Script
      // —— 历史页直接从这些字段读
      if (script && script.id) {
        const updatedScript = {
          ...script,
          videoUrl,
          videoTaskId: data.task.taskId,
          videoPrompt: data.prompt || undefined,
          videoReferenceImages: Array.isArray(data.referenceImages) ? data.referenceImages : undefined,
          videoGeneratedAt: new Date().toISOString(),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        saveScript(updatedScript as any);
        setScripts((prev) => ({ ...prev, [tab]: updatedScript }));
      }
    } catch (err) {
      setError(String(err));
      updateVideoState(tab, { loading: false });
    }
  }

  async function pollVideoUntilDone(tab: VariantKey, taskId: string): Promise<string | null> {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await fetch(`/api/video-status?taskId=${encodeURIComponent(taskId)}`);
        const data = await res.json();
        if (data.task?.status === "succeed" && data.task.videoUrl) {
          return data.task.videoUrl;
        } else if (data.task?.status === "failed") {
          const errorCode: string | undefined = data.task?.errorCode;
          const statusMsg: string | undefined = data.task?.statusMsg;
          const friendly = friendlyVideoError(errorCode, statusMsg);
          updateVideoState(tab, {
            status: "视频生成失败",
            loading: false,
            error: friendly,
            errorCode,
          });
          return null;
        }
        updateVideoState(tab, { status: data.task?.status === "processing" ? "视频生成中..." : "排队中..." });
      } catch { /* retry */ }
    }
    updateVideoState(tab, {
      status: "超时",
      loading: false,
      error: "视频生成超过 10 分钟，请重试或换用 less 张参考图。",
    });
    return null;
  }

  // Seedance 错误码 → 用户友好描述
  function friendlyVideoError(code: string | undefined, msg: string | undefined): string {
    if (!code && !msg) return "生成失败，请重试";
    const c = code || "";
    if (c.includes("Sensitive") || c.includes("PolicyViolation") || c.includes("Copyright")) {
      return "Seedance 风控判定输出可能涉及版权（多张高清品牌产品图易触发）。建议：少选几张参考图（试试 2-3 张），或换更抽象的角度（不要全是产品本体特写）。";
    }
    if (c.includes("Image") && (c.includes("Fetch") || c.includes("NotFound"))) {
      return "Seedance 无法访问参考图。如果是本地上传的图，确认图床/OSS 公网可达。";
    }
    if (c.includes("InvalidParameter")) {
      return `参数错误：${msg || c}`;
    }
    return msg || `生成失败（${c || "未知"}）`;
  }

  if (!topic || !account) return null;

  const activeScript = scripts[activeTab];
  const isGenerating = loadingVariants.size > 0;

  return (
    <div className="max-w-4xl">
      <Button onClick={() => router.push("/topics")} variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
        ← 返回选题列表
      </Button>

      {/* Topic header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[topic.type] || ""}`}>
              {TOPIC_TYPE_LABELS[topic.type] || topic.type}
            </span>
          </div>
          <h1 className="text-xl font-bold">{topic.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{topic.angle}</p>
        </div>
        <div className="flex items-center gap-2">
          {account.products.length > 0 && (
            <div className="flex flex-col gap-0.5 items-end">
              <label className="text-[10px] text-muted-foreground">脚本主推产品</label>
              <select
                value={scriptProductId}
                onChange={(e) => setScriptProductId(e.target.value)}
                disabled={isGenerating}
                data-testid="script-product-select"
                className="h-8 text-xs rounded-md border border-input bg-transparent px-2 cursor-pointer"
              >
                {account.products.map((p) => {
                  const isTopicBound = topic.productIds?.includes(p.id);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name}{isTopicBound ? " ★" : ""}
                    </option>
                  );
                })}
                <option value="">通用（不指定产品）</option>
              </select>
            </div>
          )}
          <Button onClick={generateAllVariants} disabled={isGenerating} size="sm">
            {isGenerating ? `生成中（${4 - loadingVariants.size}/4）...` : Object.keys(scripts).length > 0 ? "重新生成 4 组" : "生成 4 组脚本"}
          </Button>
        </div>
      </div>

      {/* Seedance 2.0 rule hint */}
      <div className="mb-4 p-2.5 rounded-md bg-muted/50 border text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Seedance 2.0：</span>
        分镜数 / 时长 AI 按内容自由发挥（建议 5~8 分镜、10~12 秒，4~15 秒皆可）· 原生 lip-sync + 音频 · 单 prompt 串联
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      {/* Variant tabs */}
      <div className="flex items-center border-b mb-6">
        {VARIANTS.map((v) => {
          const hasScript = !!scripts[v.key];
          const isLoading = loadingVariants.has(v.key);
          return (
            <button
              key={v.key}
              onClick={() => setActiveTab(v.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === v.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label}
              {isLoading && <span className="ml-1 text-xs animate-pulse">⏳</span>}
              {hasScript && !isLoading && <span className="ml-1 text-xs text-green-600">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Script content */}
      {activeScript ? (
        <div className="space-y-6">
          {(activeScript.concept || activeScript.creativeApproach) && (
            <div className="rounded-lg border overflow-hidden">
              {activeScript.concept && (
                <div className="p-4 bg-gradient-to-r from-violet-50 to-blue-50 border-b">
                  <p className="text-xs font-semibold text-violet-800 mb-1.5">AI 创意概念（Step 1: 自由构思）</p>
                  <p className="text-sm text-violet-900 leading-relaxed whitespace-pre-wrap">{activeScript.concept}</p>
                </div>
              )}
              {activeScript.creativeApproach && (
                <div className="p-3 bg-amber-50/50">
                  <p className="text-xs font-semibold text-amber-800 mb-0.5">创意核心</p>
                  <p className="text-sm text-amber-900">{activeScript.creativeApproach}</p>
                </div>
              )}
            </div>
          )}

          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">视频标题</p>
                  <p className="text-sm font-semibold">{activeScript.title}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">时长</p>
                  <p className="text-sm font-medium">{activeScript.totalDuration}秒</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">音乐</p>
                  <p className="text-sm">{activeScript.musicStyle}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">标签</p>
                  <div className="flex flex-wrap gap-1">
                    {activeScript.hashtags?.map((tag: string, i: number) => (
                      <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted">#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {activeScript.hook && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Hook</CardTitle></CardHeader>
              <CardContent>
                <p className="text-base font-semibold text-primary">{activeScript.hook}</p>
              </CardContent>
            </Card>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">分镜表</h2>
            </div>

            <div className="rounded-lg border overflow-x-auto">
              <table className="min-w-[900px] w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-3 py-2 w-14">镜号</th>
                    <th className="px-3 py-2 w-14">秒</th>
                    <th className="px-3 py-2 w-28">镜头类型</th>
                    <th className="px-3 py-2 min-w-[300px]">画面</th>
                    <th className="px-3 py-2 min-w-[120px]">音效/音乐</th>
                    <th className="px-3 py-2 min-w-[140px]">口播</th>
                    <th className="px-3 py-2 w-14 text-center">图</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeScript.scenes?.map((scene: Record<string, string | number>, i: number) => {
                    const sn = Number(scene.sceneNumber);
                    const imgKey = `${activeTab}_${sn}`;
                    const img = sceneImages[imgKey];
                    const visual = String(scene.visual || "");
                    const audio = String(scene.audio || "");

                    return (
                      <tr key={i} className="hover:bg-muted/20 align-top">
                        <td className="px-3 py-2.5 font-bold">P{sn}</td>
                        <td className="px-3 py-2.5">{scene.duration}s</td>
                        <td className="px-3 py-2.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {scene.shotType || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{visual}</p>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          <p className="text-[11px] leading-relaxed">{audio}</p>
                        </td>
                        <td className="px-3 py-2.5 font-medium">{scene.text || <span className="text-muted-foreground italic">无</span>}</td>
                        <td className="px-3 py-2.5 text-center">
                          {img ? (
                            <img src={img} alt={`P${sn}`} className="w-10 h-14 object-cover rounded mx-auto" />
                          ) : (
                            <button
                              onClick={() => generateSceneImage(imgKey, visual)}
                              disabled={generatingScene !== null}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
                            >
                              {generatingScene === imgKey ? "..." : "生成"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>

          {activeScript.fullText && activeScript.fullText !== "（音乐卡点版，无口播）" && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">完整口播稿</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{activeScript.fullText}</p>
              </CardContent>
            </Card>
          )}

          {activeScript.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">导演备注</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{activeScript.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Video */}
          {(() => {
            const vs = videoStates[activeTab] || { loading: false };
            const isVoiceover = activeTab.endsWith("voiceover");
            const focusProduct = scriptProductId
              ? account?.products.find((p) => p.id === scriptProductId)
              : undefined;
            const availableImages = focusProduct?.imagePaths || [];
            const toggleRefImage = (url: string) => {
              setRefImageUrls((prev) => {
                if (prev.includes(url)) return prev.filter((u) => u !== url);
                if (prev.length >= MAX_REF_IMAGES) return prev; // 已满
                return [...prev, url];
              });
            };
            return (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm">视频 Demo</CardTitle>
                    <Button onClick={generateVideo} disabled={vs.loading} size="sm" variant={vs.url ? "outline" : "default"}>
                      {vs.loading ? vs.status : vs.url ? "重新生成" : "生成视频（Seedance 2.0）"}
                    </Button>
                  </div>
                  {/* 参考产品图（可选，最多 9 张） */}
                  {availableImages.length > 0 && (
                    <div className="mt-3 space-y-2" data-testid="ref-images-panel">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useRefImages}
                          onChange={(e) => {
                            setUseRefImages(e.target.checked);
                            if (!e.target.checked) setRefImageUrls([]);
                          }}
                          data-testid="ref-images-toggle"
                        />
                        <span>参考产品图（Seedance 智能参考，最多 9 张）</span>
                        {useRefImages && refImageUrls.length > 0 && (
                          <span className="text-muted-foreground">已选 {refImageUrls.length}/{MAX_REF_IMAGES}</span>
                        )}
                      </label>
                      {useRefImages && (
                        <div className="flex gap-2 flex-wrap" data-testid="ref-images-grid">
                          {availableImages.map((img, idx) => {
                            const selected = refImageUrls.includes(img);
                            const atLimit = !selected && refImageUrls.length >= MAX_REF_IMAGES;
                            return (
                              <button
                                key={idx}
                                onClick={() => toggleRefImage(img)}
                                disabled={atLimit}
                                className={`relative w-14 h-14 rounded border-2 overflow-hidden transition-all cursor-pointer ${
                                  selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-foreground/40"
                                } ${atLimit ? "opacity-40 cursor-not-allowed" : ""}`}
                                data-testid={`ref-image-${idx}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img} alt={`ref ${idx + 1}`} className="w-full h-full object-cover" />
                                {selected && (
                                  <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                                    {refImageUrls.indexOf(img) + 1}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {vs.url ? (
                    <div className="space-y-3">
                      <video src={vs.url} controls className="w-full max-w-sm mx-auto rounded-lg shadow-lg" playsInline />
                      <div className="flex justify-center gap-3">
                        <a href={vs.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline">新窗口 ↗</a>
                        <a href={vs.url} download className="text-xs text-muted-foreground hover:underline">下载</a>
                      </div>
                    </div>
                  ) : vs.loading ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">{vs.status}</p>
                    </div>
                  ) : vs.error ? (
                    <div className="py-4 px-3 rounded-md bg-destructive/5 border border-destructive/30 text-sm" data-testid="video-error-banner">
                      <div className="flex items-start gap-2">
                        <span className="text-destructive shrink-0">⚠</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-destructive">视频生成失败</p>
                          <p className="text-foreground/80 mt-1 text-xs leading-relaxed">{vs.error}</p>
                          {vs.errorCode && (
                            <p className="text-muted-foreground mt-1 text-[10px] font-mono">code: {vs.errorCode}</p>
                          )}
                          <Button
                            onClick={generateVideo}
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs cursor-pointer"
                            disabled={vs.loading}
                          >
                            重新尝试
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">基于当前 tab 的分镜生成视频</p>
                  )}

                  <details>
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      查看发送给 Seedance 2.0 的实际提示词
                    </summary>
                    <div className="mt-2 rounded-lg bg-slate-950 text-slate-200 p-4 space-y-3">
                      {(() => {
                        const { prompt, totalDuration } = buildSeedancePrompt({
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          scenes: (activeScript.scenes || []) as any,
                          isVoiceover,
                          productName: account?.products?.[0]?.name,
                        });
                        return (
                          <>
                            <p className="text-[10px] text-slate-400">单 prompt 串联多镜头 · 总时长 {totalDuration}s · {isVoiceover ? "原生口播 lip-sync" : "无口播"}</p>
                            <p className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap">{prompt}</p>
                          </>
                        );
                      })()}
                    </div>
                  </details>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      ) : loadingVariants.has(activeTab) ? (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {VARIANTS.find((v) => v.key === activeTab)?.desc}...
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-sm mb-2">点击"生成 4 组脚本"，AI 将并行创作 4 种风格：</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {VARIANTS.map((v) => (
                <span key={v.key} className="text-xs px-2.5 py-1 rounded-full bg-muted">{v.label}：{v.desc}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
