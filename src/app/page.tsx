"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAccount, getTopics, getTrends, getScripts } from "@/lib/store";
import { useEffect, useState } from "react";
import type { Account, Topic, Trend, Script } from "@/lib/types";

export default function Home() {
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

  const approvedCount = topics.filter((t) => t.status === "approved").length;
  const pendingCount = topics.filter((t) => t.status === "pending").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">工作台</h1>
        <p className="text-muted-foreground mt-1">AlphaTo · AI 驱动的社交媒体内容运营平台</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">今日热点</p>
            <p className="text-3xl font-bold mt-1">{trends.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">待审选题</p>
            <p className="text-3xl font-bold mt-1">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">已采用</p>
            <p className="text-3xl font-bold mt-1 text-green-600">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">已生成脚本</p>
            <p className="text-3xl font-bold mt-1">{scripts.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Account info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">账号信息</CardTitle>
          </CardHeader>
          <CardContent>
            {account ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">账号</span>
                  <span>{account.name || "未命名"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">品牌</span>
                  <span>{account.brand.name || "未设置"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">行业</span>
                  <span>{account.brand.industry || "未设置"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">受众</span>
                  <span>{account.personas.length} 个</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">产品</span>
                  <span>{account.products.length} 个</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">品牌资料</span>
                  <span>{account.brandMaterials?.length || 0} 份</span>
                </div>
                <Link href="/setup">
                  <Button variant="outline" size="sm" className="w-full mt-3">
                    编辑设置
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm mb-3">还没有配置账号</p>
                <Link href="/setup">
                  <Button size="sm">开始配置</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent topics */}
        <Card className="col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">最近选题</CardTitle>
              <Link href="/topics">
                <Button variant="ghost" size="sm">查看全部</Button>
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
                      {topic.status === "approved" ? "采用" : topic.status === "rejected" ? "放弃" : topic.status === "hold" ? "留存" : "待定"}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm mb-3">暂无选题</p>
                {account && (
                  <Link href="/topics">
                    <Button size="sm">去生成选题</Button>
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
