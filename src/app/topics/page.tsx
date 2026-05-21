"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ClipboardCheck } from "lucide-react";
import { getAccount, getTopics, saveTopics, getTrends, getReviewPersonas, saveReviewPersonas, getReviewResults, saveReviewResults, saveSelectedTrendsMeta, getSelectedTrendsMeta } from "@/lib/store";
import type { Account, Topic, TopicStatus, TopicType, Trend, SelectedTrendsMeta } from "@/lib/types";
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

type SelectedTrend = SelectedTrendsMeta["selectedTrends"][number];

export default function TopicsPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState<string | null>(null); // null | "selecting" | "generating" | "reviewing"
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<TopicType | "all">("all");
  // 产品筛选：null = 全部, "" = 通用（无绑定）, string = 具体产品 id
  const [filterProduct, setFilterProduct] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"default" | "score">("default");
  const [selectedTrends, setSelectedTrends] = useState<SelectedTrend[]>([]);
  const [selectedTrendsMeta, setSelectedTrendsMetaState] = useState<SelectedTrendsMeta | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reviewPersonas, setReviewPersonas] = useState<any[]>([]);
  // reviewResults: { [topicId]: { personaReviews: [...], averageScore, status } }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reviewResults, setReviewResults] = useState<Record<string, any>>({});
  const [reviewStep, setReviewStep] = useState<"idle" | "personas" | "reviewing" | "done">("idle");
  const [reviewingTopicId, setReviewingTopicId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [reviewResearch, setReviewResearch] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const acc = getAccount();
    if (!acc) { router.push("/settings"); return; }
    setAccount(acc);
    setTopics(getTopics());
    setTrends(getTrends().trends);
    // Load persisted Phase 1 selection
    const savedMeta = getSelectedTrendsMeta();
    if (savedMeta) {
      setSelectedTrendsMetaState(savedMeta);
      setSelectedTrends(savedMeta.selectedTrends);
    }
    // Load persisted review personas + results
    const savedPersonas = getReviewPersonas();
    if (savedPersonas) {
      setReviewPersonas(savedPersonas.personas);
      setReviewResearch(savedPersonas.reasoning);
    }
    const savedResults = getReviewResults();
    if (savedResults && Object.keys(savedResults).length > 0) {
      setReviewResults(savedResults);
      setReviewStep("done");
    }
  }, [router]);

  async function generateTopics() {
    if (!account || trends.length === 0 || loading) return;
    const ac = new AbortController();
    setAbortController(ac);
    setLoading("selecting");
    setError(null);
    setSelectedTrends([]);

    try {
      // filterProduct 控制本次生成的产品聚焦：
      //   null  → 不聚焦，AI 自己按选题挑产品
      //   ""    → 通用选题，不绑任何产品（不传 focusProductId）
      //   id    → 全部选题都为该产品生成
      const focusProductId = filterProduct && filterProduct !== "" ? filterProduct : undefined;
      const res = await fetch("/api/generate-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, trends, focusProductId }),
        signal: ac.signal,
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

        // Persist Phase 1 selection + generation metadata
        const meta: SelectedTrendsMeta = {
          selectedTrends: data.selectedTrends || [],
          trendsPoolSize: trends.length,
          topicsGenerated: data.topics.length,
          generatedAt: new Date().toISOString(),
        };
        setSelectedTrendsMetaState(meta);
        saveSelectedTrendsMeta(meta);
      } else {
        setError(data.error || "选题生成失败");
      }
    } catch (err) {
      setError("请求失败：" + String(err));
    } finally {
      setLoading(null);
    }
  }

  async function reviewTopics(forceNewPersonas = false) {
    if (!account || topics.length === 0 || loading) return;
    const ac = new AbortController();
    setAbortController(ac);
    setLoading("reviewing");
    setError(null);
    setDrawerOpen(true);
    setReviewResults({});
    setReviewingTopicId(null);

    try {
      // Step 1: Use existing personas or generate new ones
      const existingPersonas = !forceNewPersonas ? getReviewPersonas() : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let personas: any[];

      if (existingPersonas?.personas?.length) {
        // Reuse persisted personas
        personas = existingPersonas.personas;
        setReviewPersonas(personas);
        if (existingPersonas.reasoning) setReviewResearch(existingPersonas.reasoning);
        setReviewStep("reviewing");
      } else {
        // Generate new personas
        setReviewStep("personas");
        setReviewPersonas([]);
        setReviewResearch(null);

        const personaRes = await fetch("/api/generate-personas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account }),
        });
        const personaData = await personaRes.json();
        if (!personaData.success || !personaData.personas?.length) {
          setError(personaData.error || "Persona 生成失败");
          setReviewStep("idle");
          setLoading(null);
          return;
        }
        personas = personaData.personas;
        setReviewPersonas(personas);
        if (personaData.research) setReviewResearch(personaData.research);

        // Persist for next time
        saveReviewPersonas({
          personas,
          reasoning: personaData.research,
          generatedAt: new Date().toISOString(),
        });
      }
      setReviewStep("reviewing");

      // Step 2: Review each topic, one at a time; all personas in parallel per topic
      for (const topic of topics) {
        setReviewingTopicId(topic.id);

        // Mark topic as "reviewing"
        setReviewResults((prev) => ({
          ...prev,
          [topic.id]: { status: "reviewing", personaReviews: [], averageScore: null },
        }));

        // Fire all persona reviews in parallel for this topic
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const personaResults = await Promise.allSettled(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          personas.map(async (persona: any) => {
            const res = await fetch("/api/review-single", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                persona,
                topic,
                brandName: account.brand.name,
                platform: account.platform,
              }),
            });
            const data = await res.json();
            if (data.success && data.review) {
              // Update drawer in real-time as each persona finishes
              setReviewResults((prev) => {
                const existing = prev[topic.id] || { status: "reviewing", personaReviews: [], averageScore: null };
                const reviews = [...existing.personaReviews, data.review];
                // Extract scores - handle both { score, reason } objects and plain numbers
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const getScore = (v: any) => typeof v === "object" && v !== null ? v.score : Number(v) || 0;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const allScores = reviews.flatMap((r: any) => [getScore(r.stop), getScore(r.watch), getScore(r.engage), getScore(r.convert)]);
                const avg = allScores.length > 0 ? +(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length).toFixed(1) : null;
                const updated = { ...prev, [topic.id]: { ...existing, personaReviews: reviews, averageScore: avg } };
                saveReviewResults(updated);
                return updated;
              });
              return data.review;
            }
            return null;
          })
        );

        // Mark topic as done
        const successCount = personaResults.filter((r) => r.status === "fulfilled" && r.value).length;
        setReviewResults((prev) => ({
          ...prev,
          [topic.id]: { ...prev[topic.id], status: successCount > 0 ? "done" : "failed" },
        }));
      }

      setReviewingTopicId(null);
      setReviewStep("done");

      // Persist review scores into topics (read latest from state via callback)
      setReviewResults((latestResults) => {
        const updatedTopics = topics.map((t) => {
          const result = latestResults[t.id];
          if (result?.averageScore != null) {
            return { ...t, reviewScore: result.averageScore };
          }
          return t;
        });
        setTopics(updatedTopics);
        saveTopics(updatedTopics);
        return latestResults;
      });
    } catch (err) {
      setError("请求失败：" + String(err));
      setReviewStep("idle");
    } finally {
      setLoading(null);
    }
  }

  function stopCurrentTask() {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setLoading(null);
    setReviewStep((prev) => prev === "idle" ? "idle" : "done");
    setReviewingTopicId(null);
  }

  function getTopicReview(topicId: string) {
    return reviewResults[topicId] || null;
  }

  function updateTopicStatus(id: string, status: TopicStatus) {
    const updated = topics.map((t) => t.id === id ? { ...t, status } : t);
    setTopics(updated);
    saveTopics(updated);
  }

  if (!account) return null;

  const filteredByType = filterType === "all" ? topics : topics.filter((t) => t.type === filterType);
  const filteredByProduct = filterProduct === null
    ? filteredByType
    : filterProduct === ""
      ? filteredByType.filter((t) => !t.productIds || t.productIds.length === 0)
      : filteredByType.filter((t) => t.productIds?.includes(filterProduct));
  const filtered = sortBy === "score"
    ? [...filteredByProduct].sort((a, b) => {
        const scoreA = reviewResults[a.id]?.averageScore ?? -1;
        const scoreB = reviewResults[b.id]?.averageScore ?? -1;
        return scoreB - scoreA;
      })
    : filteredByProduct;

  // 产品筛选条所需统计
  const productCounts = new Map<string, number>();
  let genericCount = 0;
  for (const t of topics) {
    if (!t.productIds || t.productIds.length === 0) {
      genericCount++;
    } else {
      for (const pid of t.productIds) {
        productCounts.set(pid, (productCounts.get(pid) || 0) + 1);
      }
    }
  }
  const productNameById = new Map(account.products.map((p) => [p.id, p.name]));

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
          {selectedTrendsMeta && (() => {
            const poolChanged = trends.length !== selectedTrendsMeta.trendsPoolSize;
            const genDate = selectedTrendsMeta.generatedAt.split("T")[0];
            return (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span>基于 {selectedTrendsMeta.trendsPoolSize} 条热点</span>
                <span>·</span>
                <span>AI 精选 {selectedTrendsMeta.selectedTrends.length} 条</span>
                <span>·</span>
                <span>生成 {selectedTrendsMeta.topicsGenerated} 个选题</span>
                <span>·</span>
                <span>更新于 {genDate}</span>
                {poolChanged && trends.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">
                    热点池已更新到 {trends.length} 条，建议重新生成
                  </span>
                )}
              </p>
            );
          })()}
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <Button onClick={stopCurrentTask} variant="destructive" size="sm">
              停止
            </Button>
          )}
          {trends.length === 0 && !loading && (
            <Button onClick={() => router.push("/discover")} variant="outline" size="sm">
              先去发现热点 →
            </Button>
          )}
          {trends.length > 0 && (() => {
            const focusName = filterProduct && filterProduct !== ""
              ? productNameById.get(filterProduct)
              : null;
            const generateLabel = loading === "selecting"
              ? "分析热点中..."
              : loading === "generating"
                ? "生成选题中..."
                : focusName
                  ? `为「${focusName}」生成选题`
                  : filterProduct === ""
                    ? "生成通用选题"
                    : "生成选题";
            return (
              <Button onClick={generateTopics} disabled={loading !== null} size="sm">
                {generateLabel}
              </Button>
            );
          })()}
          {topics.length > 0 && (
            <>
              <Button onClick={() => reviewTopics()} disabled={loading !== null} variant="outline" size="sm">
                {loading === "reviewing" ? "评审中..." : reviewPersonas.length > 0 ? "AI Review（复用 Persona）" : "AI Review"}
              </Button>
              {reviewPersonas.length > 0 && !loading && (
                <button
                  onClick={() => reviewTopics(true)}
                  disabled={loading !== null}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                  title="重新生成审稿团"
                >
                  换一批审稿人
                </button>
              )}
              {(reviewStep !== "idle" || Object.keys(reviewResults).length > 0) && (
                <Button variant="ghost" size="sm" className="px-2" title="查看评审过程" onClick={() => setDrawerOpen(true)}>
                  <ClipboardCheck size={16} />
                </Button>
              )}
            </>
          )}

          {/* Review process drawer */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetContent className="overflow-y-auto p-0">
              <div className="sticky top-0 bg-background/95 backdrop-blur border-b px-6 py-4 z-[1]">
                <SheetHeader>
                  <SheetTitle className="text-lg">AI 评审过程</SheetTitle>
                </SheetHeader>
                {reviewStep === "done" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {reviewPersonas.length} 位审稿人 · {Object.keys(reviewResults).length} 条选题 · 评审完成
                  </p>
                )}
              </div>

              <div className="px-6 py-5 space-y-8">
                {/* ===== Step 1: Persona Generation ===== */}
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${
                      reviewStep === "personas" ? "bg-blue-500 animate-pulse" :
                      reviewPersonas.length > 0 ? "bg-green-500" : "bg-gray-300"
                    }`}>
                      {reviewPersonas.length > 0 ? "✓" : "1"}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">
                        {reviewStep === "personas" ? "正在分析品牌受众，生成审稿团..." :
                         reviewPersonas.length > 0 ? `审稿团就位（${reviewPersonas.length} 人）` : "生成审稿团"}
                      </h3>
                      {reviewStep === "personas" && (
                        <p className="text-xs text-muted-foreground">AI 正在基于以下信息构建虚拟目标用户...</p>
                      )}
                    </div>
                  </div>

                  {/* Show brand context while generating */}
                  {reviewStep === "personas" && account && (
                    <div className="ml-11 rounded-xl border bg-muted/30 p-4 space-y-2 animate-pulse">
                      <div className="text-[11px] space-y-1.5">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">品牌</span>
                          <span className="font-medium">{account.brand.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">行业</span>
                          <span className="font-medium">{account.brand.industry}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground shrink-0">调性</span>
                          <span className="font-medium line-clamp-2">{account.brand.tone}</span>
                        </div>
                        {account.products.length > 0 && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground shrink-0">产品</span>
                            <span className="font-medium">{account.products.map((p) => p.name).join("、")}</span>
                          </div>
                        )}
                        {account.personas.length > 0 && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground shrink-0">参考受众</span>
                            <span className="font-medium">{account.personas.map((p) => p.name).join("、")}</span>
                          </div>
                        )}
                        {(account.brandMaterials?.length || 0) > 0 && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground shrink-0">品牌资料</span>
                            <span className="font-medium">{account.brandMaterials.length} 份</span>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground pt-1 border-t">
                        AI 正在综合分析以上信息，结合平台用户特征，构建 5~7 个代表性受众画像...
                      </p>
                    </div>
                  )}

                  {/* AI reasoning */}
                  {reviewResearch && (
                    <div className="ml-11 mb-4 rounded-xl border bg-slate-50 p-4 space-y-3">
                      <h4 className="text-xs font-semibold">AI 分析思路</h4>
                      {reviewResearch.dimensions?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">考虑维度</p>
                          <div className="flex flex-wrap gap-1">
                            {reviewResearch.dimensions.map((d: string, i: number) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">{d}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {reviewResearch.logic && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">构建逻辑</p>
                          <p className="text-[11px] leading-relaxed">{reviewResearch.logic}</p>
                        </div>
                      )}
                      {reviewResearch.coverage && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">覆盖度</p>
                          <p className="text-[11px] leading-relaxed">{reviewResearch.coverage}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {reviewPersonas.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 ml-11">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {reviewPersonas.map((p: any, i: number) => (
                        <div key={i} className="rounded-xl border bg-gradient-to-br from-muted/30 to-muted/10 p-3 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {p.name?.[0]}
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground">{p.age}岁 · {p.gender} · {p.occupation}</p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{p.profile}</p>
                          {p.contentPreference && (
                            <p className="text-[10px] text-muted-foreground">
                              <span className="font-medium text-foreground">偏好：</span>{p.contentPreference}
                            </p>
                          )}
                          {p.brandAwareness && (
                            <p className="text-[10px] text-muted-foreground">
                              <span className="font-medium text-foreground">品牌认知：</span>{p.brandAwareness}
                            </p>
                          )}
                          {p.whyIncluded && (
                            <p className="text-[10px] text-blue-600 italic mt-1">
                              入选原因：{p.whyIncluded}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ===== Step 2: Per-topic Reviews ===== */}
                {(reviewStep === "reviewing" || reviewStep === "done") && (
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${
                        reviewStep === "reviewing" ? "bg-blue-500 animate-pulse" :
                        reviewStep === "done" ? "bg-green-500" : "bg-gray-300"
                      }`}>
                        {reviewStep === "done" ? "✓" : "2"}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">
                          {reviewStep === "reviewing"
                            ? `逐条评审中（${Object.values(reviewResults).filter((r) => r.status === "done").length}/${topics.length}）`
                            : `评审完成（${topics.length} 条）`}
                        </h3>
                        <p className="text-xs text-muted-foreground">每条选题由 {reviewPersonas.length} 位审稿人独立评审</p>
                      </div>
                    </div>

                    <div className="space-y-4 ml-11">
                      {topics.map((topic) => {
                        const result = reviewResults[topic.id];
                        if (!result) {
                          return (
                            <div key={topic.id} className="rounded-xl border p-4 opacity-40">
                              <p className="text-sm text-muted-foreground">{topic.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">等待评审...</p>
                            </div>
                          );
                        }

                        const isActive = reviewingTopicId === topic.id;
                        const isDone = result.status === "done";
                        const avgScore = result.averageScore;

                        return (
                          <div key={topic.id} className={`rounded-xl border overflow-hidden ${isActive ? "ring-2 ring-blue-400" : ""}`}>
                            {/* Topic header */}
                            <div className={`px-4 py-2.5 flex items-center gap-3 border-b ${
                              !isDone ? "bg-blue-50" :
                              avgScore >= 7 ? "bg-green-50" :
                              avgScore >= 5 ? "bg-amber-50" : "bg-red-50"
                            }`}>
                              {isDone && avgScore !== null ? (
                                <span className={`text-xl font-bold ${
                                  avgScore >= 7 ? "text-green-600" :
                                  avgScore >= 5 ? "text-amber-600" : "text-red-600"
                                }`}>{avgScore}</span>
                              ) : (
                                <span className="text-xl font-bold text-blue-500 animate-pulse">···</span>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{topic.title}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {result.personaReviews.length}/{reviewPersonas.length} 位审稿人已完成
                                </p>
                              </div>
                            </div>

                            {/* Individual persona reviews */}
                            {result.personaReviews.length > 0 && (
                              <div className="divide-y">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {result.personaReviews.map((pr: any, pi: number) => {
                                  const getS = (v: any) => typeof v === "object" && v !== null ? v.score : Number(v) || 0;
                                  const getR = (v: any) => typeof v === "object" && v !== null ? v.reason : "";
                                  const dims = [
                                    { key: "stop", label: "停留", score: getS(pr.stop), reason: getR(pr.stop) },
                                    { key: "watch", label: "完播", score: getS(pr.watch), reason: getR(pr.watch) },
                                    { key: "engage", label: "互动", score: getS(pr.engage), reason: getR(pr.engage) },
                                    { key: "convert", label: "转化", score: getS(pr.convert), reason: getR(pr.convert) },
                                  ];
                                  const avg = (dims.reduce((s, d) => s + d.score, 0) / 4).toFixed(1);
                                  return (
                                    <details key={pi} className="group">
                                      <summary className="px-4 py-2.5 flex items-start gap-3 cursor-pointer hover:bg-muted/30 list-none">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                                          {pr.personaName?.[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium">{pr.personaName}</span>
                                            <div className="flex items-center gap-1.5">
                                              <div className="flex gap-px">
                                                {dims.map((d) => (
                                                  <span key={d.key} title={d.label} className={`text-[9px] w-6 h-4 flex items-center justify-center rounded-sm font-mono ${
                                                    d.score >= 7 ? "bg-green-100 text-green-700" :
                                                    d.score >= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                                  }`}>{d.score}</span>
                                                ))}
                                              </div>
                                              <span className="text-[10px] font-semibold text-muted-foreground">{avg}</span>
                                              <span className="text-[10px] text-muted-foreground group-open:rotate-90 transition-transform">▶</span>
                                            </div>
                                          </div>
                                          <p className="text-xs text-muted-foreground mt-0.5 italic leading-relaxed">"{pr.comment}"</p>
                                        </div>
                                      </summary>
                                      {/* Collapsed reasoning */}
                                      <div className="px-4 pb-3 ml-9 space-y-1">
                                        {dims.map((d) => (
                                          <div key={d.key} className="flex items-start gap-2 text-[11px]">
                                            <span className={`shrink-0 w-8 text-center rounded-sm py-px font-medium ${
                                              d.score >= 7 ? "bg-green-100 text-green-700" :
                                              d.score >= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                            }`}>{d.label} {d.score}</span>
                                            <span className="text-muted-foreground">{d.reason || "—"}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
      )}

      {/* Phase 1 result: AI-selected trends (persisted across sessions) */}
      {selectedTrends.length > 0 && (
        <Card className="mb-6">
          <CardContent className="py-3">
            <details>
              <summary className="cursor-pointer text-sm font-medium flex items-center gap-2 hover:text-foreground text-muted-foreground">
                <span>AI 精选的 {selectedTrends.length} 条热点（从 {selectedTrendsMeta?.trendsPoolSize ?? trends.length} 条中筛出）</span>
                <span className="text-xs">▼</span>
              </summary>
              <div className="flex flex-wrap gap-2 mt-3">
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
            </details>
          </CardContent>
        </Card>
      )}

      {/* Topic cards */}
      {topics.length > 0 ? (
        <div className="space-y-4">
          {/* Product filter — 仅当品牌有产品时显示 */}
          {account.products.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap" data-testid="product-filter-row">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">产品</span>
              <button
                onClick={() => setFilterProduct(null)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterProduct === null ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                data-testid="product-chip-all"
              >
                全部 ({topics.length})
              </button>
              {genericCount > 0 && (
                <button
                  onClick={() => setFilterProduct("")}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterProduct === "" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                  data-testid="product-chip-generic"
                >
                  通用 ({genericCount})
                </button>
              )}
              {account.products.map((p) => {
                const count = productCounts.get(p.id) || 0;
                if (count === 0 && filterProduct !== p.id) return null;
                return (
                  <button
                    key={p.id}
                    onClick={() => setFilterProduct(p.id)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterProduct === p.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                    data-testid={`product-chip-${p.id}`}
                  >
                    {p.name} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Type filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">类型</span>
            <button
              onClick={() => setFilterType("all")}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterType === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
            >
              全部 ({filteredByProduct.length})
            </button>
            {(["traffic", "trust", "conversion", "persona"] as TopicType[]).map((type) => {
              const count = filteredByProduct.filter((t) => t.type === type).length;
              return count > 0 ? (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterType === type ? TYPE_COLORS[type] + " font-medium" : "bg-muted hover:bg-muted/80"}`}
                >
                  {TOPIC_TYPE_LABELS[type]} ({count})
                </button>
              ) : null;
            })}
            {Object.keys(reviewResults).length > 0 && (
              <button
                onClick={() => setSortBy(sortBy === "score" ? "default" : "score")}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ml-auto cursor-pointer ${sortBy === "score" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
              >
                {sortBy === "score" ? "按评分排序 ✓" : "按评分排序"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {filtered.map((topic) => (
              <Card key={topic.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[topic.type] || ""}`}>
                        {TOPIC_TYPE_LABELS[topic.type] || topic.type}
                      </span>
                      <Badge variant={STATUS_VARIANT[topic.status]} className="text-[10px] h-4 px-1.5">
                        {STATUS_LABEL[topic.status]}
                      </Badge>
                      {/* 产品标签 */}
                      {account.products.length > 0 && (() => {
                        const ids = topic.productIds || [];
                        if (ids.length === 0) {
                          return (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600" title="未绑定具体产品">
                              通用
                            </span>
                          );
                        }
                        const names = ids
                          .map((id) => productNameById.get(id))
                          .filter(Boolean) as string[];
                        const shown = names.slice(0, 2);
                        const extra = names.length - shown.length;
                        return (
                          <>
                            {shown.map((n, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-indigo-100 text-indigo-700">
                                {n}
                              </span>
                            ))}
                            {extra > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-indigo-50 text-indigo-600">
                                +{extra}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {/* Review status badge */}
                    {(() => {
                      const review = getTopicReview(topic.id);
                      if (review?.status === "reviewing") {
                        return (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium animate-pulse">
                            评审中 {review.personaReviews.length}/{reviewPersonas.length}
                          </span>
                        );
                      }
                      if (review?.status === "done" && review.averageScore !== null) {
                        return (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            review.averageScore >= 7 ? "bg-green-100 text-green-700" :
                            review.averageScore >= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                          }`}>
                            {review.averageScore}分
                          </span>
                        );
                      }
                      if (reviewStep !== "idle" && !review) {
                        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">等待中</span>;
                      }
                      return null;
                    })()}
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
        <div className="text-center py-20 max-w-xl mx-auto">
          <h3 className="text-lg font-medium mb-2">选题池为空</h3>
          <p className="text-sm text-muted-foreground mb-6">
            {trends.length > 0
              ? `热点池有 ${trends.length} 条热点，AI 会先筛选最相关的，再生成选题`
              : "请先到「发现」页面抓取热点"}
          </p>

          {/* 空状态下的产品选择 — 让首次生成也能 focus 到某款产品 */}
          {trends.length > 0 && account.products.length > 0 && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-muted/30 border" data-testid="empty-state-product-picker">
              <p className="text-xs text-muted-foreground mb-2">
                本次为哪款产品生成选题？
              </p>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                  onClick={() => setFilterProduct(null)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterProduct === null ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                >
                  AI 自动判断（混合品牌+产品）
                </button>
                <button
                  onClick={() => setFilterProduct("")}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterProduct === "" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                >
                  通用（不绑产品）
                </button>
                {account.products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setFilterProduct(p.id)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterProduct === p.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {trends.length > 0 ? (() => {
            const focusName = filterProduct && filterProduct !== ""
              ? productNameById.get(filterProduct)
              : null;
            const label = loading
              ? "生成中..."
              : focusName
                ? `为「${focusName}」生成选题`
                : filterProduct === ""
                  ? "生成通用选题"
                  : "生成选题";
            return (
              <Button onClick={generateTopics} disabled={loading !== null} size="lg">
                {label}
              </Button>
            );
          })() : (
            <Button onClick={() => router.push("/discover")} size="lg">
              去发现热点 →
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
