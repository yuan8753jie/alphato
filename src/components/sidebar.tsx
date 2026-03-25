"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getAccount } from "@/lib/store";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Compass,
  Lightbulb,
  CalendarDays,
  FolderOpen,
  BarChart3,
  Settings,
  ChevronDown,
} from "lucide-react";
import type { Account } from "@/lib/types";

const NAV_SECTIONS = [
  {
    title: "工作流",
    items: [
      { href: "/", label: "工作台", icon: LayoutDashboard },
      { href: "/discover", label: "发现", icon: Compass },
      { href: "/topics", label: "选题", icon: Lightbulb },
      { href: "/calendar", label: "日历", icon: CalendarDays },
    ],
  },
  {
    title: "资源",
    items: [
      { href: "/assets", label: "素材库", icon: FolderOpen },
      { href: "/analytics", label: "数据", icon: BarChart3 },
    ],
  },
  {
    title: "设置",
    items: [
      { href: "/settings", label: "品牌设置", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    setAccount(getAccount());
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed top-0 left-0 h-screen w-[220px] bg-card border-r flex flex-col z-50">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b">
        <Link href="/" className="font-bold text-xl tracking-tight">
          AlphaTo
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all",
                      active
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Account selector */}
      <div className="border-t p-3">
        <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-muted transition-colors text-sm">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
            {account?.brand.name?.[0] || "A"}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium truncate">{account?.name || "未配置"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{account?.brand.industry || ""}</p>
          </div>
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        </button>
      </div>
    </aside>
  );
}
