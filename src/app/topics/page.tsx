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
  Account, Topic, TopicStatus, TopicType, Trend, TrendSection,
} from "@/lib/types";
import {
  TREND_CATEGORY_LABELS, TREND_SECTION_LABELS,
  TOPIC_TYPE_LABELS,
} from "@/lib/types";

const STATUS_LABEL: Record<TopicStatus, string> = {
  pending: "待定", approved: "采用", rejected: "放弃", hold: "留存",
};
const STATUS_VARIANT: Record<TopicStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline", approved: "default", rejected: "destructive", hold: "secondary",
};
const TYPE_COLORS: Record<TopicType, string> = {
  traffic: "bg-red-100 text-red-800",
  trust: "bg-blue-100 text-blue-800",
  conversion: "bg-green-100 text-green-800",
  persona: "bg-purple-100 text-purple-800",
};

export default function TopicsPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [trendsDate, setTrendsDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) { router.push("/setup"); return; }
    setAccount(acc);
    setTopics(getTopics());
    const { trends: saved, date } = getTrends();
    setTrends(saved);
    setTrendsDate(date);
  }, [router]);

  async function fetchTrends(sections?: string[]) {
    if (!account) return;
    const label = sections ? sections.join("+") : "all";
    setLoading(`trends-${label}`);
    setError(null);

    try {
      const res = await fetch("/api/fetch-trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: account.brand.industry,
          platform: account.platform,
          brandName: account.brand.name,
          benchmarkAccounts: account.benchmarkAccounts,
          sections,
        }),
      });
      const data = await res.json();
      if (data.success && data.trends?.length > 0) {
        // Append if fetching specific sections, replace if fetching all
        if (sections) {
          const sectionSet = new Set(sections);
          const kept = trends.filter((t) => !sectionSet.has(t.section));
          const merged = [...kept, ...data.trends];
          setTrends(merged);
          saveTrends(merged);
        } else {
          setTrends(data.trends);
          saveTrends(data.trends);
        }
        setTrendsDate(new Date().toISOString().split("T")[0]);
      } else {
        setError(data.error || "未获取到热点");
      }
      if (data.errors?.length) {
        setError((prev) => (prev ? prev + "; " : "") + data.errors.join("; "));
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
        setError(data.error || "选题生成失败");
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

  // Group trends by section
  const trendsBySection: Record<TrendSection, Trend[]> = { global: [], industry: [], brand: [] };
  for (const t of trends) {
    const section = t.section || "global";
    if (trendsBySection[section]) trendsBySection[section].push(t);
  }

  const isLoading = loading !== null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">选题中心</h1>
          <p className="text-muted-foreground mt-1">{account.brand.name} · {account.brand.industry}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => fetchTrends()} disabled={isLoading} variant={stale ? "default" : "outline"} size="sm">
            {loading?.startsWith("trends") ? "搜索中..." : stale ? "抓取全部热点" : "刷新全部热点"}
          </Button>
          <Button onClick={() => fetchTrends(["brand"])} disabled={isLoading} variant="outline" size="sm">
            {loading === "trends-brand" ? "搜索中..." : "刷新品牌信号"}
          </Button>
          {trends.length > 0 && (
            <Button onClick={generateTopics} disabled={isLoading} size="sm">
              {loading === "topics" ? "生成中..." : "生成选题"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* ========== Left: Trend Pool ========== */}
        <div className="col-span-5 space-y-4">
          {trends.length > 0 ? (
            <>
              {(["global", "industry", "brand"] as TrendSection[]).map((section) => {
                const items = trendsBySection[section];
                if (items.length === 0) return null;
                return (
                  <Card key={section}>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">
                          {TREND_SECTION_LABELS[section]}
                          <span className="text-muted-foreground font-normal ml-1">({items.length})</span>
                        </CardTitle>
                        {trendsDate && section === "global" && (
                          <span className="text-[10px] text-muted-foreground">{trendsDate}</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                        {items.map((trend) => (
                          <div key={trend.id} className="p-2 rounded border text-sm hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-medium text-[13px] leading-snug">{trend.title}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">{trend.heatScore}/10</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{trend.description}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] px-1 py-px rounded bg-muted">{TREND_CATEGORY_LABELS[trend.category] || trend.category}</span>
                              <span className="text-[10px] text-muted-foreground truncate">{trend.source}</span>
                              {trend.eventDate && <span className="text-[10px] text-muted-foreground shrink-0">{trend.eventDate}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground mb-1">热点池为空</p>
                <p className="text-xs text-muted-foreground">点击"抓取全部热点"，AI 将从多个维度搜索真实热点</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ========== Right: Topic Pool ========== */}
        <div className="col-span-7">
          {topics.length > 0 ? (
            <div className="space-y-3">
              {/* Stats bar */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">选题池（{topics.length}）</h2>
                <div className="flex gap-2">
                  {(["traffic", "trust", "conversion", "persona"] as TopicType[]).map((type) => {
                    const count = topics.filter((t) => t.type === type).length;
                    return count > 0 ? (
                      <span key={type} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[type]}`}>
                        {TOPIC_TYPE_LABELS[type]} {count}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Topic cards */}
              {topics.map((topic) => (
                <Card key={topic.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <Link href={`/topics/${topic.id}`} className="font-medium text-[13px] hover:underline">
                            {topic.title}
                          </Link>
                          <span className={`text-[10px] px-1 py-px rounded font-medium ${TYPE_COLORS[topic.type] || ""}`}>
                            {TOPIC_TYPE_LABELS[topic.type] || topic.type}
                          </span>
                          <Badge variant={STATUS_VARIANT[topic.status]} className="text-[10px] h-4 px-1">
                            {STATUS_LABEL[topic.status]}
                          </Badge>
                        </div>
                        <p className="text-[12px] text-muted-foreground line-clamp-1">{topic.angle}</p>
                        <p className="text-[12px] mt-0.5 line-clamp-2">{topic.description}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {(["approved", "hold", "rejected"] as TopicStatus[]).map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={topic.status === s ? (s === "rejected" ? "destructive" : s === "hold" ? "secondary" : "default") : "ghost"}
                            className="h-6 px-1.5 text-[10px]"
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
                <p className="text-muted-foreground text-sm">
                  {trends.length > 0
                    ? "热点已就绪，点击\"生成选题\"让 AI 按流量/信任/转化/人设四种类型策划"
                    : "先抓取热点，再生成选题"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
