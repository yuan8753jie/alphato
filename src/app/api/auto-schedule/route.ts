import { NextRequest, NextResponse } from "next/server";
import type { Topic } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { topics, reviewResults, startDate, postsPerDay = 1 } = await req.json() as {
      topics: Topic[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reviewResults: Record<string, any>;
      startDate: string; // YYYY-MM-DD
      postsPerDay: number;
    };

    // Get approved unscheduled topics
    const candidates = topics.filter((t) => t.status === "approved" && !t.scheduledDate);

    if (candidates.length === 0) {
      return NextResponse.json({ success: true, scheduled: [] });
    }

    // Sort by review score (highest first) — uses reviewScore persisted on topic
    const scored = candidates.map((t) => ({
      topic: t,
      score: t.reviewScore ?? reviewResults?.[t.id]?.averageScore ?? 0,
    }));
    scored.sort((a, b) => b.score - a.score);

    // Assign dates: postsPerDay topics per day, skip weekends optionally
    const scheduled: { topicId: string; date: string }[] = [];
    let currentDate = new Date(startDate);
    let dailyCount = 0;

    for (const { topic } of scored) {
      scheduled.push({
        topicId: topic.id,
        date: currentDate.toISOString().split("T")[0],
      });
      dailyCount++;

      if (dailyCount >= postsPerDay) {
        dailyCount = 0;
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return NextResponse.json({ success: true, scheduled });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
