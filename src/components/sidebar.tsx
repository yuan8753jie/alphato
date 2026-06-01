"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { listAccounts, getAccount, setActiveAccountId, deleteAccount } from "@/lib/store";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Compass,
  Lightbulb,
  CalendarDays,
  FolderOpen,
  BarChart3,
  Settings,
  FlaskConical,
  FileText,
  ChevronDown,
  Check,
  Plus,
  Trash2,
  Video,
  History,
} from "lucide-react";
import type { Account } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/lib/i18n";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, t } = useLang();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [active, setActive] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  const NAV_SECTIONS = [
    {
      title: t("工作流", "Workflow"),
      items: [
        { href: "/", label: t("工作台", "Dashboard"), icon: LayoutDashboard },
        { href: "/discover", label: t("发现", "Discover"), icon: Compass },
        { href: "/topics", label: t("选题", "Topics"), icon: Lightbulb },
        { href: "/calendar", label: t("日历", "Calendar"), icon: CalendarDays },
      ],
    },
    {
      title: t("资源", "Resources"),
      items: [
        { href: "/history", label: t("生成历史", "History"), icon: History },
        { href: "/assets", label: t("素材库", "Assets"), icon: FolderOpen },
        { href: "/analytics", label: t("数据", "Analytics"), icon: BarChart3 },
      ],
    },
    {
      title: t("实验", "Experiments"),
      items: [
        { href: "/playground/seedance", label: t("Seedance 对比", "Seedance Compare"), icon: Video },
      ],
    },
    {
      title: t("设置", "Settings"),
      items: [
        { href: "/eval", label: t("效果评判", "Eval"), icon: FlaskConical },
        { href: "/prompts", label: t("提示词目录", "Prompt Library"), icon: FileText },
        { href: "/settings", label: t("品牌设置", "Brand Settings"), icon: Settings },
      ],
    },
  ];

  function reload() {
    setAccounts(listAccounts());
    setActive(getAccount());
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function handleSwitch(id: string) {
    if (!active || id === active.id) {
      setOpen(false);
      return;
    }
    setActiveAccountId(id);
    window.location.reload();
  }

  function handleNewBrand() {
    setOpen(false);
    router.push("/setup");
  }

  function openDeleteConfirm() {
    setOpen(false);
    setConfirmInput("");
    setDeleteOpen(true);
  }

  function confirmDelete() {
    if (!active) return;
    if (confirmInput !== active.brand.name) return;
    deleteAccount(active.id);
    window.location.href = "/";
  }

  const brandLabel = active?.brand.name || active?.name || t("未配置", "Not configured");
  const initial = active?.brand.name?.[0] || "?";

  return (
    <aside className="fixed top-0 left-0 h-screen w-[220px] bg-card border-r flex flex-col z-50">
      {/* Logo + language toggle */}
      <div className="h-14 flex items-center justify-between px-5 border-b">
        <Link href="/" className="font-bold text-xl tracking-tight">
          AlphaTo
        </Link>
        <div className="flex items-center text-[11px] font-medium border rounded overflow-hidden">
          <button
            onClick={() => setLang("zh")}
            className={cn(
              "px-1.5 py-0.5 cursor-pointer transition-colors",
              lang === "zh" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
            data-testid="lang-toggle-zh"
          >
            中
          </button>
          <button
            onClick={() => setLang("en")}
            className={cn(
              "px-1.5 py-0.5 cursor-pointer transition-colors border-l",
              lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
            data-testid="lang-toggle-en"
          >
            EN
          </button>
        </div>
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
                const a = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all",
                      a
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon size={18} strokeWidth={a ? 2.2 : 1.8} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Brand switcher */}
      <div className="border-t p-3 relative" ref={popoverRef}>
        {accounts.length === 0 ? (
          <button
            onClick={handleNewBrand}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-muted transition-colors text-sm cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <Plus size={14} />
            </div>
            <span className="flex-1 text-left text-muted-foreground">{t("新建品牌", "New brand")}</span>
          </button>
        ) : (
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-muted transition-colors text-sm cursor-pointer"
            data-testid="brand-switcher-toggle"
          >
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
              {initial}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">{brandLabel}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {active?.brand.industry || "—"}
              </p>
            </div>
            <ChevronDown
              size={14}
              className={cn("text-muted-foreground shrink-0 transition-transform", open && "rotate-180")}
            />
          </button>
        )}

        {/* Dropdown panel */}
        {open && accounts.length > 0 && (
          <div
            className="absolute bottom-full left-3 right-3 mb-2 bg-card border rounded-lg shadow-lg overflow-hidden"
            data-testid="brand-switcher-panel"
          >
            <div className="max-h-64 overflow-y-auto py-1">
              {accounts.map((acc) => {
                const isCurrent = acc.id === active?.id;
                return (
                  <button
                    key={acc.id}
                    onClick={() => handleSwitch(acc.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors cursor-pointer",
                      isCurrent && "bg-muted/50"
                    )}
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                      {acc.brand.name?.[0] || "?"}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm truncate">{acc.brand.name || acc.name || t("未命名", "Untitled")}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{acc.brand.industry || "—"}</p>
                    </div>
                    {isCurrent && <Check size={14} className="text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t">
              <button
                onClick={handleNewBrand}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors cursor-pointer"
              >
                <Plus size={14} className="text-muted-foreground" />
                {t("新建品牌", "New brand")}
              </button>
              {active && (
                <button
                  onClick={openDeleteConfirm}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  data-testid="brand-delete-trigger"
                >
                  <Trash2 size={14} />
                  {t("删除当前品牌", "Delete current brand")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteOpen && active && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-card border rounded-lg shadow-xl p-6 w-[420px] max-w-[90vw]" data-testid="brand-delete-modal">
            <h2 className="text-lg font-semibold mb-2">
              {t(`删除品牌「${active.brand.name || active.name}」？`, `Delete brand "${active.brand.name || active.name}"?`)}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t(
                "此品牌的所有选题、热点、脚本、Review 数据将被永久删除，无法恢复。",
                "All topics, trends, scripts, and review data for this brand will be permanently deleted and cannot be recovered."
              )}
            </p>
            <p className="text-sm mb-2">
              {t("请输入品牌名", "Type the brand name")}{" "}
              <span className="font-semibold">{active.brand.name || active.name}</span>{" "}
              {t("确认：", "to confirm:")}
            </p>
            <Input
              autoFocus
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={active.brand.name || active.name}
              className="mb-4"
              data-testid="brand-delete-input"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)} className="cursor-pointer">
                {t("取消", "Cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={confirmInput !== (active.brand.name || active.name)}
                className="cursor-pointer"
                data-testid="brand-delete-confirm"
              >
                {t("永久删除", "Permanently delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
