import type { ResolvedChannel } from "@/lib/types";

function youtubeApiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY ainda não foi configurada.");
  return key;
}

function normalizeYouTubeInput(input: string) {
  const value = input.trim();
  const match = value.match(/youtube\.com\/(?:@|c\/|user\/|channel\/)?([^/?#]+)/i);
  return (match?.[1] || value).replace(/^@/, "").trim();
}

async function youtubeJson(url: URL) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `YouTube respondeu ${res.status}.`);
  return json;
}

export async function resolveYouTubeChannel(input: string): Promise<ResolvedChannel> {
  const key = youtubeApiKey();
  const value = normalizeYouTubeInput(input);
  if (!value) throw new Error("Informe o username ou @handle do canal do YouTube.");

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
  if (!channel) throw new Error(`Canal do YouTube “${input}” não encontrado.`);

  const live = await findActiveYouTubeLive(String(channel.id));
  return {
    platform: "youtube",
    input,
    channelId: String(channel.id),
    channelName: channel.snippet?.title || value,
    avatar: channel.snippet?.thumbnails?.default?.url || null,
    live: Boolean(live?.liveChatId),
    liveChatId: live?.liveChatId || null,
    videoId: live?.videoId || null,
    subscriptionReady: true,
    note: live?.liveChatId ? "Live encontrada e chat integrado." : "Canal identificado; nenhuma live com chat está ativa agora.",
  };
}

export async function findActiveYouTubeLive(channelId: string) {
  const key = youtubeApiKey();

  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.searchParams.set("part", "contentDetails");
  channelUrl.searchParams.set("id", channelId);
  channelUrl.searchParams.set("key", key);
  const channel = await youtubeJson(channelUrl);
  const uploads = channel?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return null;

  const playlist = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  playlist.searchParams.set("part", "contentDetails");
  playlist.searchParams.set("playlistId", uploads);
  playlist.searchParams.set("maxResults", "25");
  playlist.searchParams.set("key", key);
  const playlistData = await youtubeJson(playlist);
  const ids = (playlistData?.items || []).map((item: any) => item?.contentDetails?.videoId).filter(Boolean);
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
