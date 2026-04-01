"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

function getWeekDates(baseDate: Date): Date[] {
  const d = new Date(baseDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDateShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function getTopicIcon(topic: Topic, scripts: Script[]): string {
  const hasScript = scripts.some((s) => s.topicId === topic.id);
  // Check for video would need more state — simplified for now
  if (hasScript) return "📝";
  return "💡";
}

export default function CalendarPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dragTopicId, setDragTopicId] = useState<string | null>(null);

  useEffect(() => {
    setTopics(getTopics());
    setScripts(getScripts());
  }, []);

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(baseDate);
  const today = formatDate(new Date());

  // Unscheduled approved topics (sidebar)
  const unscheduled = topics.filter((t) => t.status === "approved" && !t.scheduledDate);

  // Topics by date
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

  // Get month/year label
  const monthLabel = weekDates[0].toLocaleDateString("zh-CN", { year: "numeric", month: "long" });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">营销日历</h1>
          <p className="text-sm text-muted-foreground mt-0.5">将已采用的选题排入日历，规划发布节奏</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* ===== Main: Calendar ===== */}
        <div className="flex-1">
          {/* Week navigation */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold">{monthLabel}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset((w) => w - 1)}
                className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80"
              >
                ◀ 上周
              </button>
              <button
                onClick={() => setWeekOffset(0)}
                className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80"
              >
                本周
              </button>
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80"
              >
                下周 ▶
              </button>
            </div>
          </div>

          {/* Week grid */}
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date, i) => {
              const dateStr = formatDate(date);
              const isToday = dateStr === today;
              const dayTopics = topicsByDate[dateStr] || [];

              return (
                <div
                  key={dateStr}
                  className={`min-h-[160px] rounded-lg border p-2 transition-colors ${
                    isToday ? "border-primary bg-primary/5" : "border-border"
                  } ${dragTopicId ? "hover:bg-blue-50 hover:border-blue-300" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                  onDrop={(e) => { e.preventDefault(); handleDrop(dateStr); }}
                >
                  {/* Day header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                      {WEEKDAYS[i]}
                    </span>
                    <span className={`text-sm ${isToday ? "font-bold text-primary" : ""}`}>
                      {formatDateShort(date)}
                    </span>
                  </div>

                  {/* Topics in this day */}
                  <div className="space-y-1.5">
                    {dayTopics.map((topic) => (
                      <div
                        key={topic.id}
                        className="group rounded-md border bg-background p-1.5 text-[11px] leading-snug hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start gap-1">
                          <span className="shrink-0">{getTopicIcon(topic, scripts)}</span>
                          <span className="font-medium line-clamp-2">{topic.title}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={`text-[9px] px-1 py-px rounded ${TYPE_COLORS[topic.type] || "bg-muted"}`}>
                            {TOPIC_TYPE_LABELS[topic.type] || topic.type}
                          </span>
                          <button
                            onClick={() => handleUnschedule(topic.id)}
                            className="text-[9px] text-muted-foreground hover:text-destructive ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            移除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== Sidebar: Unscheduled topics ===== */}
        <div className="w-64 shrink-0">
          <div className="sticky top-6">
            <h3 className="text-sm font-semibold mb-3">
              待排期
              {unscheduled.length > 0 && (
                <span className="text-muted-foreground font-normal ml-1">({unscheduled.length})</span>
              )}
            </h3>

            {unscheduled.length > 0 ? (
              <div className="space-y-2">
                {unscheduled.map((topic) => (
                  <div
                    key={topic.id}
                    draggable
                    onDragStart={() => setDragTopicId(topic.id)}
                    onDragEnd={() => setDragTopicId(null)}
                    className="rounded-lg border bg-background p-2.5 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="shrink-0 mt-0.5">{getTopicIcon(topic, scripts)}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium line-clamp-2">{topic.title}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={`text-[9px] px-1 py-px rounded ${TYPE_COLORS[topic.type] || "bg-muted"}`}>
                            {TOPIC_TYPE_LABELS[topic.type] || topic.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">
                没有待排期的选题。<br />在「选题」页面采用选题后，会出现在这里。
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
