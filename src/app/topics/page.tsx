"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAccount, getTopics, saveTopics, getTrends } from "@/lib/store";
import type { Account, Topic, TopicStatus, TopicType, Trend } from "@/lib/types";
import { TOPIC_TYPE_LABELS } from "@/lib/types";

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

interface SelectedTrend {
  originalIndex: number;
  title: string;
  relevanceScore: number;
  reason: string;
}

export default function TopicsPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState<string | null>(null); // null | "selecting" | "generating"
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<TopicType | "all">("all");
  const [selectedTrends, setSelectedTrends] = useState<SelectedTrend[]>([]);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) { router.push("/settings"); return; }
    setAccount(acc);
    setTopics(getTopics());
    setTrends(getTrends().trends);
  }, [router]);

  async function generateTopics() {
    if (!account || trends.length === 0) return;
    setLoading("selecting");
    setError(null);
    setSelectedTrends([]);

    try {
      const res = await fetch("/api/generate-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, trends }),
      });
      const data = await res.json();

      // Show selected trends from Phase 1
      if (data.selectedTrends?.length > 0) {
        setSelectedTrends(data.selectedTrends);
      }

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

  const filtered = filterType === "all" ? topics : topics.filter((t) => t.type === filterType);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">选题</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            基于热点池为品牌策划的内容选题
            {topics.length > 0 && (
              <span className="ml-2">
                · 采用 {topics.filter((t) => t.status === "approved").length}
                · 待定 {topics.filter((t) => t.status === "pending").length}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {trends.length === 0 && (
            <Button onClick={() => router.push("/discover")} variant="outline" size="sm">
              先去发现热点 →
            </Button>
          )}
          {trends.length > 0 && (
            <Button onClick={generateTopics} disabled={loading !== null} size="sm">
              {loading === "selecting"
                ? "AI 正在分析热点相关度..."
                : loading === "generating"
                  ? "AI 正在创作选题..."
                  : "生成选题"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      {/* Phase 1 result: Selected trends */}
      {selectedTrends.length > 0 && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <h3 className="text-sm font-semibold mb-3">
              AI 从 {trends.length} 条热点中精选了 {selectedTrends.length} 条
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedTrends.map((st, i) => (
                <div
                  key={i}
                  className="text-xs px-2.5 py-1.5 rounded-lg border bg-muted/50 max-w-xs"
                  title={st.reason}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">{st.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{st.relevanceScore}/10</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{st.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Topic cards */}
      {topics.length > 0 ? (
        <div className="space-y-4">
          {/* Type filter */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterType("all")}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${filterType === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
            >
              全部 ({topics.length})
            </button>
            {(["traffic", "trust", "conversion", "persona"] as TopicType[]).map((type) => {
              const count = topics.filter((t) => t.type === type).length;
              return count > 0 ? (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${filterType === type ? TYPE_COLORS[type] + " font-medium" : "bg-muted hover:bg-muted/80"}`}
                >
                  {TOPIC_TYPE_LABELS[type]} ({count})
                </button>
              ) : null;
            })}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {filtered.map((topic) => (
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
                  <p className="text-xs line-clamp-3 mb-2">{topic.description}</p>
                  {topic.relatedTrendIds?.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mb-2 line-clamp-1">
                      基于：{topic.relatedTrendIds.join("、")}
                    </p>
                  )}
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
              ? `热点池有 ${trends.length} 条热点，AI 会先筛选最相关的，再生成选题`
              : "请先到「发现」页面抓取热点"}
          </p>
          {trends.length > 0 ? (
            <Button onClick={generateTopics} disabled={loading !== null} size="lg">
              {loading ? "生成中..." : "生成选题"}
            </Button>
          ) : (
            <Button onClick={() => router.push("/discover")} size="lg">
              去发现热点 →
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
