import { NextRequest, NextResponse } from "next/server";
import { upsertEnrichedMessages } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const webChannelCache = new Map<string, { id: string; expiresAt: number }>();

function cleanSlug(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\/(?:www\.)?kick\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
}

function badgeType(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function normalizedBadges(identity: any) {
  const result: any[] = Array.isArray(identity?.badges)
    ? identity.badges.map((badge: any) => ({ ...badge }))
    : [];

  const seen = new Set(
    result
      .map((badge: any) => badgeType(badge?.name || badge?.type))
      .filter(Boolean),
  );

  const v2 = Array.isArray(identity?.badges_v2) ? identity.badges_v2 : [];
  for (const badge of v2) {
    const name = badgeType(badge?.name || badge?.type);
    if (!name || seen.has(name)) continue;

    if (name === "level") {
      const level = Number(badge?.metadata?.level);
      if (!Number.isInteger(level) || level < 1 || level > 99) continue;
      result.push({
        type: "level",
        name: "level",
        text: `Level ${level}`,
        count: level,
        metadata: badge?.metadata || { level },
        image_url:
          typeof badge?.image_url === "string" ? badge.image_url : undefined,
      });
      seen.add(name);
      continue;
    }

    result.push({
      type: name,
      name,
      text: String(badge?.text || badge?.name || name),
      count:
        typeof badge?.count === "number" && badge.count > 0
          ? badge.count
          : undefined,
      metadata: badge?.metadata,
      image_url:
        typeof badge?.image_url === "string" ? badge.image_url : undefined,
    });
    seen.add(name);
  }

  return result;
}

async function resolveKickWebChannelId(slug: string) {
  const cached = webChannelCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) return cached.id;

  const res = await fetch(
    `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json, text/plain, */*",
        Referer: `https://kick.com/${encodeURIComponent(slug)}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      },
    },
  );

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Cloudflare can return HTML instead of JSON.
  }

  const id = Number(json?.id);
  if (!res.ok || !Number.isInteger(id) || id <= 0) {
    throw new Error(
      `Kick web channel lookup failed (${res.status})`,
    );
  }

  const value = String(id);
  webChannelCache.set(slug, {
    id: value,
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  });
  return value;
}

function normalizeMessage(raw: any, publicChannelId: string): ChatMessage | null {
  const sender = raw?.sender || {};
  const identity = sender?.identity || {};
  const messageId = String(raw?.id || raw?.message_id || "").trim();
  if (!messageId) return null;

  return {
    platform: "kick",
    platform_message_id: messageId,
    channel_id: publicChannelId,
    author_id:
      sender?.id != null
        ? String(sender.id)
        : sender?.user_id != null
          ? String(sender.user_id)
          : null,
    author_name: String(sender?.username || "Kick user"),
    author_avatar:
      sender?.profile_pic ||
      sender?.profile_picture ||
      sender?.profile_image ||
      null,
    author_color:
      identity?.color ||
      identity?.username_color ||
      null,
    message: String(raw?.content || "").replace(
      /\[emote:\d+:([^\]]+)\]/g,
      "$1",
    ),
    message_type: String(raw?.type || "text"),
    badges: normalizedBadges(identity),
    created_at: raw?.created_at || raw?.timestamp || new Date().toISOString(),
    raw,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const slug = cleanSlug(body?.channelName);
    const publicChannelId = String(body?.channelId || "").trim();

    if (!slug || !publicChannelId) {
      return NextResponse.json(
        { error: "channelName e channelId são obrigatórios." },
        { status: 400 },
      );
    }

    const webChannelId = await resolveKickWebChannelId(slug);
    const res = await fetch(
      `https://kick.com/api/v2/channels/${encodeURIComponent(webChannelId)}/messages`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json, text/plain, */*",
          Referer: `https://kick.com/${encodeURIComponent(slug)}`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        },
      },
    );

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Mantém o erro abaixo legível quando a proteção web responder HTML.
    }

    if (!res.ok || !json) {
      console.warn("[kick-sync] recent messages unavailable", {
        slug,
        webChannelId,
        status: res.status,
      });
      return NextResponse.json(
        { error: `Kick respondeu ${res.status} ao carregar badges.` },
        { status: 502 },
      );
    }

    const rawMessages = Array.isArray(json?.data?.messages)
      ? json.data.messages
      : Array.isArray(json?.messages)
        ? json.messages
        : [];

    const messages = rawMessages
      .map((message: any) => normalizeMessage(message, publicChannelId))
      .filter((message: ChatMessage | null): message is ChatMessage => Boolean(message))
      .sort(
        (a: ChatMessage, b: ChatMessage) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

    await upsertEnrichedMessages(messages);

    const levelBadges = messages.reduce(
      (total: number, message: ChatMessage) =>
        total +
        message.badges.filter(
          (badge: any) => badgeType(badge?.name || badge?.type) === "level",
        ).length,
      0,
    );

    console.log("[kick-sync] enriched recent messages", {
      slug,
      webChannelId,
      messages: messages.length,
      levelBadges,
    });

    return NextResponse.json({
      ok: true,
      messages,
      count: messages.length,
      levelBadges,
    });
  } catch (error) {
    console.warn("[kick-sync] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Não foi possível enriquecer as badges da Kick." },
      { status: 502 },
    );
  }
}
