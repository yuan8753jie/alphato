"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAccount, getTopics, getScripts, saveScript } from "@/lib/store";
import type { Account, Topic, Script } from "@/lib/types";
import { TOPIC_TYPE_LABELS } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  traffic: "bg-red-100 text-red-800",
  trust: "bg-blue-100 text-blue-800",
  conversion: "bg-green-100 text-green-800",
  persona: "bg-purple-100 text-purple-800",
};

export default function TopicDetailPage() {
  const router = useRouter();
  const params = useParams();
  const topicId = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [script, setScript] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneImages, setSceneImages] = useState<Record<number, string>>({});
  const [generatingScene, setGeneratingScene] = useState<number | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) { router.push("/settings"); return; }
    setAccount(acc);

    const topics = getTopics();
    const found = topics.find((t) => t.id === topicId);
    if (!found) { router.push("/topics"); return; }
    setTopic(found);

    const scripts = getScripts();
    const existing = scripts.find((s) => s.topicId === topicId);
    if (existing) setScript(existing);
  }, [topicId, router]);

  async function generateScript() {
    if (!account || !topic) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, topic }),
      });
      const data = await res.json();
      if (data.success && data.script) {
        setScript(data.script);
        saveScript(data.script);
      } else {
        setError(data.error || "脚本生成失败");
      }
    } catch (err) {
      setError("请求失败：" + String(err));
    } finally {
      setLoading(false);
    }
  }

  async function generateSceneImage(sceneNumber: number, visual: string) {
    setGeneratingScene(sceneNumber);
    try {
      const res = await fetch("/api/generate-storyboard-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visual, sceneNumber, aspectRatio: "9:16" }),
      });
      const data = await res.json();
      if (data.success && data.image?.dataUrl) {
        setSceneImages((prev) => ({ ...prev, [sceneNumber]: data.image.dataUrl }));
      }
    } catch { /* ignore */ }
    finally { setGeneratingScene(null); }
  }

  async function generateAllImages() {
    if (!script?.scenes) return;
    setGeneratingAll(true);
    for (const scene of script.scenes) {
      if (!sceneImages[scene.sceneNumber]) {
        await generateSceneImage(scene.sceneNumber, scene.visual);
      }
    }
    setGeneratingAll(false);
  }

  if (!topic || !account) return null;

  return (
    <div className="max-w-4xl">
      {/* Back + header */}
      <Button onClick={() => router.push("/topics")} variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
        ← 返回选题列表
      </Button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[topic.type] || ""}`}>
              {TOPIC_TYPE_LABELS[topic.type] || topic.type}
            </span>
            <Badge variant="outline" className="text-xs">{topic.status}</Badge>
          </div>
          <h1 className="text-xl font-bold">{topic.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{topic.angle}</p>
          <p className="text-sm mt-2">{topic.description}</p>
        </div>
        <Button onClick={generateScript} disabled={loading} size="sm">
          {loading ? "AI 编导创作中..." : script ? "重新生成" : "生成脚本"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      {script ? (
        <div className="space-y-6">
          {/* Script overview */}
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">视频标题</p>
                  <p className="text-sm font-semibold">{script.title}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">总时长</p>
                  <p className="text-sm font-medium">{script.totalDuration}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">背景音乐</p>
                  <p className="text-sm">{script.musicStyle}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">话题标签</p>
                  <div className="flex flex-wrap gap-1">
                    {script.hashtags?.map((tag: string, i: number) => (
                      <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted">#{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hook */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Hook（前 3 秒）</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base font-semibold text-primary">{script.hook}</p>
            </CardContent>
          </Card>

          {/* Storyboard */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">分镜表</h2>
              {script.scenes?.length > 0 && (
                <Button
                  onClick={generateAllImages}
                  disabled={generatingAll || generatingScene !== null}
                  variant="outline"
                  size="sm"
                >
                  {generatingAll ? `生成中（${Object.keys(sceneImages).length}/${script.scenes.length}）...` : "生成全部分镜图"}
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {script.scenes?.map((scene: Record<string, string | number>, i: number) => {
                const sn = Number(scene.sceneNumber);
                const img = sceneImages[sn];
                const isGenerating = generatingScene === sn;

                return (
                  <Card key={i} className="overflow-hidden">
                    <div className="flex">
                      {/* Left: scene image or number */}
                      <div className="w-28 bg-muted flex flex-col items-center justify-center shrink-0 relative">
                        {img ? (
                          <img src={img} alt={`P${sn}`} className="w-full h-full object-cover" />
                        ) : isGenerating ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-[10px] text-muted-foreground">生成中</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-lg font-bold">P{sn}</span>
                            <span className="text-[10px] text-muted-foreground">{scene.duration}</span>
                            <button
                              onClick={() => generateSceneImage(sn, String(scene.visual))}
                              disabled={generatingScene !== null}
                              className="mt-1 text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              生成图
                            </button>
                          </div>
                        )}
                        {img && (
                          <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">
                            P{sn} · {scene.duration}
                          </div>
                        )}
                      </div>

                      <CardContent className="flex-1 py-3 px-4 space-y-2">
                        {/* Visual / Kling prompt */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-semibold text-muted-foreground">画面 / 视频生成提示词</span>
                            <Badge variant="outline" className="text-[9px] h-4">Kling Prompt</Badge>
                          </div>
                          <div className="rounded-lg bg-slate-950 text-slate-200 p-3">
                            <p className="text-xs leading-relaxed font-mono whitespace-pre-wrap">{scene.visual}</p>
                          </div>
                        </div>

                        {/* Audio + Text row */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">声音</p>
                            <p className="text-xs text-muted-foreground">{scene.audio}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">字幕 / 口播</p>
                            <p className="text-xs font-medium">{scene.text}</p>
                          </div>
                        </div>

                        {/* Transition */}
                        {scene.transition && (
                          <p className="text-[10px] text-muted-foreground">转场：{scene.transition}</p>
                        )}
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Full voiceover */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">完整口播稿</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{script.fullText}</p>
            </CardContent>
          </Card>

          {/* Director notes */}
          {script.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">导演备注</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{script.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-sm mb-4">点击"生成脚本"，AI 编导将创作完整的短视频脚本和分镜表</p>
            <p className="text-xs text-muted-foreground">每个分镜的画面描述将自动优化为 AI 视频生成提示词</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
