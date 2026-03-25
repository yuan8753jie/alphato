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
  TREND_CATEGORY_LABELS, TREND_SECTION_LABELS, TOPIC_TYPE_LABELS,
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

type TabKey = "trends" | "topics" | "calendar";

export default function TopicsPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [trendsDate, setTrendsDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("trends");

  useEffect(() => {
    const acc = getAccount();
    if (!acc) { router.push("/setup"); return; }
    setAccount(acc);
    const savedTopics = getTopics();
    setTopics(savedTopics);
    const { trends: saved, date } = getTrends();
    setTrends(saved);
    setTrendsDate(date);
    // Auto-select tab: if trends exist but no topics, stay on trends; if topics exist, show topics
    if (savedTopics.length > 0) setActiveTab("topics");
  }, [router]);

  async function fetchTrends(sections?: string[]) {
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
          benchmarkAccounts: account.benchmarkAccounts,
          sections,
        }),
      });
      const data = await res.json();
      if (data.success && data.trends?.length > 0) {
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
        setActiveTab("topics");
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
  const isLoading = loading !== null;

  // Group trends by section
  const trendsBySection: Record<TrendSection, Trend[]> = { global: [], industry: [], brand: [] };
  for (const t of trends) {
    const s = t.section || "global";
    if (trendsBySection[s]) trendsBySection[s].push(t);
  }

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: "trends", label: "热点池", count: trends.length },
    { key: "topics", label: "选题池", count: topics.length },
    { key: "calendar", label: "营销日历" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">选题中心</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{account.brand.name} · {account.brand.industry}</p>
        </div>
      </div>

      {/* Tab bar + Actions */}
      <div className="flex items-center justify-between border-b mb-6">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-2">
          {activeTab === "trends" && (
            <>
              <Button onClick={() => fetchTrends()} disabled={isLoading} variant={stale ? "default" : "outline"} size="sm">
                {loading === "trends" ? "搜索中（约60秒）..." : stale ? "抓取全部热点" : "刷新全部热点"}
              </Button>
              <Button onClick={() => fetchTrends(["brand"])} disabled={isLoading} variant="outline" size="sm">
                {loading === "trends" ? "..." : "刷新品牌信号"}
              </Button>
            </>
          )}
          {activeTab === "topics" && trends.length > 0 && (
            <Button onClick={generateTopics} disabled={isLoading} size="sm">
              {loading === "topics" ? "生成中..." : "生成选题"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      {/* ==================== TRENDS TAB ==================== */}
      {activeTab === "trends" && (
        <div>
          {trends.length > 0 ? (
            <div className="space-y-6">
              {(["global", "industry", "brand"] as TrendSection[]).map((section) => {
                const items = trendsBySection[section];
                if (items.length === 0) return null;
                return (
                  <div key={section}>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-base font-semibold">{TREND_SECTION_LABELS[section]}</h3>
                      <span className="text-xs text-muted-foreground">({items.length})</span>
                      {section === "global" && trendsDate && (
                        <span className="text-xs text-muted-foreground ml-auto">{trendsDate}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {items.map((trend) => (
                        <Card key={trend.id} className="hover:shadow-sm transition-shadow">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="font-medium text-sm leading-snug">{trend.title}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{trend.heatScore}/10</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-3">{trend.description}</p>
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">
                                {TREND_CATEGORY_LABELS[trend.category] || trend.category}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate">{trend.source}</span>
                              {trend.eventDate && <span className="text-[10px] text-muted-foreground shrink-0">{trend.eventDate}</span>}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Prompt to generate topics */}
              <div className="text-center py-6 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  热点已就绪，可以基于这些热点为品牌生成选题
                </p>
                <Button onClick={() => { generateTopics(); }} disabled={isLoading} size="sm">
                  {loading === "topics" ? "生成中..." : "基于热点生成选题 →"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <h3 className="text-lg font-medium mb-2">热点池为空</h3>
              <p className="text-sm text-muted-foreground mb-4">
                AI 将从多个维度搜索真实热点：平台热搜、行业动态、体育赛事、综艺影视、品牌信号等
              </p>
              <Button onClick={() => fetchTrends()} disabled={isLoading} size="lg">
                {loading === "trends" ? "正在搜索（约60秒）..." : "开始抓取热点"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ==================== TOPICS TAB ==================== */}
      {activeTab === "topics" && (
        <div>
          {topics.length > 0 ? (
            <div className="space-y-4">
              {/* Type stats */}
              <div className="flex items-center gap-3">
                {(["traffic", "trust", "conversion", "persona"] as TopicType[]).map((type) => {
                  const count = topics.filter((t) => t.type === type).length;
                  return count > 0 ? (
                    <span key={type} className={`text-xs px-2 py-0.5 rounded font-medium ${TYPE_COLORS[type]}`}>
                      {TOPIC_TYPE_LABELS[type]} {count}
                    </span>
                  ) : null;
                })}
                <span className="text-xs text-muted-foreground ml-auto">
                  采用 {topics.filter((t) => t.status === "approved").length} ·
                  待定 {topics.filter((t) => t.status === "pending").length}
                </span>
              </div>

              {/* Topic cards - 2 column grid */}
              <div className="grid grid-cols-2 gap-4">
                {topics.map((topic) => (
                  <Card key={topic.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[topic.type] || ""}`}>
                          {TOPIC_TYPE_LABELS[topic.type] || topic.type}
                        </span>
                        <Badge variant={STATUS_VARIANT[topic.status]} className="text-[10px] h-4 px-1.5">
                          {STATUS_LABEL[topic.status]}
                        </Badge>
                      </div>
                      <Link href={`/topics/${topic.id}`} className="font-semibold text-sm hover:underline block mb-1">
                        {topic.title}
                      </Link>
                      <p className="text-xs text-muted-foreground mb-1">{topic.angle}</p>
                      <p className="text-xs line-clamp-3 mb-3">{topic.description}</p>
                      <div className="flex gap-1.5">
                        {(["approved", "hold", "rejected"] as TopicStatus[]).map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={topic.status === s ? (s === "rejected" ? "destructive" : s === "hold" ? "secondary" : "default") : "outline"}
                            className="h-7 px-2.5 text-xs flex-1"
                            onClick={() => updateTopicStatus(topic.id, s)}
                          >
                            {STATUS_LABEL[s]}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <h3 className="text-lg font-medium mb-2">选题池为空</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {trends.length > 0
                  ? "热点已就绪，点击下方按钮让 AI 按流量/信任/转化/人设四种类型策划选题"
                  : "请先到热点池抓取热点"}
              </p>
              {trends.length > 0 ? (
                <Button onClick={generateTopics} disabled={isLoading} size="lg">
                  {loading === "topics" ? "生成中..." : "生成选题"}
                </Button>
              ) : (
                <Button onClick={() => setActiveTab("trends")} variant="outline" size="lg">
                  去热点池 →
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== CALENDAR TAB ==================== */}
      {activeTab === "calendar" && (
        <div className="text-center py-20">
          <h3 className="text-lg font-medium mb-2">营销日历</h3>
          <p className="text-sm text-muted-foreground">即将上线，敬请期待</p>
        </div>
      )}
    </div>
  );
}
