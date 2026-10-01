import { getTwitchAppToken } from "@/lib/app-tokens";
import type { PlatformSession } from "@/lib/types";

export type TwitchPickerEmote = {
  code: string;
  url: string;
  provider: "twitch";
  scope: "global" | "channel" | "user";
  animated?: boolean;
};

type PickerCacheEntry = {
  value: { emotes: TwitchPickerEmote[]; userScopeAvailable: boolean };
  expiresAt: number;
};

const pickerCache = new Map<string, PickerCacheEntry>();
const PICKER_TTL = 10 * 60 * 1000;

function emoteUrl(template: string, emote: any) {
  const formats = Array.isArray(emote?.format) ? emote.format : ["static"];
  const scales = Array.isArray(emote?.scale) ? emote.scale : ["2.0"];
  const themes = Array.isArray(emote?.theme_mode) ? emote.theme_mode : ["dark"];
  const format = formats.includes("animated") ? "animated" : (formats[0] || "static");
  const scale = scales.includes("2.0") ? "2.0" : (scales[0] || "1.0");
  const theme = themes.includes("dark") ? "dark" : (themes[0] || "light");

  return template
    .replace("{{id}}", encodeURIComponent(String(emote.id)))
    .replace("{{format}}", format)
    .replace("{{theme_mode}}", theme)
    .replace("{{scale}}", scale);
}

async function twitchJson(url: URL, token: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID || "",
    },
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || `Twitch respondeu ${res.status}.`);
  }
  return json;
}

function appendResponse(
  target: Map<string, TwitchPickerEmote>,
  json: any,
  scope: TwitchPickerEmote["scope"],
) {
  const template = typeof json?.template === "string" ? json.template : "";
  for (const item of json?.data || []) {
    if (!item?.id || !item?.name) continue;
    const url = template
      ? emoteUrl(template, item)
      : item?.images?.url_2x || item?.images?.url_1x || "";
    if (!url) continue;
    target.set(String(item.id), {
      code: String(item.name),
      url,
      provider: "twitch",
      scope,
      animated: Array.isArray(item?.format) && item.format.includes("animated"),
    });
  }
}

async function loadUserEmotes(
  session: PlatformSession,
  broadcasterId: string,
  target: Map<string, TwitchPickerEmote>,
) {
  if (!session.userId) return false;

  let after = "";
  let pages = 0;
  try {
    do {
      const url = new URL("https://api.twitch.tv/helix/chat/emotes/user");
      url.searchParams.set("user_id", session.userId);
      url.searchParams.set("first", "100");
      if (broadcasterId) url.searchParams.set("broadcaster_id", broadcasterId);
      if (after) url.searchParams.set("after", after);

      const json = await twitchJson(url, session.accessToken);
      appendResponse(target, json, "user");
      after = String(json?.pagination?.cursor || "");
      pages++;
    } while (after && pages < 20);
    return true;
  } catch {
    return false;
  }
}

export async function getTwitchPickerEmotes(
  broadcasterId: string,
  session?: PlatformSession | null,
) {
  const scopeKey = (session?.scope || []).slice().sort().join(",");
  const cacheKey = `${broadcasterId}:${session?.userId || "anon"}:${scopeKey}`;
  const cached = pickerCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const target = new Map<string, TwitchPickerEmote>();
  const appToken = await getTwitchAppToken();

  const globalUrl = new URL("https://api.twitch.tv/helix/chat/emotes/global");
  const channelUrl = new URL("https://api.twitch.tv/helix/chat/emotes");
  channelUrl.searchParams.set("broadcaster_id", broadcasterId);

  const [globalResult, channelResult] = await Promise.allSettled([
    twitchJson(globalUrl, appToken),
    twitchJson(channelUrl, appToken),
  ]);

  if (globalResult.status === "fulfilled") {
    appendResponse(target, globalResult.value, "global");
  }
  if (channelResult.status === "fulfilled") {
    appendResponse(target, channelResult.value, "channel");
  }

  const userScopeAvailable = session
    ? await loadUserEmotes(session, broadcasterId, target)
    : false;

  const value = {
    emotes: [...target.values()],
    userScopeAvailable,
  };
  pickerCache.set(cacheKey, { value, expiresAt: Date.now() + PICKER_TTL });
  return value;
}
