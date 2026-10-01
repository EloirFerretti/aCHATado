import { NextRequest, NextResponse } from "next/server";
import { getThirdPartyEmotes, type ThirdPartyPlatform } from "@/lib/emotes";
import { getTwitchPickerEmotes } from "@/lib/twitch-emotes";
import { getYouTubeLiveEmotes, resolvePublicYouTubeLiveVideoId } from "@/lib/youtube-emotes";
import { readPlatformSession, writePlatformSession } from "@/lib/session";
import { refreshPlatformSession } from "@/lib/platform-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PickerEmote = {
  id?: string;
  code: string;
  url: string;
  provider: "twitch" | "youtube" | "bttv" | "ffz" | "7tv";
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
  return value === "twitch" || value === "kick" || value === "youtube" ? value : null;
}

function sortEmotes(items: PickerEmote[]) {
  const scopeOrder = { user: 0, channel: 1, global: 2 };
  const providerOrder = { twitch: 0, youtube: 0, "7tv": 1, bttv: 2, ffz: 3 };
  return items.sort((a, b) =>
    scopeOrder[a.scope] - scopeOrder[b.scope] ||
    providerOrder[a.provider] - providerOrder[b.provider] ||
    a.code.localeCompare(b.code),
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
    const emotes: PickerEmote[] = [];
    let refreshedSession = null;
    let scopeUpgradeRequired = false;

    if (platform === "twitch") {
      const stored = await readPlatformSession("twitch");
      refreshedSession = stored ? await refreshPlatformSession("twitch", stored) : null;
      const native = await getTwitchPickerEmotes(channelId, refreshedSession);
      emotes.push(...native.emotes.map((emote) => ({ ...emote, native: true })));
      scopeUpgradeRequired = Boolean(stored && !native.userScopeAvailable);
    } else if (platform === "youtube") {
      if (!videoId) {
        videoId = (await resolvePublicYouTubeLiveVideoId(channelId)) || "";
      }

      if (videoId) {
        const native = await getYouTubeLiveEmotes(videoId);
        for (const emote of Object.values(native)) {
          emotes.push({
            id: emote.id,
            code: emote.shortcut,
            url: emote.url,
            provider: "youtube",
            scope: emote.custom ? "channel" : "global",
            native: true,
          });
        }
      }
    }

    const thirdParty = await getThirdPartyEmotes(channelId, platform);
    for (const emote of Object.values(thirdParty.emotes)) {
      emotes.push({
        code: emote.code,
        url: emote.url,
        provider: emote.provider,
        scope: emote.scope,
        animated: emote.animated,
        zeroWidth: emote.zeroWidth,
        native: false,
      });
    }

    const unique = new Map<string, PickerEmote>();
    for (const emote of sortEmotes(emotes)) {
      const key = `${emote.provider}:${emote.code}`;
      if (!unique.has(key)) unique.set(key, emote);
    }

    const response = NextResponse.json(
      {
        platform,
        videoId: videoId || undefined,
        nativeCount: [...unique.values()].filter((emote) => emote.provider === "youtube").length,
        emotes: [...unique.values()],
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
      if (stored && refreshedSession && refreshedSession.accessToken !== stored.accessToken) {
        writePlatformSession(response, "twitch", refreshedSession);
      }
    }
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar emotes." },
      { status: 500 },
    );
  }
}
