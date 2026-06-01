"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createAccount, listAccounts } from "@/lib/store";
import type { Account, Product, Persona, BenchmarkAccount, BrandMaterial, MaterialPurpose } from "@/lib/types";
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
  const { t } = useLang();
  const [account, setAccount] = useState<Account>(emptyAccount);
  const [ruleInput, setRuleInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadPurpose, setUploadPurpose] = useState<MaterialPurpose>("brand_guide");

  // /setup 始终从空开始 — 这是"新建品牌"流程
  useEffect(() => {
    setAccount(emptyAccount);
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
    createAccount(account);
    setSaved(true);
    // 新建后刷新页面，让侧边栏切到新品牌
    setTimeout(() => {
      window.location.href = "/";
    }, 600);
  }

  const hasExistingAccounts = listAccounts().length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{hasExistingAccounts ? t("新建品牌", "Create Brand") : t("首次配置", "Initial Setup")}</h1>
          <p className="text-muted-foreground mt-1">
            {hasExistingAccounts
              ? t("新建一个独立品牌空间，与现有品牌完全隔离", "Create an isolated brand workspace, fully separate from existing brands")
              : t("配置品牌信息、产品、目标受众，为 AI 创作提供上下文", "Configure brand info, products, and audience to provide context for AI creation")}
          </p>
        </div>
      </div>

        <Tabs defaultValue="brand" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="brand">{t("品牌信息", "Brand Info")}</TabsTrigger>
            <TabsTrigger value="products">{t("产品库", "Products")}</TabsTrigger>
            <TabsTrigger value="personas">{t("目标受众", "Audience")}</TabsTrigger>
            <TabsTrigger value="benchmarks">{t("对标账号", "Benchmark Accounts")}</TabsTrigger>
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
                  {t("上传品牌手册、产品资料等图片，AI 自动识别内容。支持多个文件，每个可指定用途。", "Upload brand guidelines, product materials and other images — AI extracts content automatically. Supports multiple files, each with a configurable purpose.")}
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
                      {uploadingId ? t("AI 识别中...", "AI extracting...") : t("选择图片", "Choose images")}
                    </span>
                  </label>
                  <span className="text-xs text-muted-foreground">{t("支持多选，PNG / JPEG / WebP", "Multi-select supported · PNG / JPEG / WebP")}</span>
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
                              <Badge variant="secondary">{t("识别中...", "Extracting...")}</Badge>
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
                <CardTitle>{t("品牌基础信息", "Basic Brand Info")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountName">{t("账号名称", "Account Name")}</Label>
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
                  <Label htmlFor="brandName">{t("品牌名称", "Brand Name")}</Label>
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
                    placeholder={t("如：母婴、美妆、汽车、餐饮...", "e.g. baby & maternity, beauty, automotive, F&B...")}
                    value={account.brand.industry}
                    onChange={(e) => updateBrand("industry", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tone">{t("品牌调性", "Brand Tone")}</Label>
                  <Textarea
                    id="tone"
                    placeholder={t("描述品牌的语言风格和调性，如：年轻活泼、偏口语化、喜欢用网络热梗...", "Describe the brand's language style and tone, e.g. youthful and lively, conversational, fond of internet memes...")}
                    value={account.brand.tone}
                    onChange={(e) => updateBrand("tone", e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("品牌规则 / 红线", "Brand Rules / Red Lines")}</Label>
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
                    {t("添加产品", "Add Product")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {account.products.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    {t('暂无产品，点击"添加产品"开始', 'No products yet — click "Add Product" to begin')}
                  </p>
                )}
                {account.products.map((product, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{t(`产品 ${i + 1}`, `Product ${i + 1}`)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeProduct(i)}
                      >
                        {t("删除", "Delete")}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>{t("产品名称", "Product Name")}</Label>
                        <Input
                          placeholder={t("产品名", "Product name")}
                          value={product.name}
                          onChange={(e) => updateProduct(i, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{t("卖点（逗号分隔）", "Selling Points (comma-separated)")}</Label>
                        <Input
                          placeholder={t("卖点1, 卖点2, 卖点3", "Point 1, Point 2, Point 3")}
                          value={product.sellingPoints.join(", ")}
                          onChange={(e) =>
                            updateProduct(
                              i,
                              "sellingPoints",
                              e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>{t("产品描述", "Product Description")}</Label>
                      <Textarea
                        placeholder={t("详细描述产品特点、适用人群等", "Describe product features, target users, etc.")}
                        value={product.description}
                        onChange={(e) => updateProduct(i, "description", e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("产品图片路径（逗号分隔）", "Product Image Paths (comma-separated)")}</Label>
                      <Input
                        placeholder="/test-assets/product-front.png, /test-assets/product-side.png"
                        value={product.imagePaths.join(", ")}
                        onChange={(e) =>
                          updateProduct(
                            i,
                            "imagePaths",
                            e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                          )
                        }
                      />
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
                    {t("添加受众", "Add Persona")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {account.personas.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    {t("描述 1~2 个典型目标受众，帮助 AI 更好地生成内容", "Describe 1-2 typical target personas to help AI generate better content")}
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
                        placeholder={t("如：新手妈妈小王", "e.g. First-time mom Wang")}
                        value={persona.name}
                        onChange={(e) => updatePersona(i, "name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("描述", "Description")}</Label>
                      <Textarea
                        placeholder={t("如：25岁，第一个宝宝6个月大，关注辅食和早教，价格敏感，喜欢看真实测评", "e.g. 25 years old, first baby is 6 months old, focused on weaning food and early education, price-sensitive, enjoys honest reviews")}
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
                    {t("添加对标", "Add Benchmark")}
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
                        placeholder={t("如：同品类头部账号，风格偏搞笑", "e.g. Top account in same category, comedic style")}
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
          <span className="text-sm text-green-600">{t("已创建，跳转中...", "Created, redirecting...")}</span>
        )}
        <Button onClick={handleSave} size="lg" disabled={saved}>
          {hasExistingAccounts ? t("创建品牌", "Create Brand") : t("保存设置", "Save Settings")}
        </Button>
      </div>
    </div>
  );
}
