"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, X, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import type { SeedanceProvider, SeedanceVariant } from "@/lib/seedance";

interface RefAsset {
  dataUrl: string;
  name: string;
  size: number; // bytes
  type: string; // mime
}

const MAX_IMAGES = 9;
const MAX_VIDEOS = 3;
const MAX_IMAGE_MB = 30;
const MAX_VIDEO_MB = 50;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type ProviderKey = `${SeedanceProvider}_${SeedanceVariant}`;

interface ProviderDef {
  key: ProviderKey;
  provider: SeedanceProvider;
  variant: SeedanceVariant;
  label: string;
}

const PROVIDERS: ProviderDef[] = [
  { key: "tezign_standard", provider: "tezign", variant: "standard", label: "Tezign SD2 API" },
  { key: "tezign_fast", provider: "tezign", variant: "fast", label: "Tezign SD2 Fast API" },
  { key: "shanhai_standard", provider: "shanhai", variant: "standard", label: "Shanhai SD2 API" },
  { key: "shanhai_fast", provider: "shanhai", variant: "fast", label: "Shanhai SD2 Fast API" },
];

// Inline --resolution/--ratio/--duration flags are stripped server-side to avoid
// conflicts with the JSON fields (the dropdowns are the source of truth).
const DEFAULT_PROMPT = `一位穿浅色衬衫的中国年轻女生，坐在窗边的咖啡桌前。她拿起冰镇汽水瓶，对着镜头自然地笑着喝了一口，气泡在瓶口轻轻冒出。午后柔和的自然光从侧面洒在她的脸上，背景是略微虚化的城市街景。整体电影感、日常 Vlog 风格、画面稳定。`;

type RunStatus = "idle" | "submitting" | "polling" | "done" | "failed";

interface RunResult {
  providerKey: ProviderKey;
  label: string;
  status: RunStatus;
  taskId?: string;
  progressMsg?: string;
  videoUrl?: string;
  errorMsg?: string;
  elapsedMs?: number;
  startedAt?: number;
}

function DropZone({
  kind,
  assets,
  onAdd,
  onRemove,
  maxCount,
  maxSizeMb,
  disabled,
}: {
  kind: "image" | "video";
  assets: RefAsset[];
  onAdd: (files: FileList) => void;
  onRemove: (index: number) => void;
  maxCount: number;
  maxSizeMb: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files.length > 0) onAdd(e.dataTransfer.files);
  }

  const slotLeft = maxCount - assets.length;
  const Icon = kind === "image" ? ImageIcon : VideoIcon;
  const label = kind === "image" ? "参考图" : "参考视频";
  const accept = kind === "image" ? "image/*" : "video/*";
  const hint =
    kind === "image"
      ? `支持 jpg/png/webp · 最多 ${maxCount} 张 · 单张 ≤ ${maxSizeMb}MB`
      : `支持 mp4 · 最多 ${maxCount} 个 · 2-15秒 · 单个 ≤ ${maxSizeMb}MB`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium flex items-center gap-1.5">
          <Icon size={14} /> {label}
          <span className="text-muted-foreground font-normal">({assets.length}/{maxCount})</span>
        </span>
      </div>

      {slotLeft > 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-md px-4 py-6 text-center transition-colors ${
            disabled ? "opacity-50 cursor-not-allowed"
              : dragOver ? "border-primary bg-primary/5 cursor-pointer"
              : "border-muted-foreground/30 hover:border-muted-foreground/60 cursor-pointer"
          }`}
        >
          <UploadCloud size={22} className="mx-auto mb-1.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            拖拽{kind === "image" ? "图片" : "视频"}到此处，或点击选择
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple
            disabled={disabled}
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (e.target.files && e.target.files.length > 0) onAdd(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {assets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {assets.map((a, i) => (
            <div key={i} className="relative group w-20 h-20 rounded border overflow-hidden bg-muted">
              {kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.dataUrl} alt={a.name} className="w-full h-full object-cover" />
              ) : (
                <video src={a.dataUrl} className="w-full h-full object-cover" muted />
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                disabled={disabled}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                title="移除"
              >
                <X size={12} />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">
                {(a.size / 1024 / 1024).toFixed(1)}MB
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SeedancePlaygroundPage() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [resolution, setResolution] = useState("720p");
  const [ratio, setRatio] = useState("9:16");
  const [duration, setDuration] = useState(5);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [seed, setSeed] = useState<string>(""); // empty = random (non-reproducible)
  const [refImages, setRefImages] = useState<RefAsset[]>([]);
  const [refVideos, setRefVideos] = useState<RefAsset[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<ProviderKey>>(
    new Set(["tezign_standard", "shanhai_standard"])
  );
  const [results, setResults] = useState<Record<ProviderKey, RunResult>>({} as Record<ProviderKey, RunResult>);
  const [running, setRunning] = useState(false);

  async function addReferenceFiles(files: FileList, kind: "image" | "video") {
    setUploadError(null);
    const existing = kind === "image" ? refImages : refVideos;
    const maxCount = kind === "image" ? MAX_IMAGES : MAX_VIDEOS;
    const maxSizeMb = kind === "image" ? MAX_IMAGE_MB : MAX_VIDEO_MB;
    const expectedPrefix = kind === "image" ? "image/" : "video/";

    const slotLeft = maxCount - existing.length;
    if (slotLeft <= 0) {
      setUploadError(`${kind === "image" ? "参考图" : "参考视频"}数量已达上限（${maxCount}）`);
      return;
    }

    const fileArr = Array.from(files).slice(0, slotLeft);
    const newAssets: RefAsset[] = [];
    for (const f of fileArr) {
      if (!f.type.startsWith(expectedPrefix)) {
        setUploadError(`${f.name} 不是${kind === "image" ? "图片" : "视频"}类型`);
        continue;
      }
      if (f.size > maxSizeMb * 1024 * 1024) {
        setUploadError(`${f.name} 超过 ${maxSizeMb}MB 上限`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(f);
        newAssets.push({ dataUrl, name: f.name, size: f.size, type: f.type });
      } catch {
        setUploadError(`读取 ${f.name} 失败`);
      }
    }
    if (newAssets.length > 0) {
      if (kind === "image") setRefImages((prev) => [...prev, ...newAssets]);
      else setRefVideos((prev) => [...prev, ...newAssets]);
    }
  }

  function removeAsset(kind: "image" | "video", index: number) {
    if (kind === "image") setRefImages((prev) => prev.filter((_, i) => i !== index));
    else setRefVideos((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleProvider(key: ProviderKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function pollUntilDone(def: ProviderDef, taskId: string, startedAt: number) {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const qs = new URLSearchParams({ taskId, provider: def.provider });
        const res = await fetch(`/api/playground/seedance-status?${qs.toString()}`);
        const data = await res.json();
        if (!data.success) {
          setResults((prev) => ({
            ...prev,
            [def.key]: { ...prev[def.key], status: "failed", errorMsg: data.error || "status error" },
          }));
          return;
        }
        const t = data.task;
        const elapsed = Date.now() - startedAt;
        if (t.status === "succeeded" && t.videoUrl) {
          setResults((prev) => ({
            ...prev,
            [def.key]: {
              ...prev[def.key],
              status: "done",
              videoUrl: t.videoUrl,
              progressMsg: "完成",
              elapsedMs: elapsed,
            },
          }));
          return;
        }
        if (t.status === "failed" || t.status === "expired" || t.status === "cancelled") {
          setResults((prev) => ({
            ...prev,
            [def.key]: { ...prev[def.key], status: "failed", errorMsg: t.statusMsg || t.status, elapsedMs: elapsed },
          }));
          return;
        }
        setResults((prev) => ({
          ...prev,
          [def.key]: { ...prev[def.key], status: "polling", progressMsg: `${t.status} · ${Math.round(elapsed / 1000)}s`, elapsedMs: elapsed },
        }));
      } catch (e) {
        setResults((prev) => ({
          ...prev,
          [def.key]: { ...prev[def.key], progressMsg: `轮询错误: ${String(e)}` },
        }));
      }
    }
    setResults((prev) => ({
      ...prev,
      [def.key]: { ...prev[def.key], status: "failed", errorMsg: "超时" },
    }));
  }

  async function runOne(def: ProviderDef) {
    const startedAt = Date.now();
    setResults((prev) => ({
      ...prev,
      [def.key]: {
        providerKey: def.key,
        label: def.label,
        status: "submitting",
        progressMsg: "提交中...",
        startedAt,
      },
    }));
    try {
      const res = await fetch("/api/playground/seedance-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          provider: def.provider,
          variant: def.variant,
          resolution,
          ratio,
          duration,
          generateAudio,
          seed: seed.trim() ? Number(seed.trim()) : undefined,
          referenceImages: refImages.map((a) => a.dataUrl),
          referenceVideos: refVideos.map((a) => a.dataUrl),
        }),
      });
      const data = await res.json();
      if (!data.success || !data.task?.taskId) {
        setResults((prev) => ({
          ...prev,
          [def.key]: { ...prev[def.key], status: "failed", errorMsg: data.error || "提交失败" },
        }));
        return;
      }
      setResults((prev) => ({
        ...prev,
        [def.key]: { ...prev[def.key], status: "polling", taskId: data.task.taskId, progressMsg: "排队中..." },
      }));
      await pollUntilDone(def, data.task.taskId, startedAt);
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [def.key]: { ...prev[def.key], status: "failed", errorMsg: String(e) },
      }));
    }
  }

  async function runAll() {
    if (selected.size === 0) return;
    // Clear previous results so stale errors don't confuse the current run
    setResults({} as Record<ProviderKey, RunResult>);
    setRunning(true);
    const defs = PROVIDERS.filter((p) => selected.has(p.key));
    await Promise.all(defs.map(runOne));
    setRunning(false);
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Seedance 对比测试</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          同一 prompt 并发发给多家 provider，横向对比视频质量 · 仅用于测试，不影响正式生产流
        </p>
      </div>

      {/* Prompt input */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Prompt（发给所有选中的 provider 的完全一致）</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">
            不用在文本里写 --resolution/--ratio/--duration，下面下拉框就是唯一来源
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-36 p-3 text-sm font-mono rounded border bg-background resize-y"
            placeholder="写入你想测试的 prompt..."
          />
          <p className="text-[11px] text-muted-foreground mt-1">{prompt.length} 字符</p>
        </CardContent>
      </Card>

      {/* Reference assets */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            参考资源（可选）
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              Seedance 2.0 支持最多 {MAX_IMAGES} 图 + {MAX_VIDEOS} 视频做多模态参考
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DropZone
            kind="image"
            assets={refImages}
            onAdd={(files) => addReferenceFiles(files, "image")}
            onRemove={(i) => removeAsset("image", i)}
            maxCount={MAX_IMAGES}
            maxSizeMb={MAX_IMAGE_MB}
            disabled={running}
          />
          <DropZone
            kind="video"
            assets={refVideos}
            onAdd={(files) => addReferenceFiles(files, "video")}
            onRemove={(i) => removeAsset("video", i)}
            maxCount={MAX_VIDEOS}
            maxSizeMb={MAX_VIDEO_MB}
            disabled={running}
          />
          {uploadError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {uploadError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Params */}
      <Card className="mb-4">
        <CardContent className="py-4">
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">分辨率</span>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="border rounded px-2 py-1 text-sm bg-background"
              >
                <option value="480p">480p</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
              <span className="text-[11px] text-muted-foreground">
                {resolution === "720p" && "推荐"}
                {resolution === "480p" && "最省钱"}
                {resolution === "1080p" && (
                  <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                    两家账户均未开通，大概率 400 报错
                  </span>
                )}
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">宽高比</span>
              <select
                value={ratio}
                onChange={(e) => setRatio(e.target.value)}
                className="border rounded px-2 py-1 text-sm bg-background"
              >
                <option value="9:16">9:16</option>
                <option value="16:9">16:9</option>
                <option value="1:1">1:1</option>
                <option value="3:4">3:4</option>
                <option value="4:3">4:3</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">时长</span>
              <input
                type="number"
                min={4}
                max={15}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 5)}
                className="border rounded px-2 py-1 text-sm bg-background w-16"
              />
              <span className="text-muted-foreground">秒</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={generateAudio}
                onChange={(e) => setGenerateAudio(e.target.checked)}
              />
              <span>生成音频（lip-sync + 配乐）</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Seed</span>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="留空=随机"
                className="border rounded px-2 py-1 text-sm bg-background w-24"
              />
              <button
                type="button"
                onClick={() => setSeed(String(Math.floor(Math.random() * 1000000)))}
                className="text-[11px] text-primary hover:underline cursor-pointer"
              >
                随机 seed
              </button>
              {seed.trim() && (
                <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                  固定 seed · 可做对照实验
                </span>
              )}
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Provider selection */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">选择 Provider（勾选后并发生成）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map((p) => (
              <label
                key={p.key}
                className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                  selected.has(p.key) ? "bg-primary/5 border-primary" : "bg-background hover:bg-muted"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.key)}
                  onChange={() => toggleProvider(p.key)}
                  disabled={running}
                />
                <span className="text-sm font-medium">{p.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 mb-6">
        <Button onClick={runAll} disabled={running || selected.size === 0} size="lg">
          {running ? `生成中（${Object.values(results).filter((r) => r.status === "done").length}/${selected.size} 完成）...` : `并发生成（${selected.size} 个 provider）`}
        </Button>
        {Object.keys(results).length > 0 && !running && (
          <Button onClick={() => setResults({} as Record<ProviderKey, RunResult>)} variant="outline" size="sm">
            清空结果
          </Button>
        )}
      </div>

      {/* Results grid */}
      {Object.keys(results).length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {PROVIDERS.filter((p) => results[p.key]).map((p) => {
            const r = results[p.key];
            const borderClass =
              r.status === "done" ? "border-green-500"
              : r.status === "failed" ? "border-red-500"
              : "border-amber-500";
            return (
              <Card key={p.key} className={`${borderClass} border-2`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{r.label}</CardTitle>
                    <span className="text-[11px] text-muted-foreground">
                      {r.elapsedMs ? `${Math.round(r.elapsedMs / 1000)}s` : ""}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {r.status === "done" && r.videoUrl ? (
                    <div className="space-y-2">
                      <video
                        src={r.videoUrl}
                        controls
                        className="w-full rounded bg-black"
                        playsInline
                      />
                      <div className="flex justify-between text-[11px]">
                        <a href={r.videoUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground underline">
                          新窗口 ↗
                        </a>
                        <a href={r.videoUrl} download className="text-muted-foreground hover:text-foreground underline">
                          下载
                        </a>
                      </div>
                    </div>
                  ) : r.status === "failed" ? (
                    <div className="text-center py-6 text-red-600 text-sm break-all">
                      ❌ {r.errorMsg}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">{r.progressMsg}</p>
                      {r.taskId && <p className="text-[10px] text-muted-foreground mt-1 font-mono break-all">{r.taskId}</p>}
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
