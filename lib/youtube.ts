export async function getYouTubeLiveChatId() {
  if (process.env.YOUTUBE_LIVE_CHAT_ID) return process.env.YOUTUBE_LIVE_CHAT_ID;
  const videoId = process.env.YOUTUBE_VIDEO_ID;
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!videoId || !apiKey) {
    throw new Error("Configure YOUTUBE_LIVE_CHAT_ID ou YOUTUBE_VIDEO_ID + YOUTUBE_API_KEY.");
  }
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "liveStreamingDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Falha ao consultar live do YouTube.");
  const id = json?.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
  if (!id) throw new Error("O vídeo informado não possui um live chat ativo.");
  return String(id);
}
