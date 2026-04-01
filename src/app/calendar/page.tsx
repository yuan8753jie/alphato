"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  getTopics, getScripts, scheduleTopic, unscheduleTopic, saveTopics,
} from "@/lib/store";
import type { Topic, Script } from "@/lib/types";
import { TOPIC_TYPE_LABELS } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  traffic: "bg-red-100 text-red-800",
  trust: "bg-blue-100 text-blue-800",
  conversion: "bg-green-100 text-green-800",
  persona: "bg-purple-100 text-purple-800",
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

type ViewMode = "week" | "month";

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getWeekDates(base: Date): Date[] {
  const d = new Date(base);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday = 0

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  // Pad before
  for (let i = 0; i < startDow; i++) currentWeek.push(null);

  for (let day = 1; day <= lastDay.getDate(); day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Pad after
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}

function getTopicIcon(topic: Topic, scripts: Script[]): string {
  const hasScript = scripts.some((s) => s.topicId === topic.id);
  return hasScript ? "📝" : "💡";
}

export default function CalendarPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [viewDate, setViewDate] = useState(new Date());
  const [dragTopicId, setDragTopicId] = useState<string | null>(null);
  const [autoScheduling, setAutoScheduling] = useState(false);

  useEffect(() => {
    setTopics(getTopics());
    setScripts(getScripts());
  }, []);

  const today = formatDate(new Date());
  const unscheduled = topics.filter((t) => t.status === "approved" && !t.scheduledDate);

  const topicsByDate: Record<string, Topic[]> = {};
  for (const t of topics) {
    if (t.scheduledDate) {
      if (!topicsByDate[t.scheduledDate]) topicsByDate[t.scheduledDate] = [];
      topicsByDate[t.scheduledDate].push(t);
    }
  }

  function handleDrop(date: string) {
    if (!dragTopicId) return;
    scheduleTopic(dragTopicId, date);
    setTopics(getTopics());
    setDragTopicId(null);
  }

  function handleUnschedule(topicId: string) {
    unscheduleTopic(topicId);
    setTopics(getTopics());
  }

  async function autoSchedule() {
    setAutoScheduling(true);
    try {
      const res = await fetch("/api/auto-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics,
          reviewResults: {}, // TODO: pass actual review results
          startDate: formatDate(new Date()),
          postsPerDay: 1,
        }),
      });
      const data = await res.json();
      if (data.success && data.scheduled?.length > 0) {
        for (const item of data.scheduled) {
          scheduleTopic(item.topicId, item.date);
        }
        setTopics(getTopics());
      }
    } catch { /* ignore */ }
    finally { setAutoScheduling(false); }
  }

  function navigate(delta: number) {
    const d = new Date(viewDate);
    if (viewMode === "week") {
      d.setDate(d.getDate() + delta * 7);
    } else {
      d.setMonth(d.getMonth() + delta);
    }
    setViewDate(d);
  }

  function goToday() {
    setViewDate(new Date());
  }

  // Label
  const headerLabel = viewMode === "month"
    ? viewDate.toLocaleDateString("zh-CN", { year: "numeric", month: "long" })
    : (() => {
        const week = getWeekDates(viewDate);
        return `${week[0].getMonth() + 1}/${week[0].getDate()} - ${week[6].getMonth() + 1}/${week[6].getDate()}`;
      })();

  // Render day cell
  function renderDayCell(date: Date | null, compact = false) {
    if (!date) return <div key={Math.random()} className={compact ? "h-24" : "min-h-[140px]"} />;

    const dateStr = formatDate(date);
    const isToday = dateStr === today;
    const dayTopics = topicsByDate[dateStr] || [];

    return (
      <div
        key={dateStr}
        className={`${compact ? "h-24" : "min-h-[140px]"} rounded-lg border p-1.5 transition-colors ${
          isToday ? "border-primary bg-primary/5" : ""
        } ${dragTopicId ? "hover:bg-blue-50 hover:border-blue-300" : ""}`}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        onDrop={(e) => { e.preventDefault(); handleDrop(dateStr); }}
      >
        <div className={`text-right mb-1 ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
          <span className={`text-xs ${isToday ? "bg-primary text-white rounded-full w-5 h-5 inline-flex items-center justify-center" : ""}`}>
            {date.getDate()}
          </span>
        </div>
        <div className="space-y-1">
          {dayTopics.map((topic) => (
            <div
              key={topic.id}
              className="group rounded border bg-background px-1.5 py-1 text-[10px] leading-tight hover:shadow-sm"
            >
              <div className="flex items-start gap-0.5">
                <span className="shrink-0">{getTopicIcon(topic, scripts)}</span>
                <span className="font-medium line-clamp-1">{topic.title}</span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className={`text-[8px] px-1 rounded ${TYPE_COLORS[topic.type] || "bg-muted"}`}>
                  {TOPIC_TYPE_LABELS[topic.type] || topic.type}
                </span>
                <button
                  onClick={() => handleUnschedule(topic.id)}
                  className="text-[8px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">营销日历</h1>
          <p className="text-sm text-muted-foreground mt-0.5">拖拽选题到日历排期，或让 AI 自动排</p>
        </div>
        {unscheduled.length > 0 && (
          <Button onClick={autoSchedule} disabled={autoScheduling} variant="outline" size="sm">
            {autoScheduling ? "排期中..." : `AI 自动排期（${unscheduled.length} 条）`}
          </Button>
        )}
      </div>

      <div className="flex gap-5">
        {/* ===== Main calendar ===== */}
        <div className="flex-1">
          {/* Controls */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80">◀</button>
              <button onClick={goToday} className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80">今天</button>
              <button onClick={() => navigate(1)} className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80">▶</button>
              <span className="text-sm font-semibold ml-2">{headerLabel}</span>
            </div>
            <div className="flex items-center rounded-md border overflow-hidden">
              <button
                onClick={() => setViewMode("week")}
                className={`text-xs px-3 py-1.5 transition-colors ${viewMode === "week" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                周
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`text-xs px-3 py-1.5 transition-colors ${viewMode === "month" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                月
              </button>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          {viewMode === "week" ? (
            <div className="grid grid-cols-7 gap-1">
              {getWeekDates(viewDate).map((date) => renderDayCell(date))}
            </div>
          ) : (
            <div className="space-y-1">
              {getMonthGrid(viewDate.getFullYear(), viewDate.getMonth()).map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((date, di) => renderDayCell(date, true))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== Sidebar ===== */}
        <div className="w-56 shrink-0">
          <div className="sticky top-6">
            <h3 className="text-sm font-semibold mb-2">
              待排期
              {unscheduled.length > 0 && (
                <span className="text-muted-foreground font-normal ml-1">({unscheduled.length})</span>
              )}
            </h3>
            {unscheduled.length > 0 ? (
              <div className="space-y-1.5 max-h-[calc(100vh-200px)] overflow-y-auto">
                {unscheduled.map((topic) => (
                  <div
                    key={topic.id}
                    draggable
                    onDragStart={() => setDragTopicId(topic.id)}
                    onDragEnd={() => setDragTopicId(null)}
                    className="rounded-lg border bg-background p-2 cursor-grab active:cursor-grabbing hover:shadow-sm text-[11px]"
                  >
                    <div className="flex items-start gap-1">
                      <span className="shrink-0">{getTopicIcon(topic, scripts)}</span>
                      <p className="font-medium line-clamp-2">{topic.title}</p>
                    </div>
                    <span className={`text-[9px] px-1 py-px rounded mt-1 inline-block ${TYPE_COLORS[topic.type] || "bg-muted"}`}>
                      {TOPIC_TYPE_LABELS[topic.type] || topic.type}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">
                没有待排期选题。<br/>去「选题」页面采用后出现在这里。
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
