import { youtubeGlobalEmotes } from "@/lib/youtube-global-emotes";

export type YouTubeEmoteCategory = "official" | "channel";

export type YouTubeEmote = {
  id?: string;
  shortcut: string;
  aliases?: string[];
  url: string;
  custom: boolean;
  category?: YouTubeEmoteCategory;
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
const TTL = 5 * 60 * 1000;
const EMPTY_TTL = 30 * 1000;
const VIDEO_TTL = 2 * 60 * 1000;

function extractJsonAt(text: string, start: number) {
  if (start < 0 || text[start] !== "{") return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function extractAssignedJson(html: string, markers: string[]) {
  for (const marker of markers) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex < 0) continue;
    const start = html.indexOf("{", markerIndex + marker.length);
    const value = extractJsonAt(html, start);
    if (value) return value;
  }
  return null;
}

function extractYtcfg(html: string) {
  const merged: Record<string, any> = {};
  let offset = 0;

  while (offset < html.length) {
    const marker = html.indexOf("ytcfg.set(", offset);
    if (marker < 0) break;
    const start = html.indexOf("{", marker + 10);
    const value = extractJsonAt(html, start);
    if (value && typeof value === "object") Object.assign(merged, value);
    offset = start > marker ? start + 1 : marker + 10;
  }

  return merged;
}

function normalizeImageUrl(url: unknown) {
  if (typeof url !== "string" || !url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  return url.replace(/\\u0026/g, "&");
}

function bestThumbnail(image: any) {
  const thumbnails = Array.isArray(image?.thumbnails) ? image.thumbnails : [];
  const thumbnail = thumbnails
    .slice()
    .sort(
      (a: any, b: any) =>
        Number(b?.width || 0) * Number(b?.height || 0) -
        Number(a?.width || 0) * Number(a?.height || 0),
    )
    .find((entry: any) => entry?.url);

  return normalizeImageUrl(thumbnail?.url);
}

function normalizeAliases(emoji: any) {
  const result = new Set<string>();
  const explicit = Array.isArray(emoji?.shortcuts)
    ? emoji.shortcuts
    : typeof emoji?.shortcut === "string"
      ? [emoji.shortcut]
      : [];

  for (const value of explicit) {
    if (typeof value === "string" && value.trim()) result.add(value.trim());
  }

  const id = String(emoji?.emojiId || emoji?.id || "").trim();
  if (id) {
    result.add(id);
    if (
      !id.startsWith(":") &&
      /^[A-Za-z0-9_+\-.]+$/.test(id)
    ) {
      result.add(`:${id}:`);
    }
  }

  return [...result];
}

function addEmojiObject(
  emoji: any,
  target: Record<string, YouTubeEmote>,
) {
  if (!emoji || typeof emoji !== "object") return;

  const url = bestThumbnail(emoji.image || emoji.icon || emoji.thumbnail);
  const aliases = normalizeAliases(emoji);
  if (!url || !aliases.length) return;

  const id =
    emoji.emojiId ||
    emoji.id ||
    emoji.emoji_id ||
    undefined;

  const preferred =
    aliases.find((value) => value.startsWith(":") && value.endsWith(":")) ||
    aliases[0];

  const value: YouTubeEmote = {
    id: id ? String(id) : undefined,
    shortcut: preferred,
    aliases,
    url,
    custom: Boolean(
      emoji.isCustomEmoji ||
      emoji.isCustom ||
      emoji.custom ||
      emoji.emojiType === "CUSTOM",
    ),
  };

  for (const alias of aliases) {
    target[alias] = value;
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

  if (object.emoji && typeof object.emoji === "object") {
    addEmojiObject(object.emoji, target);
  }

  if (
    (Array.isArray(object.shortcuts) || object.emojiId || object.id) &&
    (object.image || object.icon || object.thumbnail)
  ) {
    addEmojiObject(object, target);
  }

  for (const child of Object.values(object)) {
    collectEmojiObjects(child, target);
  }
}

function collectPickerCategories(
  value: unknown,
  target: Map<string, YouTubeEmoteCategory>,
  unicode: Set<string>,
) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) collectPickerCategories(item, target, unicode);
    return;
  }

  const object = value as Record<string, any>;
  const category = object.emojiPickerCategoryRenderer;
  if (category && typeof category === "object") {
    const type = String(category.categoryType || "");
    const ids = Array.isArray(category.emojiIds) ? category.emojiIds : [];

    if (type === "CATEGORY_TYPE_UNICODE") {
      for (const id of ids) {
        if (typeof id === "string" && id) unicode.add(id);
      }
    } else {
      const mapped: YouTubeEmoteCategory | null =
        type === "CATEGORY_TYPE_GLOBAL"
          ? "official"
          : type === "CATEGORY_TYPE_CUSTOM"
            ? "channel"
            : null;

      if (mapped) {
        for (const id of ids) {
          if (typeof id === "string" && id) target.set(id, mapped);
        }
      }
    }
  }

  for (const child of Object.values(object)) {
    collectPickerCategories(child, target, unicode);
  }
}

function collectContinuationTokens(value: unknown, target: Set<string>) {
  if (!value || typeof value !== "object" || target.size >= 8) return;

  if (Array.isArray(value)) {
    for (const item of value) collectContinuationTokens(item, target);
    return;
  }

  const object = value as Record<string, any>;
  for (const key of [
    "reloadContinuationData",
    "invalidationContinuationData",
    "timedContinuationData",
  ]) {
    const token = object?.[key]?.continuation;
    if (typeof token === "string" && token) target.add(token);
  }

  for (const child of Object.values(object)) {
    collectContinuationTokens(child, target);
  }
}

function liveChatContinuations(initialData: any) {
  const tokens = new Set<string>();

  const renderer =
    initialData?.contents?.twoColumnWatchNextResults?.conversationBar?.liveChatRenderer ||
    initialData?.contents?.singleColumnWatchNextResults?.conversationBar?.liveChatRenderer;

  if (renderer) collectContinuationTokens(renderer, tokens);

  // Fallback para mudanças de layout do YouTube.
  if (!tokens.size) {
    const walk = (value: any) => {
      if (!value || typeof value !== "object" || tokens.size >= 8) return;
      if (value.liveChatRenderer) {
        collectContinuationTokens(value.liveChatRenderer, tokens);
      }
      if (Array.isArray(value)) {
        for (const item of value) walk(item);
      } else {
        for (const child of Object.values(value)) walk(child);
      }
    };
    walk(initialData);
  }

  return [...tokens];
}

async function fetchYouTubeHtml(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: "CONSENT=YES+cb; SOCS=CAI; PREF=hl=en&gl=US",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`YouTube respondeu ${res.status} ao carregar o chat.`);
  }

  return { html: await res.text(), finalUrl: res.url };
}

function initialDataFromHtml(html: string) {
  return extractAssignedJson(html, [
    "ytInitialData =",
    'window["ytInitialData"] =',
    "var ytInitialData =",
  ]);
}

async function fetchContinuationJson(
  continuation: string,
  ytcfg: Record<string, any>,
) {
  const apiKey = String(ytcfg?.INNERTUBE_API_KEY || "");
  const context = ytcfg?.INNERTUBE_CONTEXT;
  if (!apiKey || !context) return null;

  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${encodeURIComponent(apiKey)}&prettyPrint=false`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://www.youtube.com",
        Referer: "https://www.youtube.com/",
        Cookie: "CONSENT=YES+cb; SOCS=CAI; PREF=hl=en&gl=US",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        context,
        continuation,
        webClientInfo: { isDocumentHidden: false },
      }),
    },
  );

  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

export async function resolvePublicYouTubeLiveVideoId(channelId: string) {
  const cached = videoCache.get(channelId);
  if (cached && cached.expiresAt > Date.now()) return cached.videoId;

  try {
    const { html, finalUrl } = await fetchYouTubeHtml(
      `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/live?hl=en&gl=US`,
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

export async function getYouTubeLiveEmotes(
  videoId: string,
  forceRefresh = false,
) {
  const cached = cache.get(videoId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.emotes;
  }

  const emotes: Record<string, YouTubeEmote> = {};
  const categoryById = new Map<string, YouTubeEmoteCategory>();
  const youtubeUnicodeEmojiIds = new Set<string>();

  // Semeia sempre o conjunto global oficial. A coleta da página da live é
  // apenas um complemento para emotes específicos do canal e aliases novos.
  for (const emote of youtubeGlobalEmotes) {
    emotes[emote.shortcut] = {
      id: emote.id,
      shortcut: emote.shortcut,
      aliases: [emote.shortcut],
      url: emote.url,
      custom: false,
      category: "official",
    };
  }

  const watchUrl =
    `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en&gl=US`;

  let watchInitialData: any = null;
  let watchCfg: Record<string, any> = {};
  try {
    const watch = await fetchYouTubeHtml(watchUrl);
    watchInitialData = initialDataFromHtml(watch.html);
    watchCfg = extractYtcfg(watch.html);

    if (watchInitialData) {
      collectEmojiObjects(watchInitialData, emotes);
      collectPickerCategories(watchInitialData, categoryById, youtubeUnicodeEmojiIds);
    }
  } catch (error) {
    console.warn("[youtube-emotes] watch bootstrap failed; using global fallback", {
      videoId: videoId.slice(0, 6),
      message: error instanceof Error ? error.message : String(error),
    });
  }

  // O /live_chat é a fonte principal do seletor de emotes e também
  // do token de continuação usado pelo cliente web do YouTube.
  let directData: any = null;
  let directCfg: Record<string, any> = {};
  try {
    const direct = await fetchYouTubeHtml(
      `https://www.youtube.com/live_chat?is_popout=1&v=${encodeURIComponent(videoId)}&hl=en&gl=US`,
    );
    directData = initialDataFromHtml(direct.html);
    directCfg = extractYtcfg(direct.html);
    if (directData) {
      collectEmojiObjects(directData, emotes);
      collectPickerCategories(directData, categoryById, youtubeUnicodeEmojiIds);
    }
  } catch {
    // Continua com os dados que vieram da página /watch.
  }

  const continuationSet = new Set<string>();
  if (directData) {
    for (const token of liveChatContinuations(directData)) continuationSet.add(token);
    collectContinuationTokens(directData, continuationSet);
  }
  if (watchInitialData) {
    for (const token of liveChatContinuations(watchInitialData)) continuationSet.add(token);
  }
  const continuations = [...continuationSet];

  // O HTML de live_chat carregado por continuation é o mesmo fluxo usado pelo
  // cliente web do YouTube e traz metadados que não aparecem no Data API.
  for (const continuation of continuations.slice(0, 3)) {
    try {
      const chatPage = await fetchYouTubeHtml(
        `https://www.youtube.com/live_chat?continuation=${encodeURIComponent(continuation)}&hl=en&gl=US`,
      );
      const chatData = initialDataFromHtml(chatPage.html);
      if (chatData) {
        collectEmojiObjects(chatData, emotes);
        collectPickerCategories(chatData, categoryById, youtubeUnicodeEmojiIds);
      }

      const chatCfg = {
        ...watchCfg,
        ...directCfg,
        ...extractYtcfg(chatPage.html),
      };

      const continuationJson = await fetchContinuationJson(
        continuation,
        chatCfg,
      );
      if (continuationJson) {
        collectEmojiObjects(continuationJson, emotes);
        collectPickerCategories(continuationJson, categoryById, youtubeUnicodeEmojiIds);
      }
    } catch {
      // Uma continuação pode ser Top Chat e outra Live Chat. Uma falha não
      // impede que as demais forneçam o catálogo.
    }
  }

  const uniqueEmotes = new Map<string, YouTubeEmote>();
  for (const emote of Object.values(emotes)) {
    const key = emote.id || emote.url;
    if (!uniqueEmotes.has(key)) uniqueEmotes.set(key, emote);
  }

  for (const emote of uniqueEmotes.values()) {
    if (!emote.id) continue;
    const category = categoryById.get(emote.id);
    if (!category) continue;
    emote.category = category;
    emote.custom = category === "channel";
  }

  const count = Object.keys(emotes).length;
  cache.set(videoId, {
    emotes,
    expiresAt: Date.now() + (count ? TTL : EMPTY_TTL),
  });

  console.info("[youtube-emotes] catalog", {
    videoId: videoId.slice(0, 6),
    aliases: count,
    unique: new Set(
      Object.values(emotes).map((emote) => emote.id || emote.url),
    ).size,
    continuations: continuations.length,
    officialIds:
      [...categoryById.values()].filter((value) => value === "official").length +
      youtubeGlobalEmotes.length,
    channelIds: [...categoryById.values()].filter((value) => value === "channel").length,
    unicodeIds: youtubeUnicodeEmojiIds.size,
    classified: [...uniqueEmotes.values()].filter((emote) => Boolean(emote.category)).length,
    unclassified: [...uniqueEmotes.values()].filter((emote) => !emote.category).length,
  });

  return emotes;
}

function inferYouTubePickerCategory(
  emote: YouTubeEmote,
): YouTubeEmoteCategory {
  if (emote.category) return emote.category;

  const id = String(emote.id || "");
  const shortcut = String(emote.shortcut || "").toLowerCase();

  // O conjunto global oficial do YouTube usa o categoryId abaixo no picker
  // web. O payload pode omitir categoryType, mas preservar esse prefixo.
  if (id.startsWith("UCkszU2WH9gy1mb0dV-11UJg/")) return "official";

  // Fallback defensivo para emotes globais atuais/legados do YouTube quando a
  // página anônima traz apenas os objetos emoji e não o emojiPickerRenderer.
  if (
    /^:(?:face|hand|body|eyes|person|cat|goat|trophy|text|glasses|heart|party|people|object)-/.test(shortcut) ||
    /^:(?:yt|buffering|oops|chillwcat|chillwdog|dothefive|elbowbump|elbowcough|goodvibes|hydrate):$/.test(shortcut)
  ) {
    return "official";
  }

  if (!emote.custom) return "official";
  return "channel";
}

export async function getYouTubePickerEmotes(
  videoId: string,
  forceRefresh = false,
) {
  const emotes = await getYouTubeLiveEmotes(videoId, forceRefresh);
  const unique = new Map<string, YouTubeEmote>();

  for (const source of Object.values(emotes)) {
    const key = source.id || source.url;
    if (unique.has(key)) continue;

    const emote = { ...source };
    emote.category = inferYouTubePickerCategory(emote);
    emote.custom = emote.category === "channel";
    unique.set(key, emote);
  }

  console.info("[youtube-emotes] picker", {
    videoId: videoId.slice(0, 6),
    total: unique.size,
    official: [...unique.values()].filter((emote) => emote.category === "official").length,
    channel: [...unique.values()].filter((emote) => emote.category === "channel").length,
    sample: [...unique.values()].slice(0, 5).map((emote) => ({
      id: emote.id?.slice(0, 24),
      shortcut: emote.shortcut,
      category: emote.category,
    })),
  });

  return [...unique.values()];
}
