export type YouTubeEmote = {
  shortcut: string;
  url: string;
  custom: boolean;
};

type CacheEntry = {
  emotes: Record<string, YouTubeEmote>;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const TTL = 10 * 60 * 1000;

function extractAssignedJson(html: string, marker: string) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;

  const start = html.indexOf("{", markerIndex + marker.length);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i++) {
    const char = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function normalizeImageUrl(url: unknown) {
  if (typeof url !== "string" || !url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function collectEmojiObjects(value: unknown, target: Record<string, YouTubeEmote>) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) collectEmojiObjects(item, target);
    return;
  }

  const object = value as Record<string, any>;
  const emoji = object.emoji;
  if (emoji && typeof emoji === "object") {
    const thumbnails = Array.isArray(emoji?.image?.thumbnails) ? emoji.image.thumbnails : [];
    const image = thumbnails
      .slice()
      .sort((a: any, b: any) => Number(b?.width || 0) - Number(a?.width || 0))
      .find((entry: any) => entry?.url);

    const url = normalizeImageUrl(image?.url);
    const shortcuts = Array.isArray(emoji?.shortcuts) ? emoji.shortcuts : [];

    if (url) {
      for (const shortcut of shortcuts) {
        if (typeof shortcut !== "string" || !shortcut) continue;
        target[shortcut] = {
          shortcut,
          url,
          custom: Boolean(emoji?.isCustomEmoji),
        };
      }
    }
  }

  for (const child of Object.values(object)) {
    collectEmojiObjects(child, target);
  }
}

export async function getYouTubeLiveEmotes(videoId: string) {
  const cached = cache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) return cached.emotes;

  const url = new URL("https://www.youtube.com/live_chat");
  url.searchParams.set("is_popout", "1");
  url.searchParams.set("v", videoId);
  url.searchParams.set("hl", "en");

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (compatible; aCHATado/1.0; +https://achatado.onrender.com)",
    },
  });

  if (!res.ok) {
    throw new Error(`YouTube live chat respondeu ${res.status} ao carregar emotes.`);
  }

  const html = await res.text();
  const initialData =
    extractAssignedJson(html, "ytInitialData =") ||
    extractAssignedJson(html, 'window["ytInitialData"] =') ||
    extractAssignedJson(html, "var ytInitialData =");

  const emotes: Record<string, YouTubeEmote> = {};
  if (initialData) collectEmojiObjects(initialData, emotes);

  cache.set(videoId, { emotes, expiresAt: Date.now() + TTL });
  return emotes;
}
