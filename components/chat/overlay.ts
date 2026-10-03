import { platforms, type ChannelMap } from "./model";

// Only public channel identifiers belong in an OBS browser-source URL.
export function overlayUrl(origin: string, channels: ChannelMap) {
  const url = new URL("/chat", origin);
  url.searchParams.set("overlay", "1");
  for (const platform of platforms) {
    const channel = channels[platform];
    if (!channel?.channelId) continue;
    url.searchParams.set(platform, channel.channelId);
    url.searchParams.set(`${platform}_name`, channel.channelName);
    if (platform === "youtube" && channel.videoId)
      url.searchParams.set("video", channel.videoId);
    if (platform === "youtube" && channel.liveChatId)
      url.searchParams.set("live_chat", channel.liveChatId);
  }
  return url.href;
}

export function overlayChannels(query: URLSearchParams): ChannelMap {
  const channels: ChannelMap = {};
  const value = (key: string) => (query.get(key) || "").slice(0, 256);
  for (const platform of platforms) {
    const channelId = value(platform);
    if (!channelId) continue;
    const channelName = value(`${platform}_name`) || channelId;
    channels[platform] = {
      platform,
      channelId,
      channelName,
      input: channelName,
      ...(platform === "youtube"
        ? { videoId: value("video"), liveChatId: value("live_chat") }
        : {}),
    };
  }
  return channels;
}
