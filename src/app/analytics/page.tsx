"use client";

import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <BarChart3 size={48} className="text-muted-foreground mb-4" strokeWidth={1.5} />
      <h2 className="text-lg font-semibold mb-2">数据</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        追踪已发布内容的效果数据，分析什么类型的选题表现最好，指导未来创作。
      </p>
      <p className="text-xs text-muted-foreground mt-4">即将上线</p>
    </div>
  );
}
