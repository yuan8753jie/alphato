"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getAccount, getTopics, getScripts, saveScript } from "@/lib/store";
import type { Account, Topic, Script } from "@/lib/types";

export default function TopicDetailPage() {
  const router = useRouter();
  const params = useParams();
  const topicId = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) {
      router.push("/setup");
      return;
    }
    setAccount(acc);

    const topics = getTopics();
    const found = topics.find((t) => t.id === topicId);
    if (!found) {
      router.push("/topics");
      return;
    }
    setTopic(found);

    const scripts = getScripts();
    const existingScript = scripts.find((s) => s.topicId === topicId);
    if (existingScript) setScript(existingScript);
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
        setError(data.error || "脚本生成失败，请重试");
      }
    } catch (err) {
      setError("请求失败：" + String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!topic || !account) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => router.push("/topics")} variant="outline">
            返回选题列表
          </Button>
        </div>

        {/* Topic info */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{topic.title}</CardTitle>
              <Badge variant="outline">{topic.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">切入角度：</span>
              {topic.angle}
            </p>
            <p className="text-sm">{topic.description}</p>
            {topic.relatedTrend && (
              <p className="text-xs text-muted-foreground">
                关联热点：{topic.relatedTrend}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Script section */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">短视频脚本</h2>
          <Button onClick={generateScript} disabled={loading}>
            {loading
              ? "AI 编导创作中..."
              : script
                ? "重新生成脚本"
                : "生成脚本"}
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {script && (
          <div className="space-y-4">
            {/* Script overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{script.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {script.hashtags?.map((tag: string, i: number) => (
                    <Badge key={i} variant="secondary">
                      #{tag}
                    </Badge>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">总时长：</span>
                    {script.totalDuration}
                  </div>
                  <div>
                    <span className="text-muted-foreground">音乐风格：</span>
                    {script.musicStyle}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Hook（前3秒）：</span>
                  <p className="text-sm font-medium mt-1">{script.hook}</p>
                </div>
              </CardContent>
            </Card>

            {/* Storyboard */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">分镜表</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {script.scenes?.map((scene: Record<string, string | number>) => (
                    <div
                      key={scene.sceneNumber}
                      className="border rounded-lg p-4"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <Badge variant="outline">
                          P{scene.sceneNumber}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {scene.duration}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">画面</p>
                          <p>{scene.visual}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">声音</p>
                          <p>{scene.audio}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">文案/字幕</p>
                          <p className="font-medium">{scene.text}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Full text */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">完整口播稿</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {script.fullText}
                </p>
              </CardContent>
            </Card>

            {/* Notes */}
            {script.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">导演备注</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {script.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
