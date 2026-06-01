"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAccount, getTopics, getTrends, getScripts } from "@/lib/store";
import { useEffect, useState } from "react";
import type { Account, Topic, Trend, Script } from "@/lib/types";
import { useLang } from "@/lib/i18n";

export default function Home() {
  const { t } = useLang();
  const [account, setAccount] = useState<Account | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);

  useEffect(() => {
    setAccount(getAccount());
    setTopics(getTopics());
    setTrends(getTrends().trends);
    setScripts(getScripts());
  }, []);

  const approvedCount = topics.filter((tp) => tp.status === "approved").length;
  const pendingCount = topics.filter((tp) => tp.status === "pending").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("工作台", "Dashboard")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("AlphaTo · AI 驱动的社交媒体内容运营平台", "AlphaTo · AI-powered social content operations platform")}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("今日热点", "Today's trends")}</p>
            <p className="text-3xl font-bold mt-1">{trends.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("待审选题", "Pending topics")}</p>
            <p className="text-3xl font-bold mt-1">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("已采用", "Approved")}</p>
            <p className="text-3xl font-bold mt-1 text-green-600">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("已生成脚本", "Generated scripts")}</p>
            <p className="text-3xl font-bold mt-1">{scripts.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Account info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("账号信息", "Account info")}</CardTitle>
          </CardHeader>
          <CardContent>
            {account ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("账号", "Account")}</span>
                  <span>{account.name || t("未命名", "Untitled")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("品牌", "Brand")}</span>
                  <span>{account.brand.name || t("未设置", "Not set")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("行业", "Industry")}</span>
                  <span>{account.brand.industry || t("未设置", "Not set")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("受众", "Audience")}</span>
                  <span>{t(`${account.personas.length} 个`, `${account.personas.length}`)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("产品", "Products")}</span>
                  <span>{t(`${account.products.length} 个`, `${account.products.length}`)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("品牌资料", "Brand materials")}</span>
                  <span>{t(`${account.brandMaterials?.length || 0} 份`, `${account.brandMaterials?.length || 0}`)}</span>
                </div>
                <Link href="/settings">
                  <Button variant="outline" size="sm" className="w-full mt-3">
                    {t("编辑设置", "Edit settings")}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm mb-3">
                  {t("还没有配置账号", "No account configured yet")}
                </p>
                <Link href="/settings">
                  <Button size="sm">{t("开始配置", "Get started")}</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent topics */}
        <Card className="col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("最近选题", "Recent topics")}</CardTitle>
              <Link href="/topics">
                <Button variant="ghost" size="sm">{t("查看全部", "View all")}</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {topics.length > 0 ? (
              <div className="space-y-3">
                {topics.slice(0, 5).map((topic) => (
                  <Link
                    key={topic.id}
                    href={`/topics/${topic.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-sm font-medium truncate">{topic.title}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{topic.angle}</p>
                    </div>
                    <Badge
                      variant={
                        topic.status === "approved"
                          ? "default"
                          : topic.status === "rejected"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {topic.status === "approved"
                        ? t("采用", "Approved")
                        : topic.status === "rejected"
                          ? t("放弃", "Rejected")
                          : topic.status === "hold"
                            ? t("留存", "On hold")
                            : t("待定", "Pending")}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm mb-3">{t("暂无选题", "No topics yet")}</p>
                {account && (
                  <Link href="/topics">
                    <Button size="sm">{t("去生成选题", "Generate topics")}</Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
