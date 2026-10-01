export type YouTubeEmote = {
  id?: string;
  shortcut: string;
  url: string;
  custom: boolean;
};

type CacheEntry = {
  emotes: Record<string, YouTubeEmote>;
  expiresAt: number;
};

type VideoCacheEntry = {
  videoId: string | null;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const videoCache = new Map<string, VideoCacheEntry>();
const TTL = 10 * 60 * 1000;
const VIDEO_TTL = 2 * 60 * 1000;

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

function bestThumbnail(image: any) {
  const thumbnails = Array.isArray(image?.thumbnails) ? image.thumbnails : [];
  const thumbnail = thumbnails
    .slice()
    .sort((a: any, b: any) =>
      Number(b?.width || 0) * Number(b?.height || 0) -
      Number(a?.width || 0) * Number(a?.height || 0)
    )
    .find((entry: any) => entry?.url);

  return normalizeImageUrl(thumbnail?.url);
}

function addEmojiObject(
  emoji: any,
  target: Record<string, YouTubeEmote>,
) {
  if (!emoji || typeof emoji !== "object") return;

  const url = bestThumbnail(emoji.image || emoji.icon || emoji.thumbnail);
  const shortcuts = Array.isArray(emoji.shortcuts)
    ? emoji.shortcuts
    : typeof emoji.shortcut === "string"
      ? [emoji.shortcut]
      : [];

  if (!url || !shortcuts.length) return;

  const id =
    emoji.emojiId ||
    emoji.id ||
    emoji.emoji_id ||
    undefined;

  for (const shortcut of shortcuts) {
    if (typeof shortcut !== "string" || !shortcut.trim()) continue;
    const code = shortcut.trim();
    target[code] = {
      id: id ? String(id) : undefined,
      shortcut: code,
      url,
      custom: Boolean(
        emoji.isCustomEmoji ||
        emoji.isCustom ||
        emoji.custom ||
        emoji.emojiType === "CUSTOM",
      ),
    };
  }
}

function collectEmojiObjects(
  value: unknown,
  target: Record<string, YouTubeEmote>,
) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) collectEmojiObjects(item, target);
    return;
  }

  const object = value as Record<string, any>;

  // O YouTube usa ambos os formatos:
  // 1) { emoji: { shortcuts, image, ... } }
  // 2) o próprio objeto do array liveChatRenderer.emojis contém
  //    { emojiId, shortcuts, image, isCustomEmoji }.
  if (object.emoji && typeof object.emoji === "object") {
    addEmojiObject(object.emoji, target);
  }
  if (
    Array.isArray(object.shortcuts) &&
    (object.image || object.icon || object.thumbnail)
  ) {
    addEmojiObject(object, target);
  }

  for (const child of Object.values(object)) {
    collectEmojiObjects(child, target);
  }
}

function collectLiveChatRendererEmojis(
  initialData: any,
  target: Record<string, YouTubeEmote>,
) {
  const candidates = [
    initialData?.contents?.liveChatRenderer?.emojis,
    initialData?.continuationContents?.liveChatContinuation?.emojis,
  ];

  for (const emojis of candidates) {
    if (!Array.isArray(emojis)) continue;
    for (const emoji of emojis) addEmojiObject(emoji, target);
  }
}

async function fetchYouTubeHtml(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (compatible; aCHATado/1.0; +https://achatado.onrender.com)",
    },
  });

  if (!res.ok) {
    throw new Error(`YouTube respondeu ${res.status} ao carregar emotes.`);
  }

  return { html: await res.text(), finalUrl: res.url };
}

export async function resolvePublicYouTubeLiveVideoId(channelId: string) {
  const cached = videoCache.get(channelId);
  if (cached && cached.expiresAt > Date.now()) return cached.videoId;

  try {
    const { html, finalUrl } = await fetchYouTubeHtml(
      `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/live`,
    );

    let videoId = "";

    try {
      const url = new URL(finalUrl);
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v") || "";
      }
    } catch {
      // Continua procurando no HTML.
    }

    if (!videoId) {
      videoId =
        html.match(
          /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/i,
        )?.[1] ||
        html.match(/"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/)?.[1] ||
        "";
    }

    const value = videoId || null;
    videoCache.set(channelId, {
      videoId: value,
      expiresAt: Date.now() + VIDEO_TTL,
    });
    return value;
  } catch {
    videoCache.set(channelId, {
      videoId: null,
      expiresAt: Date.now() + 30_000,
    });
    return null;
  }
}

export async function getYouTubeLiveEmotes(videoId: string) {
  const cached = cache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) return cached.emotes;

  const url = new URL("https://www.youtube.com/live_chat");
  url.searchParams.set("is_popout", "1");
  url.searchParams.set("v", videoId);
  url.searchParams.set("hl", "en");

  const { html } = await fetchYouTubeHtml(url.toString());

  const initialData =
    extractAssignedJson(html, "ytInitialData =") ||
    extractAssignedJson(html, 'window["ytInitialData"] =') ||
    extractAssignedJson(html, "var ytInitialData =");

  const emotes: Record<string, YouTubeEmote> = {};
  if (initialData) {
    collectLiveChatRendererEmojis(initialData, emotes);
    collectEmojiObjects(initialData, emotes);
  }

  cache.set(videoId, { emotes, expiresAt: Date.now() + TTL });
  return emotes;
}
