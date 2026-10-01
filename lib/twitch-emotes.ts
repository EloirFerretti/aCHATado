import { getTwitchAppToken } from "@/lib/app-tokens";
import type { PlatformSession } from "@/lib/types";

export type TwitchPickerEmote = {
  id: string;
  code: string;
  url: string;
  provider: "twitch";
  scope: "global" | "channel" | "user";
  animated?: boolean;
  emoteType?: string;
  tier?: string;
  requiresSubscription?: boolean;
  locked?: boolean;
  lockReason?: string;
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

function fromApiItem(
  item: any,
  template: string,
  scope: TwitchPickerEmote["scope"],
): TwitchPickerEmote | null {
  if (!item?.id || !item?.name) return null;
  const url = template
    ? emoteUrl(template, item)
    : item?.images?.url_2x || item?.images?.url_1x || "";
  if (!url) return null;

  const emoteType = String(item?.emote_type || "");
  const requiresSubscription = emoteType === "subscriptions";

  return {
    id: String(item.id),
    code: String(item.name),
    url,
    provider: "twitch",
    scope,
    animated: Array.isArray(item?.format) && item.format.includes("animated"),
    emoteType: emoteType || undefined,
    tier: item?.tier ? String(item.tier) : undefined,
    requiresSubscription,
  };
}

function appendResponse(
  target: Map<string, TwitchPickerEmote>,
  json: any,
  scope: TwitchPickerEmote["scope"],
  overwrite = true,
) {
  const template = typeof json?.template === "string" ? json.template : "";
  for (const item of json?.data || []) {
    const emote = fromApiItem(item, template, scope);
    if (!emote) continue;
    if (!overwrite && target.has(emote.id)) continue;
    target.set(emote.id, emote);
  }
}

async function loadUserEmotes(
  session: PlatformSession,
  broadcasterId: string,
) {
  const availableIds = new Set<string>();
  const userOnly = new Map<string, TwitchPickerEmote>();
  if (!session.userId) return { ok: false, availableIds, userOnly };

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
      const template = typeof json?.template === "string" ? json.template : "";
      for (const item of json?.data || []) {
        if (!item?.id) continue;
        const id = String(item.id);
        availableIds.add(id);
        const emote = fromApiItem(item, template, "user");
        if (emote) userOnly.set(id, emote);
      }

      after = String(json?.pagination?.cursor || "");
      pages++;
    } while (after && pages < 20);

    return { ok: true, availableIds, userOnly };
  } catch {
    return { ok: false, availableIds, userOnly };
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

  const user = session
    ? await loadUserEmotes(session, broadcasterId)
    : { ok: false, availableIds: new Set<string>(), userOnly: new Map<string, TwitchPickerEmote>() };

  // Mantém metadados do canal (tipo/tier) quando o mesmo emote também aparece
  // em Get User Emotes. Emotes exclusivos do usuário são adicionados em "Seus emotes".
  for (const [id, emote] of user.userOnly) {
    if (!target.has(id)) target.set(id, emote);
  }

  const isBroadcaster = Boolean(session?.userId && session.userId === broadcasterId);
  for (const emote of target.values()) {
    if (!emote.requiresSubscription) continue;

    const allowed = isBroadcaster || user.availableIds.has(emote.id);
    emote.locked = !allowed;
    if (!allowed) {
      const tierLabel =
        emote.tier === "3000" ? "Tier 3" :
        emote.tier === "2000" ? "Tier 2" :
        emote.tier === "1000" ? "Tier 1" :
        "assinatura";
      emote.lockReason = `Requer assinatura ${tierLabel} deste canal.`;
    }
  }

  const value = {
    emotes: [...target.values()],
    userScopeAvailable: user.ok,
  };
  pickerCache.set(cacheKey, { value, expiresAt: Date.now() + PICKER_TTL });
  return value;
}
