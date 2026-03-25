"use client";

import { CalendarDays } from "lucide-react";

export default function CalendarPage() {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <CalendarDays size={48} className="text-muted-foreground mb-4" strokeWidth={1.5} />
      <h2 className="text-lg font-semibold mb-2">营销日历</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        将已采用的选题排入日历，规划 1~4 周的发布节奏。
      </p>
      <p className="text-xs text-muted-foreground mt-4">即将上线</p>
    </div>
  );
}
