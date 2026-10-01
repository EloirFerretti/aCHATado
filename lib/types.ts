export type Platform = "twitch" | "kick" | "youtube";

export type ChatMessage = {
  id?: number;
  platform: Platform;
  platform_message_id: string;
  channel_id: string | null;
  author_id: string | null;
  author_name: string;
  author_avatar: string | null;
  author_color: string | null;
  message: string;
  message_type: string;
  badges: unknown[];
  created_at: string;
  raw?: unknown;
};

export type PlatformSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userId?: string;
  userName?: string;
  avatar?: string;
  scope?: string[];
};

export type ResolvedChannel = {
  platform: Platform;
  input: string;
  channelId: string;
  channelName: string;
  avatar?: string | null;
  live?: boolean;
  liveChatId?: string | null;
  videoId?: string | null;
  subscriptionReady?: boolean;
  note?: string;
};

export type ChannelFilters = Partial<Record<Platform, string>>;
