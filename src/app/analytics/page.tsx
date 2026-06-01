"use client";

import { BarChart3 } from "lucide-react";
import { useLang } from "@/lib/i18n";

export default function AnalyticsPage() {
  const { t } = useLang();
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <BarChart3 size={48} className="text-muted-foreground mb-4" strokeWidth={1.5} />
      <h2 className="text-lg font-semibold mb-2">{t("数据", "Analytics")}</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {t("追踪已发布内容的效果数据，分析什么类型的选题表现最好，指导未来创作。", "Track performance of published content, analyze which topic types perform best, and inform future creation.")}
      </p>
      <p className="text-xs text-muted-foreground mt-4">{t("即将上线", "Coming soon")}</p>
    </div>
  );
}
