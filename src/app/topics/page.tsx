"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAccount, getTopics, saveTopics } from "@/lib/store";
import type { Account, Topic, TopicStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  TopicStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "待定", variant: "outline" },
  approved: { label: "采用", variant: "default" },
  rejected: { label: "放弃", variant: "destructive" },
  hold: { label: "留存", variant: "secondary" },
};

export default function TopicsPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [trends, setTrends] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState<"trends" | "topics" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) {
      router.push("/setup");
      return;
    }
    setAccount(acc);
    setTopics(getTopics());
  }, [router]);

  async function fetchTrends() {
    if (!account) return;
    setLoading("trends");
    setError(null);

    try {
      const res = await fetch("/api/fetch-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: account.brand.industry,
          platform: account.platform,
        }),
      });

      const data = await res.json();
      if (data.success && data.trends?.length > 0) {
        setTrends(data.trends);
      } else {
        setError(data.error || "未获取到热点，请重试");
      }
    } catch (err) {
      setError("请求失败：" + String(err));
    } finally {
      setLoading(null);
    }
  }

  async function generateTopics() {
    if (!account || trends.length === 0) return;
    setLoading("topics");
    setError(null);

    try {
      const res = await fetch("/api/generate-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, trends }),
      });

      const data = await res.json();
      if (data.success && data.topics?.length > 0) {
        const newTopics = [...data.topics, ...topics];
        setTopics(newTopics);
        saveTopics(newTopics);
      } else {
        setError(data.error || "选题生成失败，请重试");
      }
    } catch (err) {
      setError("请求失败：" + String(err));
    } finally {
      setLoading(null);
    }
  }

  function updateTopicStatus(id: string, status: TopicStatus) {
    const updated = topics.map((t) =>
      t.id === id ? { ...t, status } : t
    );
    setTopics(updated);
    saveTopics(updated);
  }

  function clearTopics() {
    setTopics([]);
    saveTopics([]);
  }

  if (!account) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">今日选题</h1>
            <p className="text-muted-foreground mt-1">
              {account.brand.name} · {account.brand.industry}
            </p>
          </div>
          <Button onClick={() => router.push("/")} variant="outline">
            返回首页
          </Button>
        </div>

        {/* Step 1: Fetch trends */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">第一步：抓取今日热点</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <Button
                onClick={fetchTrends}
                disabled={loading === "trends"}
              >
                {loading === "trends" ? "正在搜索热点..." : "搜索今日热点"}
              </Button>
              {trends.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  已获取 {trends.length} 个热点
                </span>
              )}
            </div>

            {trends.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {trends.map((trend, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-2 rounded border text-sm"
                  >
                    <span className="text-muted-foreground shrink-0">
                      {i + 1}.
                    </span>
                    <div>
                      <span className="font-medium">{trend.title}</span>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {trend.description}
                      </p>
                    </div>
                    {trend.heatScore && (
                      <Badge variant="secondary" className="shrink-0 ml-auto">
                        热度 {trend.heatScore}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Generate topics */}
        {trends.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">第二步：生成选题</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={generateTopics}
                disabled={loading === "topics"}
              >
                {loading === "topics"
                  ? "AI 正在策划选题..."
                  : "基于热点生成选题"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Error display */}
        {error && (
          <div className="mb-6 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Topics list */}
        {topics.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                选题列表（{topics.length}）
              </h2>
              <Button variant="ghost" size="sm" onClick={clearTopics}>
                清空
              </Button>
            </div>

            {topics.map((topic) => (
              <Card key={topic.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{topic.title}</h3>
                        <Badge variant={STATUS_CONFIG[topic.status].variant}>
                          {STATUS_CONFIG[topic.status].label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {topic.angle}
                      </p>
                      <p className="text-sm">{topic.description}</p>
                      {topic.relatedTrend && (
                        <p className="text-xs text-muted-foreground">
                          关联热点：{topic.relatedTrend}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant={
                          topic.status === "approved" ? "default" : "outline"
                        }
                        onClick={() => updateTopicStatus(topic.id, "approved")}
                      >
                        采用
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          topic.status === "hold" ? "secondary" : "outline"
                        }
                        onClick={() => updateTopicStatus(topic.id, "hold")}
                      >
                        留存
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          topic.status === "rejected"
                            ? "destructive"
                            : "outline"
                        }
                        onClick={() => updateTopicStatus(topic.id, "rejected")}
                      >
                        放弃
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
