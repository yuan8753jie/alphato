"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAccount, getTopics, getScripts, saveScript } from "@/lib/store";
import type { Account, Topic } from "@/lib/types";
import { TOPIC_TYPE_LABELS } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  traffic: "bg-red-100 text-red-800",
  trust: "bg-blue-100 text-blue-800",
  conversion: "bg-green-100 text-green-800",
  persona: "bg-purple-100 text-purple-800",
};

const VARIANTS = [
  { key: "free-voiceover", label: "口播", desc: "随意发挥 + 有台词旁白" },
  { key: "free-music", label: "音乐卡点", desc: "随意发挥 + 纯音乐节奏驱动" },
  { key: "creative-voiceover", label: "超创意口播", desc: "创造性方法论 + 有台词" },
  { key: "creative-music", label: "超创意卡点", desc: "创造性方法论 + 纯音乐" },
] as const;

type VariantKey = typeof VARIANTS[number]["key"];

export default function TopicDetailPage() {
  const router = useRouter();
  const params = useParams();
  const topicId = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
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
  }>>({} as Record<VariantKey, { taskId?: string; status?: string; url?: string; loading: boolean }>);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) { router.push("/settings"); return; }
    setAccount(acc);
    const topics = getTopics();
    const found = topics.find((t) => t.id === topicId);
    if (!found) { router.push("/topics"); return; }
    setTopic(found);

    // Load existing scripts for this topic
    const existing = getScripts().filter((s) => s.topicId === topicId);
    const map: Record<string, unknown> = {};
    for (const s of existing) {
      if (s.variant) map[s.variant] = s;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (Object.keys(map).length > 0) setScripts(map as any);
  }, [topicId, router]);

  async function generateAllVariants() {
    if (!account || !topic) return;
    setError(null);
    const allKeys = VARIANTS.map((v) => v.key);
    setLoadingVariants(new Set(allKeys));

    // Fire all 4 in parallel
    await Promise.allSettled(
      allKeys.map(async (variant) => {
        try {
          const res = await fetch("/api/generate-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ account, topic, variant }),
          });
          const data = await res.json();
          if (data.success && data.script) {
            setScripts((prev) => ({ ...prev, [variant]: data.script }));
            saveScript(data.script);
          }
        } catch { /* ignore */ }
        finally {
          setLoadingVariants((prev) => {
            const next = new Set(prev);
            next.delete(variant);
            return next;
          });
        }
      })
    );
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

  function updateVideoState(tab: VariantKey, updates: Partial<{ taskId: string; status: string; url: string; loading: boolean }>) {
    setVideoStates((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], ...updates },
    }));
  }

  async function generateVideo() {
    const tab = activeTab;
    const script = scripts[tab];
    if (!script?.scenes) return;
    const isMusic = tab.endsWith("music");
    updateVideoState(tab, { loading: true, status: "提交视频生成...", url: undefined });

    try {
      // Step 1: Generate video
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: script.scenes,
          aspectRatio: "9:16",
          variant: tab,
          productImage: account?.products?.[0]?.imagePaths?.[0] || undefined,
          productName: account?.products?.[0]?.name || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success || !data.task?.taskId) {
        setError(data.error || "提交失败");
        updateVideoState(tab, { loading: false });
        return;
      }

      updateVideoState(tab, { taskId: data.task.taskId, status: "视频生成中..." });
      const videoUrl = await pollVideoUntilDone(tab, data.task.taskId, data.useOmni);

      if (!videoUrl) return; // pollVideo already set error state

      // Step 2: If music variant, add BGM via video-to-audio API
      if (isMusic && videoUrl) {
        updateVideoState(tab, { status: "正在添加背景音乐..." });
        try {
          const bgmPrompt = script.musicStyle || "Upbeat energetic pop music with strong beats";
          const soundRes = await fetch("/api/add-sound", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoUrl,
              bgmPrompt,
              asmrMode: script.musicStyle?.toLowerCase().includes("asmr"),
            }),
          });
          const soundData = await soundRes.json();
          if (soundData.success && soundData.taskId) {
            updateVideoState(tab, { status: "音乐生成中..." });
            await pollSoundUntilDone(tab, soundData.taskId);
            return;
          }
        } catch { /* fall through to show video without music */ }
      }

      // For voiceover variants, just show the video
      updateVideoState(tab, { url: videoUrl, status: "完成", loading: false });
    } catch (err) {
      setError(String(err));
      updateVideoState(tab, { loading: false });
    }
  }

  async function pollVideoUntilDone(tab: VariantKey, taskId: string, useOmni?: boolean): Promise<string | null> {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await fetch(`/api/video-status?taskId=${taskId}${useOmni ? "&omni=true" : ""}`);
        const data = await res.json();
        if (data.task?.status === "succeed" && data.task.videoUrl) {
          return data.task.videoUrl;
        } else if (data.task?.status === "failed") {
          updateVideoState(tab, { status: "视频生成失败", loading: false });
          return null;
        }
        updateVideoState(tab, { status: data.task?.status === "processing" ? "视频生成中..." : "排队中..." });
      } catch { /* retry */ }
    }
    updateVideoState(tab, { status: "超时", loading: false });
    return null;
  }

  async function pollSoundUntilDone(tab: VariantKey, taskId: string) {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const res = await fetch(`/api/sound-status?taskId=${taskId}`);
        const data = await res.json();
        if (data.task?.status === "succeed" && data.task.videoUrl) {
          updateVideoState(tab, { url: data.task.videoUrl, status: "完成（含音乐）", loading: false });
          return;
        } else if (data.task?.status === "failed") {
          updateVideoState(tab, { status: "音乐添加失败", loading: false });
          return;
        }
        updateVideoState(tab, { status: "音乐生成中..." });
      } catch { /* retry */ }
    }
    updateVideoState(tab, { status: "音乐生成超时", loading: false });
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
        <Button onClick={generateAllVariants} disabled={isGenerating} size="sm">
          {isGenerating ? `生成中（${4 - loadingVariants.size}/4）...` : Object.keys(scripts).length > 0 ? "重新生成 4 组" : "生成 4 组脚本"}
        </Button>
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
          {/* Creative approach */}
          {activeScript.creativeApproach && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs font-semibold text-amber-800 mb-1">创意手法</p>
              <p className="text-sm text-amber-900">{activeScript.creativeApproach}</p>
            </div>
          )}

          {/* Overview */}
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

          {/* Hook */}
          {activeScript.hook && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Hook</CardTitle></CardHeader>
              <CardContent>
                <p className="text-base font-semibold text-primary">{activeScript.hook}</p>
              </CardContent>
            </Card>
          )}

          {/* Storyboard */}
          <div>
            <h2 className="text-base font-bold mb-3">分镜表</h2>
            <div className="space-y-3">
              {activeScript.scenes?.map((scene: Record<string, string | number>, i: number) => {
                const sn = Number(scene.sceneNumber);
                const imgKey = `${activeTab}_${sn}`;
                const img = sceneImages[imgKey];
                return (
                  <Card key={i} className="overflow-hidden">
                    <div className="flex">
                      <div className="w-24 bg-muted flex flex-col items-center justify-center shrink-0 relative">
                        {img ? (
                          <img src={img} alt={`P${sn}`} className="w-full h-full object-cover" />
                        ) : generatingScene === imgKey ? (
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-lg font-bold">P{sn}</span>
                            <span className="text-[10px] text-muted-foreground">{scene.duration}秒</span>
                            <button
                              onClick={() => generateSceneImage(imgKey, String(scene.visual))}
                              disabled={generatingScene !== null}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20"
                            >
                              生成图
                            </button>
                          </div>
                        )}
                        {img && <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded">P{sn}·{scene.duration}s</div>}
                      </div>
                      <CardContent className="flex-1 py-3 px-4 space-y-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-semibold text-muted-foreground">画面</span>
                            <Badge variant="outline" className="text-[9px] h-4">Kling</Badge>
                          </div>
                          <div className="rounded-lg bg-slate-950 text-slate-200 p-2.5">
                            <p className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap">{scene.visual}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">音频</p>
                            <p className="text-xs text-muted-foreground">{scene.audio}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">台词</p>
                            <p className="text-xs font-medium">{scene.text || <span className="text-muted-foreground italic">（无台词）</span>}</p>
                          </div>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Full text */}
          {activeScript.fullText && activeScript.fullText !== "（音乐卡点版，无口播）" && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">完整口播稿</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{activeScript.fullText}</p>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
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
            const vs = videoStates[activeTab] || {};
            return (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">视频 Demo</CardTitle>
                    <Button onClick={generateVideo} disabled={vs.loading} size="sm" variant={vs.url ? "outline" : "default"}>
                      {vs.loading ? vs.status : vs.url ? "重新生成" : "生成视频（可灵）"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
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
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">基于当前 tab 的分镜生成视频</p>
                  )}
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
