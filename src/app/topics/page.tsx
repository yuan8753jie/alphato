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
import type {
  Account, Topic, TopicStatus, TopicType, Trend, TrendCategory,
} from "@/lib/types";
import { TREND_CATEGORY_LABELS, TOPIC_TYPE_LABELS } from "@/lib/types";

const STATUS_VARIANT: Record<TopicStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", approved: "default", rejected: "destructive", hold: "secondary",
};
const STATUS_LABEL: Record<TopicStatus, string> = {
  pending: "待定", approved: "采用", rejected: "放弃", hold: "留存",
};

const TYPE_COLORS: Record<TopicType, string> = {
  traffic: "bg-red-100 text-red-700",
  trust: "bg-blue-100 text-blue-700",
  conversion: "bg-green-100 text-green-700",
  persona: "bg-purple-100 text-purple-700",
};

export default function TopicsPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [trendsDate, setTrendsDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<"trends" | "topics" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTrendCategory, setActiveTrendCategory] = useState<TrendCategory | "all">("all");

  useEffect(() => {
    const acc = getAccount();
    if (!acc) { router.push("/setup"); return; }
    setAccount(acc);
    setTopics(getTopics());
    const { trends: saved, date } = getTrends();
    setTrends(saved);
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
          brandName: account.brand.name,
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
    const updated = topics.map((t) => t.id === id ? { ...t, status } : t);
    setTopics(updated);
    saveTopics(updated);
  }

  if (!account) return null;

  const stale = isTrendsStale();

  // Group trends by category
  const trendsByCategory: Record<string, Trend[]> = {};
  for (const t of trends) {
    const cat = t.category || "other";
    if (!trendsByCategory[cat]) trendsByCategory[cat] = [];
    trendsByCategory[cat].push(t);
  }
  const categoryKeys = Object.keys(trendsByCategory) as TrendCategory[];

  const filteredTrends = activeTrendCategory === "all"
    ? trends
    : trends.filter((t) => t.category === activeTrendCategory);

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
            {loading === "trends" ? "搜索中（约30秒）..." : stale ? "抓取今日热点" : "重新抓取热点"}
          </Button>
          {trends.length > 0 && (
            <Button onClick={generateTopics} disabled={loading === "topics"} size="sm">
              {loading === "topics" ? "生成中..." : "生成选题"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Left: Trend pool */}
        <div className="col-span-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  热点池
                  {trends.length > 0 && <span className="text-muted-foreground font-normal ml-2 text-sm">({trends.length})</span>}
                </CardTitle>
                {trendsDate && <span className="text-xs text-muted-foreground">{trendsDate}</span>}
              </div>
            </CardHeader>
            <CardContent>
              {trends.length > 0 ? (
                <>
                  {/* Category filter tabs */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    <button
                      className={`px-2 py-0.5 rounded text-xs transition-colors ${activeTrendCategory === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                      onClick={() => setActiveTrendCategory("all")}
                    >
                      全部 ({trends.length})
                    </button>
                    {categoryKeys.map((cat) => (
                      <button
                        key={cat}
                        className={`px-2 py-0.5 rounded text-xs transition-colors ${activeTrendCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                        onClick={() => setActiveTrendCategory(cat)}
                      >
                        {TREND_CATEGORY_LABELS[cat] || cat} ({trendsByCategory[cat].length})
                      </button>
                    ))}
                  </div>

                  {/* Trend list */}
                  <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
                    {filteredTrends.map((trend) => (
                      <div key={trend.id} className="p-2.5 rounded-lg border text-sm hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-sm leading-snug">{trend.title}</span>
                          <Badge variant="secondary" className="shrink-0 text-xs">{trend.heatScore}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{trend.description}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
                            {TREND_CATEGORY_LABELS[trend.category] || trend.category}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{trend.source}</span>
                          {trend.eventDate && (
                            <span className="text-[10px] text-muted-foreground">📅 {trend.eventDate}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  点击"抓取今日热点"开始<br />
                  <span className="text-xs">AI 将搜索实时热搜、行业新闻、预测事件、冷知识等</span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Topic pool */}
        <div className="col-span-8">
          {topics.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">选题池（{topics.length}）</h2>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {(["traffic", "trust", "conversion", "persona"] as TopicType[]).map((type) => {
                    const count = topics.filter((t) => t.type === type).length;
                    return count > 0 ? (
                      <span key={type} className={`px-1.5 py-0.5 rounded ${TYPE_COLORS[type]}`}>
                        {TOPIC_TYPE_LABELS[type]} {count}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              {topics.map((topic) => (
                <Card key={topic.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Link href={`/topics/${topic.id}`} className="font-medium hover:underline">
                            {topic.title}
                          </Link>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_COLORS[topic.type] || ""}`}>
                            {TOPIC_TYPE_LABELS[topic.type] || topic.type}
                          </span>
                          <Badge variant={STATUS_VARIANT[topic.status]} className="text-xs">
                            {STATUS_LABEL[topic.status]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{topic.angle}</p>
                        <p className="text-sm mt-1 line-clamp-2">{topic.description}</p>
                        {topic.estimatedAppeal && (
                          <p className="text-xs text-muted-foreground mt-1">
                            吸引力：{topic.estimatedAppeal}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {(["approved", "hold", "rejected"] as TopicStatus[]).map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={topic.status === s ? (s === "rejected" ? "destructive" : s === "hold" ? "secondary" : "default") : "ghost"}
                            className="h-7 px-2 text-xs"
                            onClick={() => updateTopicStatus(topic.id, s)}
                          >
                            {STATUS_LABEL[s]}
                          </Button>
                        ))}
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
                    ? "热点已就绪，点击\"生成选题\"让 AI 按 流量型/信任型/转化型/人设型 策划内容"
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
