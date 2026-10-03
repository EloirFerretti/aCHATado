export type Platform = "twitch" | "kick" | "youtube";
export type MessageBadge = {
  set_id?: string;
  setId?: string;
  id?: string;
  info?: string;
  type?: string;
  text?: string;
  count?: number;
  name?: string;
  image_url?: string;
  metadata?: {
    level?: number;
    [key: string]: unknown;
  };
};

export type TwitchBadgeCatalogEntry = {
  setId: string;
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
};

export type KickSubscriberBadge = {
  id: number;
  months: number;
  imageUrl: string;
};

export type Message = {
  id?: number;
  platform: Platform;
  platform_message_id: string;
  channel_id?: string | null;
  author_id?: string | null;
  author_name: string;
  author_avatar?: string | null;
  author_color?: string | null;
  message: string;
  created_at: string;
  badges?: MessageBadge[];
  raw?: any;
};

export type ReplyTarget = {
  platform: "twitch" | "kick";
  messageId: string;
  authorName: string;
  message: string;
  channelId: string | null;
};

export type UserProfileTarget = {
  platform: Platform;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  authorColor: string | null;
  profileUrl: string | null;
};

export type ModerationAction = "ban" | "timeout" | "unban" | "delete_message";
export type ModerationRole = "owner" | "moderator" | "none" | "unknown";
export type FeedFontSize = "small" | "medium" | "large";
export type ChatSettings = {
  compactMode: boolean;
  showPlatformBadges: boolean;
  feedFontSize: FeedFontSize;
  showTimestamps: boolean;
  hideBots: boolean;
  blockLinks: boolean;
  newMessageSound: boolean;
  mentionSound: boolean;
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
export type AuthInfo = Record<
  Platform,
  {
    connected: boolean;
    configured: boolean;
    userId?: string;
    userName?: string;
    avatar?: string;
    moderationReady?: boolean;
    missingModerationScopes?: string[];
  }
>;
export type ChannelInputs = Record<Platform, string>;
export type ChannelMap = Partial<Record<Platform, ResolvedChannel>>;
export type ChannelErrors = Partial<Record<Platform, string>>;
export type EmoteDefinition = {
  code: string;
  url: string;
  provider: "bttv" | "ffz" | "7tv";
  animated?: boolean;
  zeroWidth?: boolean;
};
export type YouTubeEmote = {
  shortcut: string;
  url: string;
  custom: boolean;
};
export type PickerProvider =
  "all" | "twitch" | "kick" | "youtube" | "bttv" | "ffz" | "7tv";
export type PickerCategory =
  | "user"
  | "channel"
  | "official"
  | "kick-emotes"
  | "kick-global"
  | "thirdparty";
export type PickerEmote = {
  id?: string;
  code: string;
  name?: string;
  url?: string;
  provider: Exclude<PickerProvider, "all">;
  category: PickerCategory;
  scope: "global" | "channel" | "user";
  animated?: boolean;
  zeroWidth?: boolean;
  native?: boolean;
  emoteType?: string;
  tier?: string;
  requiresSubscription?: boolean;
  locked?: boolean;
  lockReason?: string;
};

export const platforms: Platform[] = ["twitch", "kick", "youtube"];
export const labels: Record<Platform, string> = {
  twitch: "Twitch",
  kick: "Kick",
  youtube: "YouTube",
};
export const initials: Record<Platform, string> = {
  twitch: "T",
  kick: "K",
  youtube: "Y",
};
export const placeholders: Record<Platform, string> = {
  twitch: "ex.: gaules",
  kick: "ex.: xqc",
  youtube: "ex.: @CazéTV",
};
export const emptyAuth: AuthInfo = {
  twitch: { connected: false, configured: false },
  kick: { connected: false, configured: false },
  youtube: { connected: false, configured: false },
};
export const emptyInputs: ChannelInputs = { twitch: "", kick: "", youtube: "" };
export const defaultChatSettings: ChatSettings = {
  compactMode: false,
  showPlatformBadges: true,
  feedFontSize: "medium",
  showTimestamps: true,
  hideBots: false,
  blockLinks: false,
  newMessageSound: false,
  mentionSound: true,
};
export const CHAT_SETTINGS_STORAGE_KEY = "achatado_chat_settings";

export function normalizeChatSettings(value: unknown): ChatSettings {
  const raw =
    value && typeof value === "object" ? (value as Partial<ChatSettings>) : {};
  const feedFontSize: FeedFontSize =
    raw.feedFontSize === "small" ||
    raw.feedFontSize === "medium" ||
    raw.feedFontSize === "large"
      ? raw.feedFontSize
      : defaultChatSettings.feedFontSize;

  return {
    compactMode:
      typeof raw.compactMode === "boolean"
        ? raw.compactMode
        : defaultChatSettings.compactMode,
    showPlatformBadges:
      typeof raw.showPlatformBadges === "boolean"
        ? raw.showPlatformBadges
        : defaultChatSettings.showPlatformBadges,
    feedFontSize,
    showTimestamps:
      typeof raw.showTimestamps === "boolean"
        ? raw.showTimestamps
        : defaultChatSettings.showTimestamps,
    hideBots:
      typeof raw.hideBots === "boolean"
        ? raw.hideBots
        : defaultChatSettings.hideBots,
    blockLinks:
      typeof raw.blockLinks === "boolean"
        ? raw.blockLinks
        : defaultChatSettings.blockLinks,
    newMessageSound:
      typeof raw.newMessageSound === "boolean"
        ? raw.newMessageSound
        : defaultChatSettings.newMessageSound,
    mentionSound:
      typeof raw.mentionSound === "boolean"
        ? raw.mentionSound
        : defaultChatSettings.mentionSound,
  };
}

export function messageBadgeNames(message: Message) {
  return [
    ...(message.badges || []).map((badge) =>
      String(badge.set_id || badge.setId || badge.type || badge.name || ""),
    ),
    ...(Array.isArray(message.raw?.sender?.identity?.badges)
      ? message.raw.sender.identity.badges.map((badge: any) =>
          String(badge?.type || badge?.name || badge?.text || ""),
        )
      : []),
    ...(Array.isArray(message.raw?.sender?.identity?.badges_v2)
      ? message.raw.sender.identity.badges_v2.map((badge: any) =>
          String(badge?.type || badge?.name || badge?.text || ""),
        )
      : []),
  ]
    .map((name) => name.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
    .filter(Boolean);
}

export const KNOWN_CHAT_BOTS = new Set([
  "nightbot",
  "streamelements",
  "streamlabs",
  "streamlabsbot",
  "moobot",
  "fossabot",
  "sery_bot",
  "serybot",
  "wizebot",
  "botrix",
  "botrixoficial",
  "soundalerts",
  "coebot",
  "phantombot",
  "deepbot",
  "stay_hydrated_bot",
]);

export function normalizedBotAuthorName(message: Message) {
  return String(
    message.raw?.chatter_user_login ||
      message.raw?.chatter_user_name ||
      message.raw?.sender?.username ||
      message.raw?.sender?.slug ||
      message.raw?.authorDetails?.displayName ||
      message.raw?.author_details?.display_name ||
      message.author_name ||
      "",
  )
    .trim()
    .replace(/^@/, "")
    .toLocaleLowerCase();
}

export function isBotMessage(message: Message) {
  const raw = message.raw || {};
  const sender = raw?.sender || {};
  const authorDetails = raw?.authorDetails || raw?.author_details || {};

  if (
    sender?.is_bot === true ||
    sender?.isBot === true ||
    sender?.bot === true ||
    raw?.is_bot === true ||
    raw?.isBot === true ||
    raw?.bot === true ||
    authorDetails?.isBot === true ||
    authorDetails?.is_bot === true ||
    authorDetails?.bot === true
  ) {
    return true;
  }

  const rawType = String(
    raw?.type ||
      raw?.message_type ||
      raw?.messageType ||
      raw?.event_type ||
      raw?.eventType ||
      "",
  )
    .trim()
    .toLocaleLowerCase();

  if (
    ["bot", "chatbot", "automod", "system", "notice"].some(
      (type) => rawType === type || rawType.includes(type),
    )
  ) {
    return true;
  }

  if (
    messageBadgeNames(message).some(
      (name) =>
        name === "bot" ||
        name === "chatbot" ||
        name === "automod" ||
        name.includes("bot-badge") ||
        name.includes("bot_badge"),
    )
  ) {
    return true;
  }

  const authorName = normalizedBotAuthorName(message);
  if (!authorName) return false;

  if (KNOWN_CHAT_BOTS.has(authorName)) return true;
  if (/^botrix(?:[_-].+)?$/.test(authorName)) return true;

  // Nomes explicitamente terminados em "_bot" ou "-bot" são tratados como bots.
  // Evita classificar palavras comuns que apenas terminem com as letras "bot".
  return /(?:^|[_-])bot$/.test(authorName);
}

export const CHAT_LINK_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<]+|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?::\d{2,5})?(?:\/[^\s<]*)?/gi;

export function maskUntrustedLinks(value: string) {
  return value.replace(CHAT_LINK_PATTERN, "[link oculto]");
}

export function trimChatLinkPunctuation(value: string) {
  const match = value.match(/^(.*?)([),.!?;:]+)?$/);
  return {
    link: match?.[1] || value,
    trailing: match?.[2] || "",
  };
}

export function chatLinkHref(value: string) {
  const normalized = value.trim();
  return /^https?:\/\//i.test(normalized)
    ? normalized
    : `https://${normalized}`;
}

export const pickerProviderLabels: Record<PickerProvider, string> = {
  all: "Todos",
  twitch: "Twitch",
  kick: "Kick",
  youtube: "YouTube",
  bttv: "BTTV",
  ffz: "FFZ",
  "7tv": "7TV",
};
export const pickerCategoryLabels: Record<PickerCategory, string> = {
  user: "Seus emotes",
  channel: "Canal",
  official: "Oficiais",
  "kick-emotes": "Emotes",
  "kick-global": "Global",
  thirdparty: "Terceiros",
};

export function kickNativePickerEmotes(payload: unknown): PickerEmote[] {
  if (!Array.isArray(payload)) return [];

  const found = new Map<string, PickerEmote>();

  for (const rawSet of payload) {
    if (!rawSet || typeof rawSet !== "object") continue;

    const set = rawSet as {
      slug?: unknown;
      name?: unknown;
      type?: unknown;
      emotes?: unknown;
    };
    const setLabel = String(set.slug ?? set.name ?? set.type ?? "")
      .trim()
      .toLowerCase();
    const isGlobal = setLabel.startsWith("global");
    const isEmoji = setLabel.startsWith("emoji");

    const list = Array.isArray(set.emotes) ? set.emotes : [];
    for (const rawEmote of list) {
      if (!rawEmote || typeof rawEmote !== "object") continue;
      const emote = rawEmote as {
        id?: unknown;
        name?: unknown;
        subscribers_only?: unknown;
        subscriber_only?: unknown;
        is_subscriber_only?: unknown;
      };

      const id =
        typeof emote.id === "number" || typeof emote.id === "string"
          ? String(emote.id).trim()
          : "";
      const name = typeof emote.name === "string" ? emote.name.trim() : "";
      if (!id || !name) continue;

      const requiresSubscription = Boolean(
        emote.subscribers_only ||
        emote.subscriber_only ||
        emote.is_subscriber_only,
      );

      found.set(`kick:${id}`, {
        id,
        code: name,
        name,
        url: `https://files.kick.com/emotes/${encodeURIComponent(id)}/fullsize`,
        provider: "kick",
        category: isEmoji
          ? "kick-emotes"
          : isGlobal
            ? "kick-global"
            : "channel",
        scope: isGlobal || isEmoji ? "global" : "channel",
        native: true,
        emoteType: requiresSubscription
          ? "subscriber"
          : isEmoji
            ? "emoji"
            : isGlobal
              ? "global"
              : "channel",
        requiresSubscription,
      });
    }
  }

  const categoryOrder: Record<PickerCategory, number> = {
    user: 0,
    channel: 1,
    "kick-emotes": 2,
    "kick-global": 3,
    official: 4,
    thirdparty: 5,
  };

  return [...found.values()].sort(
    (a, b) =>
      categoryOrder[a.category] - categoryOrder[b.category] ||
      (a.name || a.code).localeCompare(b.name || b.code),
  );
}

export function kickMessageWithNativeEmotes(
  value: string,
  emotes: PickerEmote[],
) {
  const byCode = new Map(
    emotes
      .filter(
        (emote) =>
          emote.provider === "kick" &&
          Boolean(emote.native) &&
          Boolean(emote.id) &&
          Boolean(emote.code),
      )
      .map((emote) => [emote.code, String(emote.id)]),
  );

  if (!byCode.size) return value;

  return value
    .split(/(\s+)/)
    .map((part) => {
      const id = byCode.get(part);
      return id ? `[emote:${id}:${part}]` : part;
    })
    .join("");
}

export function timeLabel(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
export function avatarFallback(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export function normalizeAvatarUrl(value: unknown): string | null {
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return null;
    if (raw.startsWith("//")) return `https:${raw}`;
    if (raw.startsWith("/")) return `https://kick.com${raw}`;
    if (/^https?:\/\//i.test(raw)) return raw;
    return null;
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    for (const key of [
      "url",
      "src",
      "profile_pic",
      "profile_picture",
      "profilePic",
      "profilePicture",
      "profileImageUrl",
      "profile_image_url",
      "avatar",
      "avatar_url",
      "thumbnail",
      "thumbnailUrl",
      "thumbnail_url",
    ]) {
      const normalized = normalizeAvatarUrl(candidate[key]);
      if (normalized) return normalized;
    }
  }

  return null;
}

export function kickAvatarFromRaw(raw: any) {
  const sender = raw?.sender || raw?.user || raw?.author || {};
  const candidates = [
    sender?.profile_picture,
    sender?.profile_pic,
    sender?.profile_pic_v2,
    sender?.profilePicV2,
    sender?.profilePicture,
    sender?.profileimage,
    sender?.profile_image,
    sender?.avatar,
    sender?.avatar_url,
    raw?.profile_picture,
    raw?.profile_pic,
    raw?.user?.profile_pic,
    raw?.user?.profile_picture,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeAvatarUrl(candidate);
    if (normalized) return normalized;
  }

  return null;
}

export function messageEmbeddedAvatar(message: Message) {
  const direct = normalizeAvatarUrl(message.author_avatar);
  if (direct) return direct;

  if (message.platform === "kick") {
    return kickAvatarFromRaw(message.raw);
  }

  if (message.platform === "youtube") {
    return (
      normalizeAvatarUrl(message.raw?.authorDetails?.profileImageUrl) ||
      normalizeAvatarUrl(message.raw?.author_details?.profile_image_url) ||
      normalizeAvatarUrl(message.raw?.author?.profileImageUrl) ||
      normalizeAvatarUrl(message.raw?.author?.profile_image_url) ||
      null
    );
  }

  if (message.platform === "twitch") {
    return (
      normalizeAvatarUrl(message.raw?.profile_image_url) ||
      normalizeAvatarUrl(message.raw?.profileImageUrl) ||
      normalizeAvatarUrl(message.raw?.user?.profile_image_url) ||
      normalizeAvatarUrl(message.raw?.user?.profileImageUrl) ||
      null
    );
  }

  return null;
}

export function mergedAuthorAvatar(previous: Message, incoming: Message) {
  return (
    messageEmbeddedAvatar(incoming) || messageEmbeddedAvatar(previous) || null
  );
}

export function mergedMessageRaw(previousRaw: any, incomingRaw: any) {
  if (!previousRaw || typeof previousRaw !== "object") return incomingRaw;
  if (!incomingRaw || typeof incomingRaw !== "object") return previousRaw;

  const merged: any = {
    ...previousRaw,
    ...incomingRaw,
  };

  for (const key of [
    "reply",
    "replies_to",
    "repliesTo",
    "reply_to",
    "replyTo",
  ]) {
    const previousValue = previousRaw?.[key];
    const incomingValue = incomingRaw?.[key];
    if (
      (previousValue && typeof previousValue === "object") ||
      (incomingValue && typeof incomingValue === "object")
    ) {
      merged[key] = {
        ...(previousValue && typeof previousValue === "object"
          ? previousValue
          : {}),
        ...(incomingValue && typeof incomingValue === "object"
          ? incomingValue
          : {}),
      };
    } else if (incomingValue != null || previousValue != null) {
      merged[key] = incomingValue ?? previousValue;
    }
  }

  if (previousRaw?.message || incomingRaw?.message) {
    merged.message = {
      ...(previousRaw?.message && typeof previousRaw.message === "object"
        ? previousRaw.message
        : {}),
      ...(incomingRaw?.message && typeof incomingRaw.message === "object"
        ? incomingRaw.message
        : {}),
    };
  }

  if (previousRaw?.sender || incomingRaw?.sender) {
    const previousSender =
      previousRaw?.sender && typeof previousRaw.sender === "object"
        ? previousRaw.sender
        : {};
    const incomingSender =
      incomingRaw?.sender && typeof incomingRaw.sender === "object"
        ? incomingRaw.sender
        : {};
    merged.sender = {
      ...previousSender,
      ...incomingSender,
    };

    const previousIdentity =
      previousSender?.identity && typeof previousSender.identity === "object"
        ? previousSender.identity
        : {};
    const incomingIdentity =
      incomingSender?.identity && typeof incomingSender.identity === "object"
        ? incomingSender.identity
        : {};

    const previousBadges = Array.isArray(previousIdentity?.badges)
      ? previousIdentity.badges
      : [];
    const incomingBadges = Array.isArray(incomingIdentity?.badges)
      ? incomingIdentity.badges
      : [];
    const previousBadgesV2 = Array.isArray(previousIdentity?.badges_v2)
      ? previousIdentity.badges_v2
      : [];
    const incomingBadgesV2 = Array.isArray(incomingIdentity?.badges_v2)
      ? incomingIdentity.badges_v2
      : [];

    merged.sender.identity = {
      ...previousIdentity,
      ...incomingIdentity,
      badges: incomingBadges.length ? incomingBadges : previousBadges,
      badges_v2: incomingBadgesV2.length ? incomingBadgesV2 : previousBadgesV2,
    };
  }

  return merged;
}

export function cleanReplyPreview(value: unknown) {
  return String(value || "")
    .replace(/\[emote:[^:\]]+:([^\]]+)\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function messageReplyInfo(message: Message): ReplyTarget | null {
  const raw = message.raw || {};

  if (message.platform === "twitch") {
    const reply =
      raw?.reply ||
      raw?.message?.reply ||
      raw?.event?.reply ||
      raw?.data?.reply ||
      null;

    const messageId = String(
      reply?.parent_message_id ||
        reply?.parentMessageId ||
        reply?.message_id ||
        reply?.messageId ||
        raw?.reply_parent_message_id ||
        raw?.replyParentMessageId ||
        "",
    ).trim();

    if (!messageId) return null;

    return {
      platform: "twitch",
      messageId,
      authorName: String(
        reply?.parent_user_name ||
          reply?.parentUserName ||
          reply?.parent_user_login ||
          reply?.parentUserLogin ||
          reply?.user_name ||
          reply?.username ||
          "Usuário da Twitch",
      ),
      message: cleanReplyPreview(
        reply?.parent_message_body ||
          reply?.parentMessageBody ||
          reply?.content ||
          reply?.message ||
          "",
      ),
      channelId: message.channel_id || null,
    };
  }

  if (message.platform === "kick") {
    const reply =
      raw?.replies_to ||
      raw?.repliesTo ||
      raw?.reply_to ||
      raw?.replyTo ||
      raw?.reply ||
      null;

    const messageId = String(
      reply?.message_id ||
        reply?.messageId ||
        reply?.id ||
        raw?.reply_to_message_id ||
        raw?.replyToMessageId ||
        "",
    ).trim();

    if (!messageId) return null;

    const sender = reply?.sender || reply?.user || reply?.author || {};

    return {
      platform: "kick",
      messageId,
      authorName: String(
        sender?.username ||
          sender?.channel_slug ||
          sender?.slug ||
          reply?.username ||
          reply?.author_name ||
          "Usuário da Kick",
      ),
      message: cleanReplyPreview(
        reply?.content || reply?.message || reply?.body || reply?.text || "",
      ),
      channelId: message.channel_id || null,
    };
  }

  return null;
}

export function twitchReplyMentionPattern(message: Message) {
  if (message.platform !== "twitch") return null;

  const reply = messageReplyInfo(message);
  const authorName = String(reply?.authorName || "")
    .trim()
    .replace(/^@/, "");

  if (!authorName || authorName === "Usuário da Twitch") return null;

  const escapedAuthor = authorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*@${escapedAuthor}(?:\\s*[:,.-]?\\s*)?`, "i");
}

export function stripTwitchReplyMention(message: Message, value: string) {
  const pattern = twitchReplyMentionPattern(message);
  return pattern ? value.replace(pattern, "") : value;
}

export function messageDomId(platform: Platform, messageId: string) {
  return `chat-message-${platform}-${messageId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function profileUrl(message: Message) {
  if (message.platform === "twitch") {
    const login =
      message.raw?.chatter_user_login ||
      message.raw?.chatter_user_name ||
      message.author_name;
    const value = String(login || "").trim();
    return value
      ? `https://www.twitch.tv/${encodeURIComponent(value.toLowerCase())}`
      : null;
  }

  if (message.platform === "kick") {
    const username =
      message.raw?.sender?.username ||
      message.raw?.sender?.slug ||
      message.author_name;
    const value = String(username || "").trim();
    const profileSlug = value.replace(/_+$/, "").replace(/_/g, "-");
    return profileSlug
      ? `https://kick.com/${encodeURIComponent(profileSlug)}`
      : null;
  }

  const channelId = message.raw?.authorDetails?.channelId || message.author_id;
  const value = String(channelId || "").trim();
  return value
    ? `https://www.youtube.com/channel/${encodeURIComponent(value)}`
    : null;
}

export function sameProfileAuthor(
  message: Message,
  profile: UserProfileTarget,
) {
  if (message.platform !== profile.platform) return false;

  const messageAuthorId = String(message.author_id || "").trim();
  if (profile.authorId && messageAuthorId) {
    return messageAuthorId === profile.authorId;
  }

  return (
    message.author_name.trim().toLocaleLowerCase() ===
    profile.authorName.trim().toLocaleLowerCase()
  );
}

export function messageModerationRole(
  message: Message,
): "owner" | "moderator" | null {
  if (message.platform === "youtube") {
    const author =
      message.raw?.authorDetails || message.raw?.author_details || {};
    if (author?.isChatOwner || author?.is_chat_owner) return "owner";
    if (author?.isChatModerator || author?.is_chat_moderator)
      return "moderator";
    return null;
  }

  const badgeNames = messageBadgeNames(message);

  if (
    badgeNames.some((name) =>
      ["broadcaster", "owner", "channel_owner", "streamer"].includes(name),
    )
  ) {
    return "owner";
  }
  if (badgeNames.some((name) => ["moderator", "mod"].includes(name))) {
    return "moderator";
  }
  return null;
}
