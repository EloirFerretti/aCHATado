import type { ResolvedChannel } from "@/lib/types";

function youtubeApiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY ainda não foi configurada.");
  return key;
}

function normalizeYouTubeInput(input: string) {
  const value = input.trim();
  const channelMatch = value.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)/i);
  if (channelMatch?.[1]) return channelMatch[1];
  const match = value.match(/youtube\.com\/(?:@|c\/|user\/)?([^/?#]+)/i);
  return (match?.[1] || value).replace(/^@/, "").trim();
}

export function isYouTubeQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /quota|quotaExceeded|exceeded your quota/i.test(message);
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function resolveYouTubeChannelFromPage(input: string) {
  const value = normalizeYouTubeInput(input);
  if (!value) return null;

  const pageUrl = value.startsWith("UC")
    ? "https://www.youtube.com/channel/" + encodeURIComponent(value)
    : "https://www.youtube.com/@" + encodeURIComponent(value);

  const res = await fetch(pageUrl, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "User-Agent": "Mozilla/5.0 (compatible; aCHATado/1.0; +https://achatado.onrender.com)",
    },
  });
  if (!res.ok) return null;

  const html = await res.text();
  const channelId =
    html.match(/"externalId"\s*:\s*"(UC[A-Za-z0-9_-]+)"/)?.[1] ||
    html.match(/"channelId"\s*:\s*"(UC[A-Za-z0-9_-]+)"/)?.[1] ||
    html.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)/i)?.[1] ||
    (value.startsWith("UC") ? value : "");

  if (!channelId) return null;

  const title =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/"channelMetadataRenderer"\s*:\s*\{[^{}]{0,3000}?"title"\s*:\s*"([^"]+)"/)?.[1] ||
    value;
  const avatar =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    null;

  return {
    channelId: String(channelId),
    channelName: decodeHtml(String(title)),
    avatar: avatar ? decodeHtml(String(avatar)) : null,
  };
}

async function youtubeJson(url: URL) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `YouTube respondeu ${res.status}.`);
  return json;
}

export async function resolveYouTubeChannel(input: string): Promise<ResolvedChannel> {
  const value = normalizeYouTubeInput(input);
  if (!value) throw new Error("Informe o username ou @handle do canal do YouTube.");

  let basic = await resolveYouTubeChannelFromPage(input).catch(() => null);

  if (!basic) {
    const key = youtubeApiKey();
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("key", key);

    if (value.startsWith("UC") && value.length >= 20) {
      url.searchParams.set("id", value);
    } else {
      url.searchParams.set("forHandle", value);
    }

    let json = await youtubeJson(url);
    if (!json?.items?.[0] && !value.startsWith("UC")) {
      url.searchParams.delete("forHandle");
      url.searchParams.set("forUsername", value);
      json = await youtubeJson(url);
    }

    const channel = json?.items?.[0];
    if (!channel) throw new Error("Canal do YouTube não encontrado.");
    basic = {
      channelId: String(channel.id),
      channelName: channel.snippet?.title || value,
      avatar: channel.snippet?.thumbnails?.default?.url || null,
    };
  }

  let live = null;
  let quotaLimited = false;
  try {
    live = await findActiveYouTubeLive(basic.channelId);
  } catch (error) {
    if (isYouTubeQuotaError(error)) quotaLimited = true;
    else throw error;
  }

  return {
    platform: "youtube",
    input,
    channelId: basic.channelId,
    channelName: basic.channelName,
    avatar: basic.avatar,
    live: Boolean(live?.liveChatId),
    liveChatId: live?.liveChatId || null,
    videoId: live?.videoId || null,
    subscriptionReady: true,
    note: live?.liveChatId
      ? "Live encontrada e chat integrado."
      : quotaLimited
        ? "Canal identificado. A cota da API do YouTube está temporariamente esgotada; a integração tentará novamente automaticamente."
        : "Canal identificado; nenhuma live com chat está ativa agora.",
  };
}

async function getLiveDetailsByVideoIds(videoIds: string[], key: string) {
  const ids = [...new Set(videoIds.filter(Boolean))].slice(0, 50);
  if (!ids.length) return null;

  const videos = new URL("https://www.googleapis.com/youtube/v3/videos");
  videos.searchParams.set("part", "liveStreamingDetails,snippet");
  videos.searchParams.set("id", ids.join(","));
  videos.searchParams.set("key", key);
  const details = await youtubeJson(videos);

  for (const video of details?.items || []) {
    const liveChatId = video?.liveStreamingDetails?.activeLiveChatId;
    if (liveChatId) {
      return {
        liveChatId: String(liveChatId),
        videoId: String(video.id),
        title: video?.snippet?.title || "Live",
      };
    }
  }

  return null;
}

function candidateVideoIdsFromHtml(html: string, responseUrl: string) {
  const ids: string[] = [];

  try {
    const finalUrl = new URL(responseUrl);
    if (finalUrl.pathname === "/watch") {
      const id = finalUrl.searchParams.get("v");
      if (id) ids.push(id);
    }
  } catch {
    // URL final inválida; continua procurando no HTML.
  }

  const canonical = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/i,
  );
  if (canonical?.[1]) ids.push(canonical[1]);

  const playerVideoId = html.match(
    /"videoDetails"\s*:\s*\{[^{}]{0,5000}?"videoId"\s*:\s*"([A-Za-z0-9_-]{6,})"/,
  );
  if (playerVideoId?.[1]) ids.push(playerVideoId[1]);

  return [...new Set(ids)];
}

async function findLiveFromChannelPage(channelId: string, key: string) {
  try {
    const res = await fetch(
      `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/live`,
      {
        cache: "no-store",
        redirect: "follow",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent":
            "Mozilla/5.0 (compatible; aCHATado/1.0; +https://achatado.onrender.com)",
        },
      },
    );

    if (!res.ok) return null;
    const html = await res.text();
    const ids = candidateVideoIdsFromHtml(html, res.url);
    return await getLiveDetailsByVideoIds(ids, key);
  } catch {
    return null;
  }
}

export async function findActiveYouTubeLive(channelId: string) {
  const key = youtubeApiKey();

  // A página pública /live representa a live principal que o visitante do canal
  // é direcionado a assistir. Ela tem prioridade sobre a playlist de uploads.
  const publicLive = await findLiveFromChannelPage(channelId, key);
  if (publicLive) return publicLive;

  try {
    const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
    channelUrl.searchParams.set("part", "contentDetails");
    channelUrl.searchParams.set("id", channelId);
    channelUrl.searchParams.set("key", key);
    const channel = await youtubeJson(channelUrl);
    const uploads = channel?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (uploads) {
      const playlist = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      playlist.searchParams.set("part", "contentDetails");
      playlist.searchParams.set("playlistId", uploads);
      playlist.searchParams.set("maxResults", "25");
      playlist.searchParams.set("key", key);
      const playlistData = await youtubeJson(playlist);
      const ids = (playlistData?.items || [])
        .map((item: any) => item?.contentDetails?.videoId)
        .filter(Boolean);

      return await getLiveDetailsByVideoIds(ids, key);
    }
  } catch {
    // Se a API não conseguir ler a playlist, considera que não há live identificável.
  }

  return null;
}

export async function getYouTubeLiveChatId() {
  if (process.env.YOUTUBE_LIVE_CHAT_ID) return process.env.YOUTUBE_LIVE_CHAT_ID;
  const videoId = process.env.YOUTUBE_VIDEO_ID;
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!videoId || !apiKey) {
    throw new Error("Selecione um canal do YouTube ou configure YOUTUBE_LIVE_CHAT_ID/YOUTUBE_VIDEO_ID.");
  }
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "liveStreamingDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);
  const json = await youtubeJson(url);
  const id = json?.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
  if (!id) throw new Error("O vídeo informado não possui um live chat ativo.");
  return String(id);
}
