import { NextRequest, NextResponse } from "next/server";
import { clearPlatformSession } from "@/lib/session";
import type { Platform } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { platform } = await req.json();
  if (!["twitch", "kick", "youtube"].includes(platform)) {
    return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
  }
  const response = NextResponse.json({ ok: true });
  clearPlatformSession(response, platform as Platform);
  return response;
}
