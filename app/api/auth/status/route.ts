import { NextResponse } from "next/server";
import { readPlatformSession } from "@/lib/session";
import type { Platform } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const platforms: Platform[] = ["twitch", "kick", "youtube"];
  const entries = await Promise.all(platforms.map(async (platform) => {
    const s = await readPlatformSession(platform);
    return [platform, s ? {
      connected: true,
      userName: s.userName,
      avatar: s.avatar,
    } : { connected: false }] as const;
  }));
  return NextResponse.json(Object.fromEntries(entries));
}
