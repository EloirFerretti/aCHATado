import { NextRequest, NextResponse } from "next/server";
import { getKickAppToken } from "@/lib/app-tokens";
import { getTwitchUserProfiles } from "@/lib/twitch-users";
import type { Platform } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestedUser = {
  platform: Platform;
  userId?: string;
  userName?: string;
};

type CachedAvatar = {
  avatar: string | null;
  expiresAt: number;
};

const cache = new Map<string, CachedAvatar>();
const AVATAR_TTL = 6 * 60 * 60 * 1000;
const MISSING_TTL = 15 * 60 * 1000;

function cacheKey(platform: Platform, userId?: string, userName?: string) {
  const id = String(userId || "").trim();
  if (id) return `${platform}:id:${id}`;
  const name = String(userName || "")
    .trim()
    .replace(/^@/, "")
    .toLocaleLowerCase();
  return name ? `${platform}:name:${name}` : "";
}

function normalizedAvatar(value: unknown) {
  if (typeof value !== "string") return null;
  const avatar = value.trim();
  if (!avatar) return null;
  if (avatar.startsWith("//")) return `https:${avatar}`;
  if (/^https?:\/\//i.test(avatar)) return avatar;
  return null;
}

function remember(
  result: Record<string, string>,
  platform: Platform,
  avatar: string | null,
  userId?: string,
  userName?: string,
) {
  const keys = [
    cacheKey(platform, userId, undefined),
    cacheKey(platform, undefined, userName),
  ].filter(Boolean);

  for (const key of keys) {
    cache.set(key, {
      avatar,
      expiresAt: Date.now() + (avatar ? AVATAR_TTL : MISSING_TTL),
    });
    if (avatar) result[key] = avatar;
  }
}

async function resolveTwitch(
  users: RequestedUser[],
  result: Record<string, string>,
) {
  const ids = [...new Set(users.map((user) => user.userId).filter(Boolean))] as string[];
  if (!ids.length) return;

  const profiles = await getTwitchUserProfiles(ids);
  for (const user of users) {
    if (!user.userId) continue;
    const profile = profiles.get(user.userId);
    remember(
      result,
      "twitch",
      normalizedAvatar(profile?.avatar),
      user.userId,
      user.userName || profile?.displayName || profile?.login,
    );
  }
}

async function resolveKick(
  users: RequestedUser[],
  result: Record<string, string>,
) {
  const ids = [...new Set(users.map((user) => user.userId).filter(Boolean))] as string[];
  if (!ids.length) return;

  const token = await getKickAppToken();
  for (let index = 0; index < ids.length; index += 50) {
    const batch = ids.slice(index, index + 50);
    const url = new URL("https://api.kick.com/public/v1/users");
    for (const id of batch) url.searchParams.append("id", id);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) continue;

    for (const item of Array.isArray(json?.data) ? json.data : []) {
      const userId = String(item?.user_id || item?.id || "").trim();
      if (!userId) continue;
      const requested = users.find((user) => user.userId === userId);
      remember(
        result,
        "kick",
        normalizedAvatar(item?.profile_picture),
        userId,
        requested?.userName || String(item?.name || item?.username || ""),
      );
    }
  }
}

async function resolveYouTube(
  users: RequestedUser[],
  result: Record<string, string>,
) {
  const key = process.env.YOUTUBE_API_KEY;
  const ids = [...new Set(users.map((user) => user.userId).filter(Boolean))] as string[];
  if (!key || !ids.length) return;

  for (let index = 0; index < ids.length; index += 50) {
    const batch = ids.slice(index, index + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("key", key);

    const response = await fetch(url, { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) continue;

    for (const item of Array.isArray(json?.items) ? json.items : []) {
      const userId = String(item?.id || "").trim();
      if (!userId) continue;
      const requested = users.find((user) => user.userId === userId);
      const thumbnails = item?.snippet?.thumbnails || {};
      remember(
        result,
        "youtube",
        normalizedAvatar(
          thumbnails?.medium?.url ||
            thumbnails?.default?.url ||
            thumbnails?.high?.url,
        ),
        userId,
        requested?.userName || String(item?.snippet?.title || ""),
      );
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawUsers = Array.isArray(body?.users) ? body.users.slice(0, 40) : [];
    const users: RequestedUser[] = rawUsers
      .map((raw: any) => ({
        platform: raw?.platform,
        userId: typeof raw?.userId === "string" ? raw.userId.trim() : undefined,
        userName:
          typeof raw?.userName === "string"
            ? raw.userName.trim().replace(/^@/, "")
            : undefined,
      }))
      .filter(
        (user: RequestedUser) =>
          (user.platform === "twitch" ||
            user.platform === "kick" ||
            user.platform === "youtube") &&
          Boolean(user.userId || user.userName),
      );

    const avatars: Record<string, string> = {};
    const unresolved: RequestedUser[] = [];

    for (const user of users) {
      const keys = [
        cacheKey(user.platform, user.userId, undefined),
        cacheKey(user.platform, undefined, user.userName),
      ].filter(Boolean);
      const cached = keys
        .map((key) => ({ key, value: cache.get(key) }))
        .find(({ value }) => value && value.expiresAt > Date.now());

      if (cached?.value) {
        if (cached.value.avatar) {
          for (const key of keys) avatars[key] = cached.value.avatar;
        }
      } else {
        unresolved.push(user);
      }
    }

    await Promise.allSettled([
      resolveTwitch(
        unresolved.filter((user) => user.platform === "twitch"),
        avatars,
      ),
      resolveKick(
        unresolved.filter((user) => user.platform === "kick"),
        avatars,
      ),
      resolveYouTube(
        unresolved.filter((user) => user.platform === "youtube"),
        avatars,
      ),
    ]);

    return NextResponse.json({ avatars });
  } catch {
    return NextResponse.json({ avatars: {} });
  }
}
