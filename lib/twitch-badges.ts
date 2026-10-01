import { getTwitchAppToken } from "@/lib/app-tokens";

export type TwitchBadgeImage = {
  setId: string;
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
};

type CacheEntry = {
  expiresAt: number;
  badges: Record<string, TwitchBadgeImage>;
};

const globalCache: { value?: CacheEntry } = {};
const channelCache = new Map<string, CacheEntry>();
const TTL = 6 * 60 * 60 * 1000;

async function helix(path: string) {
  const token = await getTwitchAppToken();
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID || "",
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || `Twitch badges respondeu ${res.status}.`);
  }
  return json;
}

function flattenBadgeSets(data: any): Record<string, TwitchBadgeImage> {
  const result: Record<string, TwitchBadgeImage> = {};

  for (const set of Array.isArray(data) ? data : []) {
    const setId = String(set?.set_id || "");
    if (!setId) continue;

    for (const version of Array.isArray(set?.versions) ? set.versions : []) {
      const id = String(version?.id || "");
      if (!id) continue;
      const imageUrl =
        String(version?.image_url_2x || version?.image_url_1x || version?.image_url_4x || "");
      if (!imageUrl) continue;

      result[`${setId}:${id}`] = {
        setId,
        id,
        title: String(version?.title || setId),
        description: version?.description ? String(version.description) : undefined,
        imageUrl,
      };
    }
  }

  return result;
}

async function globalBadges() {
  if (globalCache.value && globalCache.value.expiresAt > Date.now()) {
    return globalCache.value.badges;
  }

  const json = await helix("/chat/badges/global");
  const badges = flattenBadgeSets(json?.data);
  globalCache.value = { badges, expiresAt: Date.now() + TTL };
  return badges;
}

async function channelBadges(channelId: string) {
  const cached = channelCache.get(channelId);
  if (cached && cached.expiresAt > Date.now()) return cached.badges;

  const json = await helix(
    `/chat/badges?broadcaster_id=${encodeURIComponent(channelId)}`,
  );
  const badges = flattenBadgeSets(json?.data);
  channelCache.set(channelId, { badges, expiresAt: Date.now() + TTL });
  return badges;
}

export async function getTwitchBadgeCatalog(channelId: string) {
  const [global, channel] = await Promise.all([
    globalBadges(),
    channelBadges(channelId),
  ]);

  // Badges específicas do canal devem prevalecer sobre versões globais com
  // o mesmo set/id (subscriber, bits, founder etc.).
  return {
    ...global,
    ...channel,
  };
}
