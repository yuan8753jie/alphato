"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { saveAccount, getAccount } from "@/lib/store";
import type { Account, Product, Persona, BenchmarkAccount, BrandMaterial, MaterialPurpose, ProductDocument } from "@/lib/types";
import { MATERIAL_PURPOSE_LABELS } from "@/lib/types";
import { useLang } from "@/lib/i18n";

const emptyAccount: Account = {
  id: "",
  name: "",
  platform: "douyin",
  accountUrl: "",
  brand: { name: "", tone: "", rules: [], industry: "" },
  brandMaterials: [],
  products: [],
  personas: [],
  benchmarkAccounts: [],
  topics: [],
  scripts: [],
  trends: [],
  trendsDate: null,
  reviewPersonas: null,
  reviewResults: null,
  selectedTrendsMeta: null,
};

export default function SetupPage() {
  const router = useRouter();
  const { t } = useLang();
  const [account, setAccount] = useState<Account>(emptyAccount);
  const [ruleInput, setRuleInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadPurpose, setUploadPurpose] = useState<MaterialPurpose>("brand_guide");
  const [searchingProductImage, setSearchingProductImage] = useState<number | null>(null);

  useEffect(() => {
    const existing = getAccount();
    if (existing) {
      setAccount({ ...emptyAccount, ...existing, brandMaterials: existing.brandMaterials || [] });
    }
  }, []);

  function updateBrand(field: string, value: string) {
    setAccount((prev) => ({
      ...prev,
      brand: { ...prev.brand, [field]: value },
    }));
  }

  function addRule() {
    if (!ruleInput.trim()) return;
    setAccount((prev) => ({
      ...prev,
      brand: { ...prev.brand, rules: [...prev.brand.rules, ruleInput.trim()] },
    }));
    setRuleInput("");
  }

  function removeRule(index: number) {
    setAccount((prev) => ({
      ...prev,
      brand: {
        ...prev.brand,
        rules: prev.brand.rules.filter((_, i) => i !== index),
      },
    }));
  }

  // Product management
  function addProduct() {
    setAccount((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        { id: crypto.randomUUID(), name: "", description: "", sellingPoints: [], imagePaths: [], links: [] },
      ],
    }));
  }

  function updateProduct(index: number, field: keyof Product, value: string | string[]) {
    setAccount((prev) => ({
      ...prev,
      products: prev.products.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    }));
  }

  function removeProduct(index: number) {
    setAccount((prev) => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index),
    }));
  }

  // 文档管理
  const [uploadingDocForProduct, setUploadingDocForProduct] = useState<number | null>(null);
  const [expandedDocIds, setExpandedDocIds] = useState<Set<string>>(new Set());

  function addDocToProduct(productIndex: number, doc: ProductDocument) {
    setAccount((prev) => ({
      ...prev,
      products: prev.products.map((p, i) =>
        i === productIndex ? { ...p, documents: [...(p.documents || []), doc] } : p
      ),
    }));
  }

  function removeDocFromProduct(productIndex: number, docId: string) {
    setAccount((prev) => ({
      ...prev,
      products: prev.products.map((p, i) =>
        i === productIndex
          ? { ...p, documents: (p.documents || []).filter((d) => d.id !== docId) }
          : p
      ),
    }));
  }

  async function handleProductDocUpload(productIndex: number, file: File) {
    const product = account.products[productIndex];
    if (!product?.id || !account.id) return;
    setUploadingDocForProduct(productIndex);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("accountId", account.id);
      formData.append("productId", product.id);
      const res = await fetch("/api/extract-product-doc", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.document) {
        addDocToProduct(productIndex, data.document as ProductDocument);
      } else {
        alert(t("文档解析失败：", "Document parsing failed: ") + (data.error || t("未知错误", "Unknown error")));
      }
    } catch (err) {
      alert(t("上传失败：", "Upload failed: ") + String(err));
    } finally {
      setUploadingDocForProduct(null);
    }
  }

  async function handleDocDelete(productIndex: number, doc: ProductDocument) {
    // 先删服务器文件（失败不阻塞 UI 删除）
    try {
      await fetch("/api/delete-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: doc.fileUrl }),
      });
    } catch { /* ignore */ }
    removeDocFromProduct(productIndex, doc.id);
  }

  function toggleDocExpanded(docId: string) {
    setExpandedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      return next;
    });
  }

  // Persona management
  function addPersona() {
    setAccount((prev) => ({
      ...prev,
      personas: [...prev.personas, { name: "", description: "" }],
    }));
  }

  function updatePersona(index: number, field: keyof Persona, value: string) {
    setAccount((prev) => ({
      ...prev,
      personas: prev.personas.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    }));
  }

  function removePersona(index: number) {
    setAccount((prev) => ({
      ...prev,
      personas: prev.personas.filter((_, i) => i !== index),
    }));
  }

  // Benchmark account management
  function addBenchmark() {
    setAccount((prev) => ({
      ...prev,
      benchmarkAccounts: [...prev.benchmarkAccounts, { url: "", notes: "" }],
    }));
  }

  function updateBenchmark(index: number, field: keyof BenchmarkAccount, value: string) {
    setAccount((prev) => ({
      ...prev,
      benchmarkAccounts: prev.benchmarkAccounts.map((b, i) =>
        i === index ? { ...b, [field]: value } : b
      ),
    }));
  }

  function removeBenchmark(index: number) {
    setAccount((prev) => ({
      ...prev,
      benchmarkAccounts: prev.benchmarkAccounts.filter((_, i) => i !== index),
    }));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const tempId = crypto.randomUUID();
      const newMaterial: BrandMaterial = {
        id: tempId,
        fileName: file.name,
        purpose: uploadPurpose,
        extractedText: "",
        uploadedAt: new Date().toISOString(),
      };

      setAccount((prev) => ({
        ...prev,
        brandMaterials: [...prev.brandMaterials, newMaterial],
      }));

      setUploadingId(tempId);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/extract-brand", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (data.success && data.extracted) {
          const ext = data.extracted;
          const summary = ext.summary || JSON.stringify(ext, null, 2);

          setAccount((prev) => ({
            ...prev,
            brandMaterials: prev.brandMaterials.map((m) =>
              m.id === tempId ? { ...m, extractedText: summary } : m
            ),
          }));
        } else {
          setAccount((prev) => ({
            ...prev,
            brandMaterials: prev.brandMaterials.map((m) =>
              m.id === tempId
                ? { ...m, extractedText: t("提取失败：", "Extraction failed: ") + (data.error || t("未知错误", "Unknown error")) }
                : m
            ),
          }));
        }
      } catch (err) {
        setAccount((prev) => ({
          ...prev,
          brandMaterials: prev.brandMaterials.map((m) =>
            m.id === tempId
              ? { ...m, extractedText: t("请求失败：", "Request failed: ") + String(err) }
              : m
          ),
        }));
      } finally {
        setUploadingId(null);
      }
    }

    e.target.value = "";
  }

  function updateMaterialPurpose(id: string, purpose: MaterialPurpose) {
    setAccount((prev) => ({
      ...prev,
      brandMaterials: prev.brandMaterials.map((m) =>
        m.id === id ? { ...m, purpose } : m
      ),
    }));
  }

  function removeMaterial(id: string) {
    setAccount((prev) => ({
      ...prev,
      brandMaterials: prev.brandMaterials.filter((m) => m.id !== id),
    }));
  }

  function handleSave() {
    saveAccount(account);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("账号工作区设置", "Account Workspace Settings")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("配置品牌信息、产品、目标受众，为 AI 创作提供上下文", "Configure brand info, products, and target audience to give AI creative context")}
          </p>
        </div>
      </div>

        <Tabs defaultValue="brand" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="brand">{t("品牌信息", "Brand")}</TabsTrigger>
            <TabsTrigger value="products">{t("产品库", "Products")}</TabsTrigger>
            <TabsTrigger value="personas">{t("目标受众", "Audience")}</TabsTrigger>
            <TabsTrigger value="benchmarks">{t("对标账号", "Benchmarks")}</TabsTrigger>
          </TabsList>

          {/* 品牌信息 */}
          <TabsContent value="brand">
            {/* 上传品牌资料 */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>{t("品牌资料库", "Brand Asset Library")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t("上传品牌手册、产品资料等图片，AI 自动识别内容。支持多个文件，每个可指定用途。", "Upload images of brand guides, product materials, etc. AI will recognize the content automatically. Multiple files supported, each with its own purpose.")}
                </p>
                <div className="flex items-center gap-3">
                  <select
                    className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                    value={uploadPurpose}
                    onChange={(e) => setUploadPurpose(e.target.value as MaterialPurpose)}
                  >
                    {Object.entries(MATERIAL_PURPOSE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={!!uploadingId}
                      multiple
                    />
                    <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                      {uploadingId ? t("AI 识别中...", "AI analyzing...") : t("选择图片", "Choose images")}
                    </span>
                  </label>
                  <span className="text-xs text-muted-foreground">{t("支持多选，PNG / JPEG / WebP", "Multi-select, PNG / JPEG / WebP")}</span>
                </div>

                {account.brandMaterials.length > 0 && (
                  <div className="space-y-3 mt-4">
                    {account.brandMaterials.map((material) => (
                      <div key={material.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{material.fileName}</span>
                            <select
                              className="h-7 rounded border border-input bg-transparent px-2 text-xs"
                              value={material.purpose}
                              onChange={(e) => updateMaterialPurpose(material.id, e.target.value as MaterialPurpose)}
                            >
                              {Object.entries(MATERIAL_PURPOSE_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                            {uploadingId === material.id && (
                              <Badge variant="secondary">{t("识别中...", "Analyzing...")}</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => removeMaterial(material.id)}
                          >
                            {t("删除", "Delete")}
                          </Button>
                        </div>
                        {material.extractedText && (
                          <div className="p-2 bg-muted rounded text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {material.extractedText}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("品牌基础信息", "Brand Basics")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountName">{t("账号名称", "Account name")}</Label>
                    <Input
                      id="accountName"
                      placeholder={t("如：品牌A官方抖音号", "e.g. Brand A Official Douyin")}
                      value={account.name}
                      onChange={(e) =>
                        setAccount((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="platform">{t("平台", "Platform")}</Label>
                    <select
                      id="platform"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                      value={account.platform}
                      onChange={(e) =>
                        setAccount((prev) => ({
                          ...prev,
                          platform: e.target.value as Account["platform"],
                        }))
                      }
                    >
                      <option value="douyin">{t("抖音", "Douyin")}</option>
                      <option value="tiktok">TikTok</option>
                      <option value="xiaohongshu">{t("小红书", "Xiaohongshu")}</option>
                      <option value="instagram">Instagram</option>
                      <option value="kuaishou">{t("快手", "Kuaishou")}</option>
                      <option value="wechat">{t("微信视频号", "WeChat Channels")}</option>
                      <option value="youtube">YouTube</option>
                      <option value="bilibili">Bilibili</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountUrl">{t("账号链接（可选）", "Account URL (optional)")}</Label>
                  <Input
                    id="accountUrl"
                    placeholder="https://www.douyin.com/user/xxx"
                    value={account.accountUrl}
                    onChange={(e) =>
                      setAccount((prev) => ({ ...prev, accountUrl: e.target.value }))
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="brandName">{t("品牌名称", "Brand name")}</Label>
                  <Input
                    id="brandName"
                    placeholder={t("品牌名", "Brand name")}
                    value={account.brand.name}
                    onChange={(e) => updateBrand("name", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">{t("所属行业", "Industry")}</Label>
                  <Input
                    id="industry"
                    placeholder={t("如：母婴、美妆、汽车、餐饮...", "e.g. Baby care, Beauty, Auto, F&B...")}
                    value={account.brand.industry}
                    onChange={(e) => updateBrand("industry", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tone">{t("品牌调性", "Brand tone")}</Label>
                  <Textarea
                    id="tone"
                    placeholder={t("描述品牌的语言风格和调性，如：年轻活泼、偏口语化、喜欢用网络热梗...", "Describe the brand's voice and tone, e.g. young and playful, conversational, fond of internet memes...")}
                    value={account.brand.tone}
                    onChange={(e) => updateBrand("tone", e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("品牌规则 / 红线", "Brand rules / Red lines")}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("添加规则，如：不提竞品名字", "Add a rule, e.g. don't mention competitor names")}
                      value={ruleInput}
                      onChange={(e) => setRuleInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addRule()}
                    />
                    <Button onClick={addRule} variant="outline">
                      {t("添加", "Add")}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {account.brand.rules.map((rule, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => removeRule(i)}
                      >
                        {rule} ✕
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 产品库 */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t("产品库", "Products")}</CardTitle>
                  <Button onClick={addProduct} size="sm">
                    {t("添加产品", "Add product")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {account.products.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    {t("暂无产品，点击\"添加产品\"开始。添加后 AI 会自动搜索产品信息和图片。", "No products yet. Click \"Add product\" to start. AI will then search for product info and images automatically.")}
                  </p>
                )}
                {account.products.map((product, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Input
                          placeholder={t("产品名称（如：雪碧无糖）", "Product name (e.g. Sprite Zero)")}
                          value={product.name}
                          onChange={(e) => updateProduct(i, "name", e.target.value)}
                          className="max-w-xs"
                        />
                        <label className="cursor-pointer shrink-0">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={async (e) => {
                              const files = e.target.files;
                              if (!files || files.length === 0) return;
                              if (!account.id || !product.id) {
                                alert(t("请先保存品牌设置再上传图片", "Save brand settings before uploading images"));
                                e.target.value = "";
                                return;
                              }
                              // 并行上传到服务器；只把返回的 URL 存进 state
                              const uploaded = await Promise.all(
                                Array.from(files).map(async (f) => {
                                  const form = new FormData();
                                  form.append("file", f);
                                  form.append("accountId", account.id);
                                  form.append("productId", product.id);
                                  try {
                                    const res = await fetch("/api/upload-product-image", { method: "POST", body: form });
                                    const data = await res.json();
                                    return data.success && data.url ? (data.url as string) : null;
                                  } catch {
                                    return null;
                                  }
                                })
                              );
                              const urls = uploaded.filter((u): u is string => Boolean(u));
                              if (urls.length === 0) {
                                alert(t("图片上传失败", "Image upload failed"));
                                e.target.value = "";
                                return;
                              }
                              const targetIndex = i;
                              setAccount((prev) => ({
                                ...prev,
                                products: prev.products.map((p, idx) =>
                                  idx === targetIndex
                                    ? { ...p, imagePaths: [...p.imagePaths, ...urls] }
                                    : p
                                ),
                              }));
                              e.target.value = "";
                            }}
                          />
                          <span className="text-xs px-2.5 py-1.5 rounded border hover:bg-muted transition-colors">
                            {t("上传图片", "Upload images")}
                          </span>
                        </label>
                        <button
                          className="text-xs px-2.5 py-1.5 rounded border hover:bg-muted transition-colors disabled:opacity-50 shrink-0"
                          disabled={!product.name || searchingProductImage === i}
                          onClick={async () => {
                            if (!product.name) return;
                            setSearchingProductImage(i);
                            try {
                              const res = await fetch("/api/search-product-images", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ productName: product.name, brandName: account.brand.name }),
                              });
                              const data = await res.json();
                              const urls: string[] = [];
                              // Collect image URLs from LLM response
                              if (data.images?.length > 0) {
                                urls.push(...data.images.map((img: { url: string }) => img.url));
                              }
                              // Also collect grounding URLs as reference
                              if (data.groundingUrls?.length > 0) {
                                urls.push(...data.groundingUrls.map((g: { url: string }) => g.url));
                              }
                              if (urls.length > 0) {
                                updateProduct(i, "imagePaths", [...product.imagePaths, ...urls.slice(0, 10)]);
                              }
                            } catch { /* ignore */ }
                            finally { setSearchingProductImage(null); }
                          }}
                        >
                          {searchingProductImage === i ? t("搜索中...", "Searching...") : t("AI 搜索产品图", "AI find product images")}
                        </button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeProduct(i)}
                      >
                        {t("删除", "Delete")}
                      </Button>
                    </div>
                    {/* Image thumbnails */}
                    {product.imagePaths.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {product.imagePaths.map((img, j) => (
                          <div key={j} className="relative group">
                            <img
                              src={img}
                              alt={`${product.name} ${j + 1}`}
                              className="w-16 h-16 object-cover rounded border"
                            />
                            <button
                              onClick={async () => {
                                // 自家上传的图（OSS CDN URL 或老的 /uploads/）顺手清后端；
                                // 外链图（如 AI 搜索得到的）只从 state 移除
                                const isOurs = img.startsWith("/uploads/")
                                  || img.startsWith("https://videomixer-files.tezign.com/")
                                  || img.startsWith("https://tezign-videomixer.oss-cn-beijing.aliyuncs.com/");
                                if (isOurs) {
                                  try {
                                    await fetch("/api/delete-upload", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ fileUrl: img }),
                                    });
                                  } catch { /* ignore */ }
                                }
                                updateProduct(i, "imagePaths", product.imagePaths.filter((_, k) => k !== j));
                              }}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 产品文档 */}
                    <div className="space-y-2 pt-2 border-t" data-testid={`product-docs-${product.id}`}>
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">{t("产品文档", "Product Documents")}</Label>
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain"
                            className="hidden"
                            disabled={uploadingDocForProduct === i}
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (f) await handleProductDocUpload(i, f);
                              e.target.value = "";
                            }}
                          />
                          <span className="text-xs px-2.5 py-1 rounded border hover:bg-muted transition-colors inline-block">
                            {uploadingDocForProduct === i ? t("AI 解析中...", "AI parsing...") : t("上传文档", "Upload document")}
                          </span>
                        </label>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {t("支持 PDF / Markdown / TXT，每个 ≤ 20MB。上传后 AI 自动提取卖点、受众、关键功能。", "Supports PDF / Markdown / TXT, ≤ 20MB each. After upload, AI extracts selling points, audience, and key features automatically.")}
                      </p>
                      {(product.documents || []).length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic">{t("暂无文档", "No documents yet")}</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(product.documents || []).map((doc) => {
                            const expanded = expandedDocIds.has(doc.id);
                            return (
                              <div key={doc.id} className="border rounded-md text-xs" data-testid={`product-doc-${doc.id}`}>
                                <div className="flex items-center gap-2 p-2">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium shrink-0 uppercase">
                                    {doc.fileType}
                                  </span>
                                  <a
                                    href={doc.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 truncate hover:underline"
                                    title={doc.fileName}
                                  >
                                    {doc.fileName}
                                  </a>
                                  <button
                                    onClick={() => toggleDocExpanded(doc.id)}
                                    className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                                  >
                                    {expanded ? t("收起", "Collapse") : t("查看摘要", "View summary")}
                                  </button>
                                  <button
                                    onClick={() => handleDocDelete(i, doc)}
                                    className="text-[10px] text-destructive hover:underline cursor-pointer"
                                  >
                                    {t("删除", "Delete")}
                                  </button>
                                </div>
                                {expanded && (
                                  <div className="px-2 pb-2 space-y-1.5 border-t pt-2 bg-muted/30">
                                    {doc.extracted.positioning && (
                                      <div>
                                        <span className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">{t("定位", "Positioning")}</span>
                                        <p className="text-[11px] mt-0.5">{doc.extracted.positioning}</p>
                                      </div>
                                    )}
                                    {doc.extracted.targetAudience && (
                                      <div>
                                        <span className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">{t("受众", "Audience")}</span>
                                        <p className="text-[11px] mt-0.5">{doc.extracted.targetAudience}</p>
                                      </div>
                                    )}
                                    {doc.extracted.sellingPoints.length > 0 && (
                                      <div>
                                        <span className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">{t("卖点", "Selling points")}</span>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          {doc.extracted.sellingPoints.map((sp, k) => (
                                            <span key={k} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px]">{sp}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {doc.extracted.keyFeatures.length > 0 && (
                                      <div>
                                        <span className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">{t("关键功能", "Key features")}</span>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          {doc.extracted.keyFeatures.map((f, k) => (
                                            <span key={k} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">{f}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {doc.extracted.scenarios.length > 0 && (
                                      <div>
                                        <span className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">{t("使用场景", "Use cases")}</span>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          {doc.extracted.scenarios.map((s, k) => (
                                            <span key={k} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px]">{s}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {doc.extracted.summary && (
                                      <div>
                                        <span className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">{t("摘要", "Summary")}</span>
                                        <p className="text-[11px] mt-0.5 whitespace-pre-wrap leading-relaxed">{doc.extracted.summary}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 目标受众 */}
          <TabsContent value="personas">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t("目标受众 Persona", "Target Audience Personas")}</CardTitle>
                  <Button onClick={addPersona} size="sm">
                    {t("添加受众", "Add persona")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {account.personas.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    {t("描述 1~2 个典型目标受众，帮助 AI 更好地生成内容", "Describe 1-2 typical personas to help AI produce better content")}
                  </p>
                )}
                {account.personas.map((persona, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{t(`受众 ${i + 1}`, `Persona ${i + 1}`)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removePersona(i)}
                      >
                        {t("删除", "Delete")}
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label>{t("名称", "Name")}</Label>
                      <Input
                        placeholder={t("如：新手妈妈小王", "e.g. New mom Wang")}
                        value={persona.name}
                        onChange={(e) => updatePersona(i, "name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("描述", "Description")}</Label>
                      <Textarea
                        placeholder={t("如：25岁，第一个宝宝6个月大，关注辅食和早教，价格敏感，喜欢看真实测评", "e.g. Age 25, first baby is 6 months old, cares about baby food and early education, price-sensitive, likes authentic reviews")}
                        value={persona.description}
                        onChange={(e) => updatePersona(i, "description", e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 对标账号 */}
          <TabsContent value="benchmarks">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t("对标账号", "Benchmark Accounts")}</CardTitle>
                  <Button onClick={addBenchmark} size="sm">
                    {t("添加对标", "Add benchmark")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {account.benchmarkAccounts.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    {t("添加对标账号，帮助 AI 理解你想要的内容方向", "Add benchmark accounts to help AI understand the content direction you want")}
                  </p>
                )}
                {account.benchmarkAccounts.map((benchmark, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{t(`对标 ${i + 1}`, `Benchmark ${i + 1}`)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeBenchmark(i)}
                      >
                        {t("删除", "Delete")}
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label>{t("账号链接", "Account URL")}</Label>
                      <Input
                        placeholder="https://www.douyin.com/user/xxx"
                        value={benchmark.url}
                        onChange={(e) => updateBenchmark(i, "url", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("备注", "Notes")}</Label>
                      <Input
                        placeholder={t("如：同品类头部账号，风格偏搞笑", "e.g. Top account in the same category, comedic style")}
                        value={benchmark.notes}
                        onChange={(e) => updateBenchmark(i, "notes", e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      <div className="flex items-center justify-end gap-3 mt-8">
        {saved && (
          <span className="text-sm text-green-600">{t("已保存", "Saved")}</span>
        )}
        <Button onClick={handleSave} size="lg">
          {t("保存设置", "Save settings")}
        </Button>
      </div>
    </div>
  );
}
