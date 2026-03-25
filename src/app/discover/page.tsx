"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getAccount, getTrends, saveTrends, isTrendsStale,
} from "@/lib/store";
import type { Account, Trend, TrendSection } from "@/lib/types";
import { TREND_CATEGORY_LABELS, TREND_SECTION_LABELS } from "@/lib/types";

export default function DiscoverPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [trendsDate, setTrendsDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) { router.push("/settings"); return; }
    setAccount(acc);
    const { trends: saved, date } = getTrends();
    setTrends(saved);
    setTrendsDate(date);
  }, [router]);

  async function fetchTrends(sections?: string[]) {
    if (!account) return;
    setLoading(sections ? sections.join("+") : "all");
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

  if (!account) return null;

  const stale = isTrendsStale();
  const isLoading = loading !== null;

  const trendsBySection: Record<TrendSection, Trend[]> = { global: [], industry: [], brand: [] };
  for (const t of trends) {
    const s = t.section || "global";
    if (trendsBySection[s]) trendsBySection[s].push(t);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">发现</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            实时热点、行业洞察、品牌信号
            {trendsDate && <span className="ml-2">· 更新于 {trendsDate}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => fetchTrends()} disabled={isLoading} variant={stale ? "default" : "outline"} size="sm">
            {loading === "all" ? "搜索中（约60秒）..." : stale ? "抓取全部热点" : "刷新全部"}
          </Button>
          <Button onClick={() => fetchTrends(["brand"])} disabled={isLoading} variant="outline" size="sm">
            {loading === "brand" ? "搜索中..." : "刷新品牌信号"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      {trends.length > 0 ? (
        <div className="space-y-8">
          {(["global", "industry", "brand"] as TrendSection[]).map((section) => {
            const items = trendsBySection[section];
            if (items.length === 0) return null;
            return (
              <div key={section}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-semibold">{TREND_SECTION_LABELS[section]}</h2>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
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
        </div>
      ) : (
        <div className="text-center py-20">
          <h3 className="text-lg font-medium mb-2">热点池为空</h3>
          <p className="text-sm text-muted-foreground mb-4">
            AI 将搜索实时热搜、行业动态、体育赛事、综艺影视、品牌信号等
          </p>
          <Button onClick={() => fetchTrends()} disabled={isLoading} size="lg">
            {loading === "all" ? "正在搜索（约60秒）..." : "开始抓取热点"}
          </Button>
        </div>
      )}
    </div>
  );
}
