"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAccount, getScripts, getTopics } from "@/lib/store";
import type { Account, Script, Topic, ScriptVariant } from "@/lib/types";

const VARIANT_LABEL: Record<ScriptVariant, string> = {
  "free-voiceover": "稳健·口播",
  "free-music": "稳健·音乐",
  "creative-voiceover": "创意·口播",
  "creative-music": "创意·音乐",
};

const VARIANT_COLOR: Record<ScriptVariant, string> = {
  "free-voiceover": "bg-blue-100 text-blue-700",
  "free-music": "bg-cyan-100 text-cyan-700",
  "creative-voiceover": "bg-purple-100 text-purple-700",
  "creative-music": "bg-pink-100 text-pink-700",
};

function formatTime(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export default function HistoryPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterProduct, setFilterProduct] = useState<string | null>(null);
  const [filterVariant, setFilterVariant] = useState<ScriptVariant | "all">("all");

  useEffect(() => {
    setAccount(getAccount());
    setScripts(getScripts());
    setTopics(getTopics());
  }, []);

  const productNameById = useMemo(
    () => new Map((account?.products || []).map((p) => [p.id, p.name])),
    [account],
  );
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);

  const videoScripts = useMemo(() => {
    const filtered = scripts
      .filter((s) => s.videoUrl)
      .filter((s) => filterProduct === null || s.productId === filterProduct)
      .filter((s) => filterVariant === "all" || s.variant === filterVariant);
    // 按生成时间倒序；没有 videoGeneratedAt 则 fallback 到 createdAt
    return [...filtered].sort((a, b) => {
      const ta = a.videoGeneratedAt || a.createdAt;
      const tb = b.videoGeneratedAt || b.createdAt;
      return tb.localeCompare(ta);
    });
  }, [scripts, filterProduct, filterVariant]);

  // 按产品统计
  const productCounts = useMemo(() => {
    const m = new Map<string | null, number>();
    for (const s of scripts) {
      if (!s.videoUrl) continue;
      const key = s.productId || null;
      m.set(key, (m.get(key) || 0) + 1);
    }
    return m;
  }, [scripts]);
  const totalWithVideo = scripts.filter((s) => s.videoUrl).length;

  if (!account) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-sm">还没有配置品牌</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">生成历史</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          当前品牌「{account.brand.name || account.name}」累计生成 {totalWithVideo} 条视频。每条记录含视频成片、发送给 Seedance 的 prompt、参考图与分镜快照。
        </p>
      </div>

      {totalWithVideo === 0 ? (
        <div className="text-center py-20 max-w-md mx-auto">
          <h3 className="text-lg font-medium mb-2">暂无生成记录</h3>
          <p className="text-sm text-muted-foreground mb-4">
            去选题详情页点「生成视频」，完成的成片会出现在这里。
          </p>
          <Link href="/topics">
            <Button>去选题</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 筛选 */}
          {account.products.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">产品</span>
              <button
                onClick={() => setFilterProduct(null)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterProduct === null ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
              >
                全部 ({totalWithVideo})
              </button>
              {account.products.map((p) => {
                const cnt = productCounts.get(p.id) || 0;
                if (cnt === 0) return null;
                return (
                  <button
                    key={p.id}
                    onClick={() => setFilterProduct(p.id)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterProduct === p.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                  >
                    {p.name} ({cnt})
                  </button>
                );
              })}
              {(productCounts.get(null) || 0) > 0 && (
                <button
                  onClick={() => setFilterProduct("")}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterProduct === "" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
                >
                  通用 ({productCounts.get(null) || 0})
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">变体</span>
            <button
              onClick={() => setFilterVariant("all")}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterVariant === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
            >
              全部
            </button>
            {(Object.keys(VARIANT_LABEL) as ScriptVariant[]).map((v) => (
              <button
                key={v}
                onClick={() => setFilterVariant(v)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterVariant === v ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
              >
                {VARIANT_LABEL[v]}
              </button>
            ))}
          </div>

          {/* 列表 */}
          {videoScripts.map((s) => {
            const expanded = expandedId === s.id;
            const topic = topicById.get(s.topicId);
            const productName = s.productId ? productNameById.get(s.productId) : null;
            const variant = s.variant as ScriptVariant | undefined;
            return (
              <Card key={s.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* 视频 */}
                    <video
                      src={s.videoUrl}
                      controls
                      playsInline
                      className="w-40 shrink-0 rounded-md bg-black aspect-[9/16] object-cover"
                    />
                    {/* 元信息 */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {variant && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${VARIANT_COLOR[variant]}`}>
                            {VARIANT_LABEL[variant]}
                          </span>
                        )}
                        {productName ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-indigo-100 text-indigo-700">
                            {productName}
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600">通用</span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">{formatTime(s.videoGeneratedAt || s.createdAt)}</span>
                      </div>
                      <h3 className="font-medium text-sm truncate">{s.title || topic?.title || "（无标题）"}</h3>
                      {s.hook && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{s.hook}</p>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                        <span>分镜 {s.scenes?.length || 0}</span>
                        <span>·</span>
                        <span>参考图 {s.videoReferenceImages?.length || 0}</span>
                        <span>·</span>
                        <span>{s.totalDuration || "—"} 秒</span>
                        <div className="ml-auto flex items-center gap-2">
                          {topic && (
                            <Link href={`/topics/${topic.id}`} className="text-foreground hover:underline">
                              → 选题
                            </Link>
                          )}
                          <button
                            onClick={() => setExpandedId(expanded ? null : s.id)}
                            className="text-foreground hover:underline cursor-pointer"
                          >
                            {expanded ? "收起" : "详情"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 展开：prompt / 参考图 / 分镜 */}
                  {expanded && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {s.videoPrompt && (
                        <details open className="rounded-md border bg-muted/30 p-3">
                          <summary className="text-xs font-semibold cursor-pointer">发送给 Seedance 的完整 prompt</summary>
                          <pre className="text-[11px] whitespace-pre-wrap mt-2 leading-relaxed font-mono">{s.videoPrompt}</pre>
                        </details>
                      )}

                      {(s.videoReferenceImages?.length || 0) > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold mb-2">参考图（{s.videoReferenceImages!.length} 张）</h4>
                          <div className="flex gap-2 flex-wrap">
                            {s.videoReferenceImages!.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-16 h-16 rounded border overflow-hidden hover:ring-2 hover:ring-primary/40 transition">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`ref ${i + 1}`} className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {(s.scenes?.length || 0) > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold mb-2">分镜快照（{s.scenes.length} 个）</h4>
                          <div className="space-y-2">
                            {s.scenes.map((scene, i) => (
                              <div key={i} className="text-[11px] border-l-2 border-muted pl-3 py-1">
                                <div className="text-muted-foreground">
                                  Shot {scene.sceneNumber}
                                  {scene.shotType && <span> · {scene.shotType}</span>}
                                  {scene.duration && <span> · {scene.duration}s</span>}
                                </div>
                                <div className="mt-0.5">{scene.visual}</div>
                                {scene.text && <div className="text-muted-foreground italic mt-0.5">"{scene.text}"</div>}
                                {scene.audio && <div className="text-muted-foreground mt-0.5">🎵 {scene.audio}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 text-xs">
                        <a href={s.videoUrl} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">
                          视频新窗口打开 ↗
                        </a>
                        <a href={s.videoUrl} download className="text-foreground hover:underline">
                          下载视频
                        </a>
                        {s.videoTaskId && (
                          <span className="text-muted-foreground ml-auto">Seedance taskId: <span className="font-mono">{s.videoTaskId}</span></span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
