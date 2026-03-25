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
import type { Account, Product, Persona, BenchmarkAccount, BrandMaterial, MaterialPurpose } from "@/lib/types";
import { MATERIAL_PURPOSE_LABELS } from "@/lib/types";

const emptyAccount: Account = {
  name: "",
  platform: "douyin",
  accountUrl: "",
  brand: { name: "", tone: "", rules: [], industry: "" },
  brandMaterials: [],
  products: [],
  personas: [],
  benchmarkAccounts: [],
};

export default function SetupPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account>(emptyAccount);
  const [ruleInput, setRuleInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadPurpose, setUploadPurpose] = useState<MaterialPurpose>("brand_guide");

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
        { name: "", description: "", sellingPoints: [], imagePaths: [], links: [] },
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
                ? { ...m, extractedText: "提取失败：" + (data.error || "未知错误") }
                : m
            ),
          }));
        }
      } catch (err) {
        setAccount((prev) => ({
          ...prev,
          brandMaterials: prev.brandMaterials.map((m) =>
            m.id === tempId
              ? { ...m, extractedText: "请求失败：" + String(err) }
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
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">账号工作区设置</h1>
            <p className="text-muted-foreground mt-1">
              配置品牌信息、产品、目标受众，为 AI 创作提供上下文
            </p>
          </div>
          <Button onClick={() => router.push("/")} variant="outline">
            返回首页
          </Button>
        </div>

        <Tabs defaultValue="brand" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="brand">品牌信息</TabsTrigger>
            <TabsTrigger value="products">产品库</TabsTrigger>
            <TabsTrigger value="personas">目标受众</TabsTrigger>
            <TabsTrigger value="benchmarks">对标账号</TabsTrigger>
          </TabsList>

          {/* 品牌信息 */}
          <TabsContent value="brand">
            {/* 上传品牌资料 */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>品牌资料库</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  上传品牌手册、产品资料等图片，AI 自动识别内容。支持多个文件，每个可指定用途。
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
                      {uploadingId ? "AI 识别中..." : "选择图片"}
                    </span>
                  </label>
                  <span className="text-xs text-muted-foreground">支持多选，PNG / JPEG / WebP</span>
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
                              <Badge variant="secondary">识别中...</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => removeMaterial(material.id)}
                          >
                            删除
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
                <CardTitle>品牌基础信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountName">账号名称</Label>
                    <Input
                      id="accountName"
                      placeholder="如：品牌A官方抖音号"
                      value={account.name}
                      onChange={(e) =>
                        setAccount((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="platform">平台</Label>
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
                      <option value="douyin">抖音</option>
                      <option value="tiktok">TikTok</option>
                      <option value="xiaohongshu">小红书</option>
                      <option value="instagram">Instagram</option>
                      <option value="kuaishou">快手</option>
                      <option value="wechat">微信视频号</option>
                      <option value="youtube">YouTube</option>
                      <option value="bilibili">Bilibili</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountUrl">账号链接（可选）</Label>
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
                  <Label htmlFor="brandName">品牌名称</Label>
                  <Input
                    id="brandName"
                    placeholder="品牌名"
                    value={account.brand.name}
                    onChange={(e) => updateBrand("name", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">所属行业</Label>
                  <Input
                    id="industry"
                    placeholder="如：母婴、美妆、汽车、餐饮..."
                    value={account.brand.industry}
                    onChange={(e) => updateBrand("industry", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tone">品牌调性</Label>
                  <Textarea
                    id="tone"
                    placeholder="描述品牌的语言风格和调性，如：年轻活泼、偏口语化、喜欢用网络热梗..."
                    value={account.brand.tone}
                    onChange={(e) => updateBrand("tone", e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>品牌规则 / 红线</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="添加规则，如：不提竞品名字"
                      value={ruleInput}
                      onChange={(e) => setRuleInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addRule()}
                    />
                    <Button onClick={addRule} variant="outline">
                      添加
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
                  <CardTitle>产品库</CardTitle>
                  <Button onClick={addProduct} size="sm">
                    添加产品
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {account.products.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    暂无产品，点击"添加产品"开始
                  </p>
                )}
                {account.products.map((product, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">产品 {i + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeProduct(i)}
                      >
                        删除
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>产品名称</Label>
                        <Input
                          placeholder="产品名"
                          value={product.name}
                          onChange={(e) => updateProduct(i, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>卖点（逗号分隔）</Label>
                        <Input
                          placeholder="卖点1, 卖点2, 卖点3"
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
                      <Label>产品描述</Label>
                      <Textarea
                        placeholder="详细描述产品特点、适用人群等"
                        value={product.description}
                        onChange={(e) => updateProduct(i, "description", e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>产品图片路径（逗号分隔）</Label>
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
                  <CardTitle>目标受众 Persona</CardTitle>
                  <Button onClick={addPersona} size="sm">
                    添加受众
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {account.personas.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    描述 1~2 个典型目标受众，帮助 AI 更好地生成内容
                  </p>
                )}
                {account.personas.map((persona, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">受众 {i + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removePersona(i)}
                      >
                        删除
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label>名称</Label>
                      <Input
                        placeholder="如：新手妈妈小王"
                        value={persona.name}
                        onChange={(e) => updatePersona(i, "name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>描述</Label>
                      <Textarea
                        placeholder="如：25岁，第一个宝宝6个月大，关注辅食和早教，价格敏感，喜欢看真实测评"
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
                  <CardTitle>对标账号</CardTitle>
                  <Button onClick={addBenchmark} size="sm">
                    添加对标
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {account.benchmarkAccounts.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    添加对标账号，帮助 AI 理解你想要的内容方向
                  </p>
                )}
                {account.benchmarkAccounts.map((benchmark, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">对标 {i + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeBenchmark(i)}
                      >
                        删除
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label>账号链接</Label>
                      <Input
                        placeholder="https://www.douyin.com/user/xxx"
                        value={benchmark.url}
                        onChange={(e) => updateBenchmark(i, "url", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>备注</Label>
                      <Input
                        placeholder="如：同品类头部账号，风格偏搞笑"
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
            <span className="text-sm text-green-600">已保存</span>
          )}
          <Button onClick={handleSave} size="lg">
            保存设置
          </Button>
        </div>
      </div>
    </div>
  );
}
