import { NextRequest, NextResponse } from "next/server";
import { dbConfigured, listMessages } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const after = Math.max(0, Number(req.nextUrl.searchParams.get("after") || 0));
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 100)));
  const messages = await listMessages(after, limit);
  return NextResponse.json({ messages, dbConfigured });
}
