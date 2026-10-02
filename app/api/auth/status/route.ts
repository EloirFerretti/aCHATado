import { NextResponse } from "next/server";
import { readPlatformSession } from "@/lib/session";
import type { Platform } from "@/lib/types";

export const dynamic = "force-dynamic";

function configured(platform: Platform) {
  if (platform === "twitch") return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
  if (platform === "kick") return Boolean(process.env.KICK_CLIENT_ID && process.env.KICK_CLIENT_SECRET);
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function GET() {
  const platforms: Platform[] = ["twitch", "kick", "youtube"];
  const entries = await Promise.all(platforms.map(async (platform) => {
    const s = await readPlatformSession(platform);
    const moderationScopes =
      platform === "twitch"
        ? ["moderator:manage:banned_users", "moderator:manage:chat_messages"]
        : platform === "kick"
          ? ["moderation:ban", "moderation:chat_message:manage"]
          : ["https://www.googleapis.com/auth/youtube.force-ssl"];
    const granted = new Set(s?.scope || []);
    const missingModerationScopes = s
      ? moderationScopes.filter((scope) => !granted.has(scope))
      : moderationScopes;

    return [platform, s ? {
      connected: true,
      configured: configured(platform),
      userName: s.userName,
      avatar: s.avatar,
      moderationReady: missingModerationScopes.length === 0,
      missingModerationScopes,
    } : {
      connected: false,
      configured: configured(platform),
      moderationReady: false,
      missingModerationScopes: moderationScopes,
    }] as const;
  }));
  return NextResponse.json(Object.fromEntries(entries));
}
