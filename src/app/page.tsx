"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccount } from "@/lib/store";
import { useEffect, useState } from "react";
import type { Account } from "@/lib/types";

export default function Home() {
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    setAccount(getAccount());
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">AlphaTo</h1>
          <p className="text-muted-foreground mt-1">
            AI 驱动的社交媒体内容运营平台
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>账号工作区</CardTitle>
            </CardHeader>
            <CardContent>
              {account ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">账号：</span>
                    {account.name || "未命名"}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">品牌：</span>
                    {account.brand.name || "未设置"}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">行业：</span>
                    {account.brand.industry || "未设置"}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">受众：</span>
                    {account.personas.length} 个 Persona
                  </p>
                  <Link href="/setup">
                    <Button variant="outline" className="mt-3 w-full">
                      编辑设置
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-3">
                    还没有配置账号，先设置品牌信息
                  </p>
                  <Link href="/setup">
                    <Button>开始配置</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>今日选题</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                {account ? (
                  <Link href="/topics">
                    <Button>查看选题</Button>
                  </Link>
                ) : (
                  <p className="text-muted-foreground">
                    请先配置账号工作区
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
