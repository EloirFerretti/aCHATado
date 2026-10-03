import { NextRequest, NextResponse } from "next/server";
import { getThirdPartyEmotes, type ThirdPartyPlatform } from "@/lib/emotes";
import { getTwitchPickerEmotes } from "@/lib/twitch-emotes";
import {
  getYouTubePickerEmotes,
  resolvePublicYouTubeLiveVideoId,
} from "@/lib/youtube-emotes";
import { readPlatformSession, writePlatformSession } from "@/lib/session";
import { refreshPlatformSession } from "@/lib/platform-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PickerProvider =
  | "twitch"
  | "kick"
  | "youtube"
  | "bttv"
  | "ffz"
  | "7tv";

type PickerCategory =
  | "user"
  | "channel"
  | "official"
  | "kick-emotes"
  | "kick-global"
  | "kick-collectibles"
  | "thirdparty";

type PickerEmote = {
  id?: string;
  code: string;
  name?: string;
  url?: string;
  provider: PickerProvider;
  category: PickerCategory;
  scope: "global" | "channel" | "user";
  animated?: boolean;
  zeroWidth?: boolean;
  native?: boolean;
  emoteType?: string;
  tier?: string;
  requiresSubscription?: boolean;
  locked?: boolean;
  lockReason?: string;
};

function platformValue(value: string | null): ThirdPartyPlatform | null {
  return value === "twitch" || value === "kick" || value === "youtube"
    ? value
    : null;
}

function categoryFromNativeScope(scope: "global" | "channel" | "user"): PickerCategory {
  if (scope === "user") return "user";
  if (scope === "channel") return "channel";
  return "official";
}

function parseKickEmoteSets(payload: unknown): PickerEmote[] {
  if (!Array.isArray(payload)) return [];

  const found = new Map<string, PickerEmote>();

  for (const rawSet of payload) {
    if (!rawSet || typeof rawSet !== "object") continue;
    const set = rawSet as {
      slug?: unknown;
      name?: unknown;
      type?: unknown;
      emotes?: unknown;
    };
    const setLabel = String(set.slug ?? set.name ?? set.type ?? "")
      .trim()
      .toLowerCase();
    const isEmoji = setLabel.startsWith("emoji");
    const isGlobal = setLabel.startsWith("global");
    const isCollectibleSet = setLabel.startsWith("collectible");

    const emotes = Array.isArray(set.emotes) ? set.emotes : [];
    for (const rawEmote of emotes) {
      if (!rawEmote || typeof rawEmote !== "object") continue;
      const emote = rawEmote as {
        id?: unknown;
        name?: unknown;
        subscribers_only?: unknown;
        subscriber_only?: unknown;
        is_subscriber_only?: unknown;
      };
      const id =
        typeof emote.id === "number" || typeof emote.id === "string"
          ? String(emote.id).trim()
          : "";
      const name = typeof emote.name === "string" ? emote.name.trim() : "";
      if (!id || !name) continue;

      const isCollectible =
        isCollectibleSet || name.toLowerCase().startsWith("collectibles");
      const requiresSubscription = Boolean(
        emote.subscribers_only ||
          emote.subscriber_only ||
          emote.is_subscriber_only,
      );

      found.set(`kick:${id}`, {
        id,
        code: name,
        name,
        url: `https://files.kick.com/emotes/${encodeURIComponent(id)}/fullsize`,
        provider: "kick",
        category: isCollectible
          ? "kick-collectibles"
          : isEmoji
            ? "kick-emotes"
            : isGlobal
              ? "kick-global"
              : "channel",
        scope: isCollectible || isEmoji || isGlobal ? "global" : "channel",
        native: true,
        emoteType: isCollectible
          ? "collectible"
          : requiresSubscription
            ? "subscriber"
            : isEmoji
              ? "emoji"
              : isGlobal
                ? "global"
                : "channel",
        requiresSubscription,
      });
    }
  }

  return [...found.values()];
}

async function getAuthenticatedKickEmotes(
  slug: string,
  accessToken: string,
): Promise<{ emotes: PickerEmote[]; status: number | null }> {
  if (!slug || !accessToken) return { emotes: [], status: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(
      `https://kick.com/emotes/${encodeURIComponent(slug)}`,
      {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          Origin: "https://kick.com",
          Referer: `https://kick.com/${encodeURIComponent(slug)}`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        },
      },
    );
    if (!response.ok) return { emotes: [], status: response.status };
    const payload = await response.json();
    return {
      emotes: parseKickEmoteSets(payload),
      status: response.status,
    };
  } catch {
    return { emotes: [], status: null };
  } finally {
    clearTimeout(timer);
  }
}

function sortItems(items: PickerEmote[]) {
  const categoryOrder: Record<PickerCategory, number> = {
    user: 0,
    channel: 1,
    "kick-emotes": 2,
    "kick-global": 3,
    "kick-collectibles": 4,
    official: 5,
    thirdparty: 6,
  };
  const providerOrder: Record<PickerProvider, number> = {
    twitch: 0,
    kick: 0,
    youtube: 0,
    "7tv": 1,
    bttv: 2,
    ffz: 3,
  };

  return items.sort(
    (a, b) =>
      categoryOrder[a.category] - categoryOrder[b.category] ||
      providerOrder[a.provider] - providerOrder[b.provider] ||
      (a.name || a.code).localeCompare(b.name || b.code),
  );
}

export async function GET(req: NextRequest) {
  const platform = platformValue(req.nextUrl.searchParams.get("platform"));
  const channelId = req.nextUrl.searchParams.get("channelId")?.trim() || "";
  const channelName = req.nextUrl.searchParams.get("channelName")?.trim() || "";
  let videoId = req.nextUrl.searchParams.get("videoId")?.trim() || "";

  if (!platform) {
    return NextResponse.json({ error: "Plataforma inválida." }, { status: 400 });
  }
  if (!channelId) {
    return NextResponse.json({ error: "channelId obrigatório." }, { status: 400 });
  }

  try {
    const items: PickerEmote[] = [];
    let refreshedSession = null;
    let kickStoredSession = null;
    let kickCatalogStatus: number | null = null;
    let kickCatalogAuthenticated = false;
    let scopeUpgradeRequired = false;

    if (platform === "twitch") {
      const stored = await readPlatformSession("twitch");
      refreshedSession = stored
        ? await refreshPlatformSession("twitch", stored)
        : null;

      const native = await getTwitchPickerEmotes(channelId, refreshedSession);
      for (const emote of native.emotes) {
        items.push({
          ...emote,
          provider: "twitch",
          category: categoryFromNativeScope(emote.scope),
          native: true,
        });
      }
      scopeUpgradeRequired = Boolean(stored && !native.userScopeAvailable);
    } else if (platform === "kick") {
      kickStoredSession = await readPlatformSession("kick");
      refreshedSession = kickStoredSession
        ? await refreshPlatformSession("kick", kickStoredSession)
        : null;

      const slug = channelName
        .replace(/^@/, "")
        .replace(/^https?:\/\/(?:www\.)?kick\.com\//i, "")
        .split(/[/?#]/)[0]
        .toLowerCase();

      if (slug && refreshedSession?.accessToken) {
        const native = await getAuthenticatedKickEmotes(
          slug,
          refreshedSession.accessToken,
        );
        kickCatalogStatus = native.status;
        kickCatalogAuthenticated = native.emotes.some(
          (emote) => emote.category === "kick-collectibles",
        );

        for (const emote of native.emotes) {
          items.push(emote);
        }
      }
    } else if (platform === "youtube") {
      if (!videoId) {
        videoId = (await resolvePublicYouTubeLiveVideoId(channelId)) || "";
      }

      if (videoId) {
        const native = await getYouTubePickerEmotes(videoId);
        for (const emote of native) {
          items.push({
            id: emote.id,
            code: emote.shortcut,
            name: emote.shortcut,
            url: emote.url,
            provider: "youtube",
            category: emote.category === "channel" ? "channel" : "official",
            scope: emote.category === "channel" ? "channel" : "global",
              native: true,
          });
        }
      }
    }

    const thirdParty = await getThirdPartyEmotes(channelId, platform);
    for (const emote of Object.values(thirdParty.emotes)) {
      items.push({
        code: emote.code,
        name: emote.code,
        url: emote.url,
        provider: emote.provider,
        category: "thirdparty",
        scope: emote.scope,
        animated: emote.animated,
        zeroWidth: emote.zeroWidth,
        native: false,
      });
    }

    const unique = new Map<string, PickerEmote>();
    for (const item of sortItems(items)) {
      const key = `${item.provider}:${item.id || item.code}`;
      if (!unique.has(key)) unique.set(key, item);
    }

    const values = [...unique.values()];
    const response = NextResponse.json(
      {
        platform,
        videoId: videoId || undefined,
        nativeCount: values.filter(
          (item) =>
            item.provider === platform &&
            item.category !== "thirdparty",
        ).length,
        emotes: values,
        providers: {
          native: platform === "twitch" || platform === "youtube",
          ...thirdParty.providers,
        },
        scopeUpgradeRequired,
        ...(platform === "kick"
          ? {
              kickCatalogAuthenticated,
              kickCatalogStatus,
              kickCollectibleCount: values.filter(
                (item) =>
                  item.provider === "kick" &&
                  item.category === "kick-collectibles",
              ).length,
            }
          : {}),
      },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );

    if (platform === "twitch") {
      const stored = await readPlatformSession("twitch");
      if (
        stored &&
        refreshedSession &&
        refreshedSession.accessToken !== stored.accessToken
      ) {
        writePlatformSession(response, "twitch", refreshedSession);
      }
    } else if (
      platform === "kick" &&
      kickStoredSession &&
      refreshedSession &&
      refreshedSession.accessToken !== kickStoredSession.accessToken
    ) {
      writePlatformSession(response, "kick", refreshedSession);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao carregar emotes.",
      },
      { status: 500 },
    );
  }
}
