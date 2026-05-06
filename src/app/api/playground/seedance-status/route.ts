import { NextRequest, NextResponse } from "next/server";
import { getSeedanceTaskStatus, type SeedanceProvider } from "@/lib/seedance";

export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get("taskId");
    const provider = req.nextUrl.searchParams.get("provider") as SeedanceProvider | null;
    if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });
    if (!provider) return NextResponse.json({ error: "provider required" }, { status: 400 });

    const task = await getSeedanceTaskStatus(taskId, provider);
    return NextResponse.json({ success: true, task });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
