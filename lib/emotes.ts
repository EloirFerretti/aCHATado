export type ThirdPartyPlatform = "twitch" | "kick" | "youtube";
export type EmoteScope = "global" | "channel";

export type ThirdPartyEmote = {
  code: string;
  url: string;
  provider: "bttv" | "ffz" | "7tv";
  scope: EmoteScope;
  animated?: boolean;
  zeroWidth?: boolean;
};

type EmoteCatalog = {
  emotes: Record<string, ThirdPartyEmote>;
  providers: {
    bttv: boolean;
    ffz: boolean;
    "7tv": boolean;
  };
  updatedAt: string;
};

type CacheEntry = {
  value: EmoteCatalog;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const TTL = 10 * 60 * 1000;

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeUrl(url: unknown) {
  if (typeof url !== "string" || !url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function addEmote(
  target: Record<string, ThirdPartyEmote>,
  emote: ThirdPartyEmote | null,
) {
  if (!emote?.code || !emote.url) return;
  target[emote.code] = emote;
}

function parseBttv(emote: any, scope: EmoteScope): ThirdPartyEmote | null {
  if (!emote?.id || !emote?.code) return null;
  return {
    code: String(emote.code),
    url: `https://cdn.betterttv.net/emote/${emote.id}/2x`,
    provider: "bttv",
    scope,
    animated: Boolean(emote.animated || emote.imageType === "gif"),
  };
}

function ffzSets(json: any) {
  return Object.values(json?.sets || {}) as any[];
}

function parseFfz(emote: any, scope: EmoteScope): ThirdPartyEmote | null {
  const animatedUrl =
    emote?.animated?.["2"] ||
    emote?.animated?.["4"] ||
    emote?.animated?.["1"];
  const staticUrl =
    emote?.urls?.["2"] ||
    emote?.urls?.["4"] ||
    emote?.urls?.["1"];
  const url = normalizeUrl(animatedUrl || staticUrl);
  if (!emote?.name || !url) return null;
  return {
    code: String(emote.name),
    url,
    provider: "ffz",
    scope,
    animated: Boolean(animatedUrl),
  };
}

function choose7tvFile(files: any[]) {
  if (!Array.isArray(files) || !files.length) return null;
  const priorities = [
    "2x.webp",
    "2x.avif",
    "3x.webp",
    "1x.webp",
    "2x.gif",
    "1x.gif",
  ];
  for (const name of priorities) {
    const file = files.find((entry) => entry?.name === name);
    if (file) return file;
  }
  return files.find((entry) => /\.(webp|avif|gif|png)$/i.test(entry?.name || "")) || files[0];
}

function parse7tv(emote: any, scope: EmoteScope): ThirdPartyEmote | null {
  const data = emote?.data || emote?.emote || emote;
  const host = data?.host;
  const file = choose7tvFile(host?.files || []);
  const base = normalizeUrl(host?.url);
  const code = emote?.name || emote?.alias || data?.name;

  if (!code || !base || !file?.name) return null;

  const flagList = Array.isArray(data?.flags) ? data.flags : [];
  return {
    code: String(code),
    url: `${base.replace(/\/$/, "")}/${file.name}`,
    provider: "7tv",
    scope,
    animated: Boolean(data?.animated || /\.gif$/i.test(file.name)),
    zeroWidth: Boolean(
      emote?.flags?.zeroWidth ||
      emote?.flags?.zero_width ||
      flagList.includes("ZERO_WIDTH"),
    ),
  };
}

async function loadBttv(
  platform: ThirdPartyPlatform,
  channelId: string,
  emotes: Record<string, ThirdPartyEmote>,
) {
  if (platform === "kick") return false;

  const provider = platform === "youtube" ? "youtube" : "twitch";
  const [global, channel] = await Promise.all([
    fetchJson("https://api.betterttv.net/3/cached/emotes/global"),
    fetchJson(`https://api.betterttv.net/3/cached/users/${provider}/${encodeURIComponent(channelId)}`),
  ]);

  if (Array.isArray(global)) {
    for (const item of global) addEmote(emotes, parseBttv(item, "global"));
  }

  if (channel) {
    for (const item of channel.channelEmotes || []) addEmote(emotes, parseBttv(item, "channel"));
    for (const item of channel.sharedEmotes || []) addEmote(emotes, parseBttv(item, "channel"));
  }

  return true;
}

async function loadFfz(
  platform: ThirdPartyPlatform,
  channelId: string,
  emotes: Record<string, ThirdPartyEmote>,
) {
  if (platform === "kick") return false;

  const roomPath =
    platform === "youtube"
      ? `yt/${encodeURIComponent(channelId)}`
      : `id/${encodeURIComponent(channelId)}`;

  const [global, room] = await Promise.all([
    fetchJson("https://api.frankerfacez.com/v1/set/global"),
    fetchJson(`https://api.frankerfacez.com/v1/room/${roomPath}`),
  ]);

  const defaultSets = new Set((global?.default_sets || []).map((id: unknown) => String(id)));
  for (const set of ffzSets(global)) {
    if (defaultSets.size && !defaultSets.has(String(set?.id))) continue;
    for (const item of set?.emoticons || []) addEmote(emotes, parseFfz(item, "global"));
  }

  for (const set of ffzSets(room)) {
    for (const item of set?.emoticons || []) addEmote(emotes, parseFfz(item, "channel"));
  }

  return true;
}

async function resolve7tvUserSet(platform: ThirdPartyPlatform, channelId: string) {
  const user = await fetchJson(
    `https://7tv.io/v3/users/${platform}/${encodeURIComponent(channelId)}`,
  );
  if (!user) return null;

  if (Array.isArray(user?.emote_set?.emotes)) return user.emote_set;

  const setId =
    user?.emote_set_id ||
    user?.emote_set?.id ||
    user?.connections?.find?.((c: any) => String(c?.platform || "").toLowerCase() === platform)?.emote_set_id;

  if (!setId) return null;
  return await fetchJson(
    `https://7tv.io/v3/emote-sets/${encodeURIComponent(String(setId))}`,
  );
}

async function load7tv(
  platform: ThirdPartyPlatform,
  channelId: string,
  emotes: Record<string, ThirdPartyEmote>,
) {
  const [globalSet, channelSet] = await Promise.all([
    fetchJson("https://7tv.io/v3/emote-sets/global"),
    resolve7tvUserSet(platform, channelId),
  ]);

  for (const item of globalSet?.emotes || []) addEmote(emotes, parse7tv(item, "global"));
  for (const item of channelSet?.emotes || []) addEmote(emotes, parse7tv(item, "channel"));
  return true;
}

export async function getThirdPartyEmotes(
  channelId: string,
  platform: ThirdPartyPlatform = "twitch",
): Promise<EmoteCatalog> {
  const cacheKey = `${platform}:${channelId}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const emotes: Record<string, ThirdPartyEmote> = {};
  const providers = { bttv: false, ffz: false, "7tv": false };

  const results = await Promise.allSettled([
    loadBttv(platform, channelId, emotes),
    loadFfz(platform, channelId, emotes),
    load7tv(platform, channelId, emotes),
  ]);

  providers.bttv = results[0].status === "fulfilled" && results[0].value === true;
  providers.ffz = results[1].status === "fulfilled" && results[1].value === true;
  providers["7tv"] = results[2].status === "fulfilled" && results[2].value === true;

  const value: EmoteCatalog = {
    emotes,
    providers,
    updatedAt: new Date().toISOString(),
  };

  cache.set(cacheKey, { value, expiresAt: Date.now() + TTL });
  return value;
}
