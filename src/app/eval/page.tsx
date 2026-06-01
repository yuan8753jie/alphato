"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTrends, getTopics, getScripts } from "@/lib/store";
import type { Trend, Topic } from "@/lib/types";
import { TREND_CATEGORY_LABELS, TOPIC_TYPE_LABELS } from "@/lib/types";
import { useLang } from "@/lib/i18n";

type EvalTarget = "trends" | "topics";

interface Score {
  itemId: string;
  dimension: string;
  score: number;
}

const TREND_DIMENSIONS = [
  { key: "truthful", label: "真实性", labelEn: "Truthful", desc: "信息是否来自真实来源", descEn: "Does the info come from a real source" },
  { key: "timely", label: "时效性", labelEn: "Timely", desc: "是否当前/近期热点", descEn: "Is it current or recent" },
  { key: "relevant", label: "相关度", labelEn: "Relevant", desc: "与品牌/行业的关联", descEn: "Relevance to brand / industry" },
  { key: "actionable", label: "可用性", labelEn: "Actionable", desc: "是否适合做内容", descEn: "Suitable as content material" },
];

const TOPIC_DIMENSIONS = [
  { key: "creative", label: "创意度", labelEn: "Creative", desc: "切入角度是否独特", descEn: "Is the angle unique" },
  { key: "brandFit", label: "品牌契合", labelEn: "Brand Fit", desc: "是否符合品牌调性", descEn: "Matches brand tone" },
  { key: "titleQuality", label: "标题质量", labelEn: "Title Quality", desc: "是否像真实爆款标题", descEn: "Reads like a real viral title" },
  { key: "executable", label: "可执行", labelEn: "Executable", desc: "描述是否足够具体", descEn: "Is the description specific enough" },
  { key: "appeal", label: "吸引力", labelEn: "Appeal", desc: "目标受众是否想看", descEn: "Will the target audience want to watch" },
];

const TREND_CATEGORY_LABELS_EN: Record<string, string> = {
  platform_hot: "Platform Trending",
  industry_news: "Industry News",
  social_meme: "Social Memes",
  sports_event: "Sports Events",
  entertainment: "Entertainment",
  holiday_calendar: "Holidays",
  brand_related: "Brand Related",
  trivia: "Trivia",
  history_today: "This Day in History",
};

const TOPIC_TYPE_LABELS_EN: Record<string, string> = {
  traffic: "Traffic",
  trust: "Trust",
  conversion: "Conversion",
  persona: "Persona",
};

const EVAL_STORAGE_KEY = "alphato_eval_scores";

function loadScores(): Score[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(EVAL_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveScores(scores: Score[]) {
  localStorage.setItem(EVAL_STORAGE_KEY, JSON.stringify(scores));
}

function ScoreButton({ value, current, onClick }: { value: number; current: number | null; onClick: () => void }) {
  const isActive = current === value;
  return (
    <button
      onClick={onClick}
      className={`w-7 h-7 rounded text-xs font-mono transition-colors ${
        isActive
          ? value >= 7 ? "bg-green-500 text-white" : value >= 4 ? "bg-amber-500 text-white" : "bg-red-500 text-white"
          : "bg-muted hover:bg-muted/80"
      }`}
    >
      {value}
    </button>
  );
}

export default function EvalPage() {
  const { t, lang } = useLang();
  const [target, setTarget] = useState<EvalTarget>("trends");
  const [trends, setTrends] = useState<Trend[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const dimLabel = (d: { label: string; labelEn: string }) => (lang === "en" ? d.labelEn : d.label);
  const dimDesc = (d: { desc: string; descEn: string }) => (lang === "en" ? d.descEn : d.desc);
  const trendCatLabel = (cat: string) =>
    lang === "en" ? (TREND_CATEGORY_LABELS_EN[cat] || cat) : (TREND_CATEGORY_LABELS[cat as keyof typeof TREND_CATEGORY_LABELS] || cat);
  const topicTypeLabel = (type: string) =>
    lang === "en" ? (TOPIC_TYPE_LABELS_EN[type] || type) : (TOPIC_TYPE_LABELS[type as keyof typeof TOPIC_TYPE_LABELS] || type);

  useEffect(() => {
    setTrends(getTrends().trends);
    setTopics(getTopics());
    setScores(loadScores());
  }, []);

  function getScore(itemId: string, dimension: string): number | null {
    const found = scores.find((s) => s.itemId === itemId && s.dimension === dimension);
    return found?.score ?? null;
  }

  function setScore(itemId: string, dimension: string, score: number) {
    const newScores = scores.filter((s) => !(s.itemId === itemId && s.dimension === dimension));
    newScores.push({ itemId, dimension, score });
    setScores(newScores);
    saveScores(newScores);
  }

  function getItemAvg(itemId: string, dimensions: { key: string }[]): number | null {
    const itemScores = dimensions.map((d) => getScore(itemId, d.key)).filter((s) => s !== null) as number[];
    if (itemScores.length === 0) return null;
    return +(itemScores.reduce((a, b) => a + b, 0) / itemScores.length).toFixed(1);
  }

  function getOverallAvg(items: { id: string }[], dimensions: { key: string }[]): number | null {
    const avgs = items.map((item) => getItemAvg(item.id, dimensions)).filter((a) => a !== null) as number[];
    if (avgs.length === 0) return null;
    return +(avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1);
  }

  const dimensions = target === "trends" ? TREND_DIMENSIONS : TOPIC_DIMENSIONS;
  const items = target === "trends" ? trends : topics;
  const overallAvg = getOverallAvg(items, dimensions);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{t("效果评判", "Eval")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("对 AI 每个环节的产出进行人工打分，指导 Prompt 迭代", "Manually score the output of each AI stage to guide prompt iteration")}
          </p>
        </div>
        {overallAvg !== null && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t("总体平均分", "Overall avg")}</p>
            <p className={`text-2xl font-bold ${
              overallAvg >= 7 ? "text-green-600" : overallAvg >= 5 ? "text-amber-600" : "text-red-600"
            }`}>{overallAvg}</p>
          </div>
        )}
      </div>

      {/* Target selector */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setTarget("trends")}
          className={`text-xs px-3 py-1.5 rounded-md transition-colors ${target === "trends" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          {t("热点质量", "Trend Quality")} ({trends.length})
        </button>
        <button
          onClick={() => setTarget("topics")}
          className={`text-xs px-3 py-1.5 rounded-md transition-colors ${target === "topics" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          {t("选题质量", "Topic Quality")} ({topics.length})
        </button>
      </div>

      {/* Dimension legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs text-muted-foreground">
        {dimensions.map((d) => (
          <span key={d.key}><span className="font-medium text-foreground">{dimLabel(d)}</span>{t("：", ": ")}{dimDesc(d)}</span>
        ))}
      </div>

      {/* Items to evaluate */}
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => {
            const avg = getItemAvg(item.id, dimensions);
            const isTrend = "category" in item;
            return (
              <Card key={item.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{item.title}</span>
                        {isTrend && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
                            {trendCatLabel((item as Trend).category)}
                          </span>
                        )}
                        {!isTrend && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
                            {topicTypeLabel((item as Topic).type)}
                          </span>
                        )}
                        {avg !== null && (
                          <Badge variant={avg >= 7 ? "default" : avg >= 5 ? "secondary" : "destructive"} className="text-[10px]">
                            {t(`${avg}分`, `${avg} pts`)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {isTrend ? (item as Trend).description : (item as Topic).description}
                      </p>
                    </div>
                    <div className="shrink-0 space-y-1">
                      {dimensions.map((d) => (
                        <div key={d.key} className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-8">{dimLabel(d)}</span>
                          <div className="flex gap-px">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                              <ScoreButton
                                key={v}
                                value={v}
                                current={getScore(item.id, d.key)}
                                onClick={() => setScore(item.id, d.key, v)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">
              {target === "trends"
                ? t("没有热点数据，请先到「发现」页面抓取", "No trend data — fetch some on the Discover page first")
                : t("没有选题数据，请先生成选题", "No topic data — generate topics first")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
