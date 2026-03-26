"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import {
  getAccount, getTrends, saveTrends, isTrendsStale,
} from "@/lib/store";
import type { Account, Trend, TrendSection, TrendCategory } from "@/lib/types";
import { TREND_CATEGORY_LABELS, TREND_SECTION_LABELS } from "@/lib/types";

// Section color scheme
const SECTION_COLORS: Record<TrendSection, { bg: string; text: string; activeBg: string; activeText: string }> = {
  global: { bg: "bg-blue-50", text: "text-blue-700", activeBg: "bg-blue-600", activeText: "text-white" },
  industry: { bg: "bg-emerald-50", text: "text-emerald-700", activeBg: "bg-emerald-600", activeText: "text-white" },
  brand: { bg: "bg-violet-50", text: "text-violet-700", activeBg: "bg-violet-600", activeText: "text-white" },
};

// Map category → section for coloring
const CATEGORY_TO_SECTION: Record<string, TrendSection> = {
  platform_hot: "global", social_meme: "global", sports_event: "global",
  entertainment: "global", holiday_calendar: "global", history_today: "global",
  industry_news: "industry", trivia: "industry",
  brand_related: "brand",
};

function TrendCard({ trend }: { trend: Trend }) {
  const section = trend.section || CATEGORY_TO_SECTION[trend.category] || "global";
  const colors = SECTION_COLORS[section];

  return (
    <Card className={`hover:shadow-sm transition-shadow ${trend.warning ? "border-amber-300 bg-amber-50/30" : ""}`}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-medium text-sm leading-snug">{trend.title}</span>
          <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{trend.heatScore}/10</span>
        </div>
        {trend.warning && (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium mb-1">
            ⚠️ {trend.warning}
          </span>
        )}
        <p className="text-xs text-muted-foreground line-clamp-3">{trend.description}</p>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors.bg} ${colors.text}`}>
            {TREND_SECTION_LABELS[section]}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">
            {TREND_CATEGORY_LABELS[trend.category] || trend.category}
          </span>
          {trend.sourceUrl ? (
            <a
              href={trend.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-muted-foreground truncate hover:text-foreground hover:underline"
            >
              {trend.source} ↗
            </a>
          ) : (
            <span className="text-[10px] text-muted-foreground truncate">{trend.source}</span>
          )}
          {trend.eventDate && <span className="text-[10px] text-muted-foreground shrink-0">{trend.eventDate}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [trendsDate, setTrendsDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

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

  // Build unified filter tabs: "all" + each category that exists, grouped by section
  const categoryCounts = new Map<string, { count: number; section: TrendSection }>();
  for (const t of trends) {
    const key = t.category;
    const existing = categoryCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      categoryCounts.set(key, {
        count: 1,
        section: t.section || CATEGORY_TO_SECTION[t.category] || "global",
      });
    }
  }

  // Sort tabs by section order: global → industry → brand
  const sectionOrder: TrendSection[] = ["global", "industry", "brand"];
  const sortedCategories = Array.from(categoryCounts.entries()).sort((a, b) => {
    const ai = sectionOrder.indexOf(a[1].section);
    const bi = sectionOrder.indexOf(b[1].section);
    return ai - bi;
  });

  const filtered = activeFilter === "all"
    ? trends
    : trends.filter((t) => t.category === activeFilter);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">发现</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            实时热点、行业洞察、品牌信号
            {trendsDate && <span className="ml-2">· 更新于 {trendsDate}</span>}
          </p>
        </div>
        <Button
          onClick={() => {
            if (stale || trends.length === 0) {
              fetchTrends();
            } else {
              fetchTrends(["brand"]);
            }
          }}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="gap-1.5"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          {isLoading
            ? "刷新中..."
            : stale || trends.length === 0
              ? "抓取热点"
              : "刷新"}
        </Button>
      </div>

      {/* Unified filter tabs */}
      {trends.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-6">
          <button
            onClick={() => setActiveFilter("all")}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors font-medium ${
              activeFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            全部 ({trends.length})
          </button>
          {sortedCategories.map(([cat, { count, section }]) => {
            const colors = SECTION_COLORS[section];
            const isActive = activeFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors font-medium ${
                  isActive
                    ? `${colors.activeBg} ${colors.activeText}`
                    : `${colors.bg} ${colors.text} hover:opacity-80`
                }`}
              >
                {TREND_CATEGORY_LABELS[cat as TrendCategory] || cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      {trends.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((trend) => (
            <TrendCard key={trend.id} trend={trend} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <h3 className="text-lg font-medium mb-2">热点池为空</h3>
          <p className="text-sm text-muted-foreground mb-4">
            AI 将搜索实时热搜、行业动态、体育赛事、综艺影视、品牌信号等
          </p>
          <Button onClick={() => fetchTrends()} disabled={isLoading} size="lg" className="gap-2">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            {isLoading ? "正在搜索（约60秒）..." : "开始抓取热点"}
          </Button>
        </div>
      )}
    </div>
  );
}
