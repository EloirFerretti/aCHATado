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
  | "youtube"
  | "bttv"
  | "ffz"
  | "7tv";

type PickerCategory =
  | "user"
  | "channel"
  | "official"
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

function sortItems(items: PickerEmote[]) {
  const categoryOrder: Record<PickerCategory, number> = {
    user: 0,
    channel: 1,
    official: 2,
    thirdparty: 3,
  };
  const providerOrder: Record<PickerProvider, number> = {
    twitch: 0,
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
            item.category === "official" || item.category === "channel",
        ).length,
        emotes: values,
        providers: {
          native: platform === "twitch" || platform === "youtube",
          ...thirdParty.providers,
        },
        scopeUpgradeRequired,
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
