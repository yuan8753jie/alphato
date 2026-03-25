"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getAccount, getTopics, saveTopics,
  getTrends, saveTrends, isTrendsStale,
} from "@/lib/store";
import type { Account, Topic, TopicStatus, Trend } from "@/lib/types";

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
  const [trends, setTrends] = useState<Trend[]>([]);
  const [trendsDate, setTrendsDate] = useState<string | null>(null);
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

    const { trends: savedTrends, date } = getTrends();
    setTrends(savedTrends);
    setTrendsDate(date);
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
        saveTrends(data.trends);
        setTrendsDate(new Date().toISOString().split("T")[0]);
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

  if (!account) return null;

  const stale = isTrendsStale();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">选题中心</h1>
          <p className="text-muted-foreground mt-1">
            {account.brand.name} · {account.brand.industry}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={fetchTrends}
            disabled={loading === "trends"}
            variant={stale ? "default" : "outline"}
            size="sm"
          >
            {loading === "trends" ? "搜索中..." : stale ? "抓取今日热点" : "重新抓取热点"}
          </Button>
          {trends.length > 0 && (
            <Button
              onClick={generateTopics}
              disabled={loading === "topics"}
              size="sm"
            >
              {loading === "topics" ? "生成中..." : "生成选题"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Left: Trends panel */}
        <div className="col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">热点池</CardTitle>
                {trendsDate && (
                  <span className="text-xs text-muted-foreground">{trendsDate}</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {trends.length > 0 ? (
                <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto">
                  {trends.map((trend, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg border text-sm hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-sm leading-snug">
                          {trend.title}
                        </span>
                        {trend.heatScore && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {trend.heatScore}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {trend.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  点击"抓取今日热点"开始
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Topics panel */}
        <div className="col-span-8">
          {topics.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  选题列表（{topics.length}）
                </h2>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>采用 {topics.filter((t) => t.status === "approved").length}</span>
                  <span>待定 {topics.filter((t) => t.status === "pending").length}</span>
                  <span>留存 {topics.filter((t) => t.status === "hold").length}</span>
                </div>
              </div>

              {topics.map((topic) => (
                <Card key={topic.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/topics/${topic.id}`}
                            className="font-medium hover:underline truncate"
                          >
                            {topic.title}
                          </Link>
                          <Badge
                            variant={STATUS_CONFIG[topic.status].variant}
                            className="shrink-0"
                          >
                            {STATUS_CONFIG[topic.status].label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {topic.angle}
                        </p>
                        <p className="text-sm mt-1 line-clamp-2">
                          {topic.description}
                        </p>
                        {topic.relatedTrend && (
                          <p className="text-xs text-muted-foreground mt-1">
                            热点：{topic.relatedTrend}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant={topic.status === "approved" ? "default" : "ghost"}
                          className="h-7 px-2 text-xs"
                          onClick={() => updateTopicStatus(topic.id, "approved")}
                        >
                          采用
                        </Button>
                        <Button
                          size="sm"
                          variant={topic.status === "hold" ? "secondary" : "ghost"}
                          className="h-7 px-2 text-xs"
                          onClick={() => updateTopicStatus(topic.id, "hold")}
                        >
                          留存
                        </Button>
                        <Button
                          size="sm"
                          variant={topic.status === "rejected" ? "destructive" : "ghost"}
                          className="h-7 px-2 text-xs"
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
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">
                  {trends.length > 0
                    ? "热点已就绪，点击\"生成选题\"让 AI 为你策划内容"
                    : "先抓取今日热点，再生成选题"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
