import { NextRequest, NextResponse } from "next/server";
import { createSubject } from "@/lib/kling";

export async function POST(req: NextRequest) {
  try {
    const { name, description, imageBase64OrUrl } = await req.json();
    const result = await createSubject({ name, description, imageBase64OrUrl });
    return NextResponse.json({ success: true, taskId: result.taskId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
