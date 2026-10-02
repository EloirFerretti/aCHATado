"use client";

import { FormEvent, WheelEvent, useEffect, useMemo, useRef, useState } from "react";

type Platform = "twitch" | "kick" | "youtube";
type MessageBadge = {
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

type TwitchBadgeCatalogEntry = {
  setId: string;
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
};

type KickSubscriberBadge = {
  id: number;
  months: number;
  imageUrl: string;
};

type Message = {
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

type ReplyTarget = {
  platform: "twitch" | "kick";
  messageId: string;
  authorName: string;
  message: string;
  channelId: string | null;
};

type UserProfileTarget = {
  platform: Platform;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  authorColor: string | null;
  profileUrl: string | null;
};
type ResolvedChannel = {
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
type AuthInfo = Record<Platform, { connected: boolean; configured: boolean; userName?: string; avatar?: string }>;
type ChannelInputs = Record<Platform, string>;
type ChannelMap = Partial<Record<Platform, ResolvedChannel>>;
type ChannelErrors = Partial<Record<Platform, string>>;
type EmoteDefinition = {
  code: string;
  url: string;
  provider: "bttv" | "ffz" | "7tv";
  animated?: boolean;
  zeroWidth?: boolean;
};
type YouTubeEmote = {
  shortcut: string;
  url: string;
  custom: boolean;
};
type PickerProvider = "all" | "twitch" | "kick" | "youtube" | "bttv" | "ffz" | "7tv";
type PickerCategory = "user" | "channel" | "official" | "thirdparty";
type PickerEmote = {
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

const platforms: Platform[] = ["twitch", "kick", "youtube"];
const labels: Record<Platform, string> = { twitch: "Twitch", kick: "Kick", youtube: "YouTube" };
const initials: Record<Platform, string> = { twitch: "T", kick: "K", youtube: "Y" };
const placeholders: Record<Platform, string> = {
  twitch: "ex.: gaules",
  kick: "ex.: xqc",
  youtube: "ex.: @CazéTV",
};
const emptyAuth: AuthInfo = {
  twitch: { connected: false, configured: false },
  kick: { connected: false, configured: false },
  youtube: { connected: false, configured: false },
};
const emptyInputs: ChannelInputs = { twitch: "", kick: "", youtube: "" };
const pickerProviderLabels: Record<PickerProvider, string> = {
  all: "Todos",
  twitch: "Twitch",
  kick: "Kick",
  youtube: "YouTube",
  bttv: "BTTV",
  ffz: "FFZ",
  "7tv": "7TV",
};
const pickerCategoryLabels: Record<PickerCategory, string> = {
  user: "Seus emotes",
  channel: "Canal",
  official: "Oficiais",
  thirdparty: "Terceiros",
};

function kickNativePickerEmotes(payload: unknown): PickerEmote[] {
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
    const isGlobal =
      setLabel === "global" ||
      setLabel === "globals" ||
      setLabel.includes("global");
    const isEmoji =
      setLabel === "emoji" ||
      setLabel === "emojis" ||
      setLabel.includes("emoji");

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
        category: isGlobal || isEmoji ? "official" : "channel",
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

  return [...found.values()].sort(
    (a, b) =>
      (a.category === b.category ? 0 : a.category === "official" ? -1 : 1) ||
      (a.name || a.code).localeCompare(b.name || b.code),
  );
}

function kickMessageWithNativeEmotes(
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

function timeLabel(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}
function avatarFallback(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

function cleanReplyPreview(value: unknown) {
  return String(value || "")
    .replace(/\[emote:[^:\]]+:([^\]]+)\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function messageReplyInfo(message: Message): ReplyTarget | null {
  if (message.platform === "twitch") {
    const reply = message.raw?.reply;
    const messageId = String(reply?.parent_message_id || "").trim();
    if (!messageId) return null;
    return {
      platform: "twitch",
      messageId,
      authorName:
        String(
          reply?.parent_user_name ||
            reply?.parent_user_login ||
            "Usuário da Twitch",
        ),
      message: cleanReplyPreview(reply?.parent_message_body),
      channelId: message.channel_id || null,
    };
  }

  if (message.platform === "kick") {
    const reply = message.raw?.replies_to;
    const messageId = String(reply?.message_id || "").trim();
    if (!messageId) return null;
    return {
      platform: "kick",
      messageId,
      authorName: String(
        reply?.sender?.username ||
          reply?.sender?.channel_slug ||
          "Usuário da Kick",
      ),
      message: cleanReplyPreview(reply?.content),
      channelId: message.channel_id || null,
    };
  }

  return null;
}

function messageDomId(platform: Platform, messageId: string) {
  return `chat-message-${platform}-${messageId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function profileUrl(message: Message) {
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
    const profileSlug = value
      .replace(/_+$/, "")
      .replace(/_/g, "-");
    return profileSlug
      ? `https://kick.com/${encodeURIComponent(profileSlug)}`
      : null;
  }

  const channelId =
    message.raw?.authorDetails?.channelId ||
    message.author_id;
  const value = String(channelId || "").trim();
  return value
    ? `https://www.youtube.com/channel/${encodeURIComponent(value)}`
    : null;
}

function sameProfileAuthor(message: Message, profile: UserProfileTarget) {
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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<"all" | Platform>("all");
  const [selected, setSelected] = useState<Platform>("twitch");
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [auth, setAuth] = useState<AuthInfo>(emptyAuth);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [dbProvider, setDbProvider] = useState("demo");
  const [channelInputs, setChannelInputs] = useState<ChannelInputs>(emptyInputs);
  const [channels, setChannels] = useState<ChannelMap>({});
  const [channelErrors, setChannelErrors] = useState<ChannelErrors>({});
  const [thirdPartyEmotes, setThirdPartyEmotes] = useState<Record<string, EmoteDefinition>>({});
  const [youtubeEmotes, setYoutubeEmotes] = useState<Record<string, YouTubeEmote>>({});
  const [twitchBadgeCatalog, setTwitchBadgeCatalog] = useState<Record<string, TwitchBadgeCatalogEntry>>({});
  const [kickSubscriberBadges, setKickSubscriberBadges] = useState<KickSubscriberBadge[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerEmotes, setPickerEmotes] = useState<PickerEmote[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerProvider, setPickerProvider] = useState<PickerProvider>("all");
  const [pickerScopeUpgradeRequired, setPickerScopeUpgradeRequired] = useState(false);
  const [popupMode, setPopupMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState<UserProfileTarget | null>(null);
  const [resolving, setResolving] = useState(false);
  const [ready, setReady] = useState(false);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const [unseenMessageCount, setUnseenMessageCount] = useState(0);
  const lastId = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messageContentRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerMirrorRef = useRef<HTMLDivElement | null>(null);
  const autoResolveAfterAuth = useRef(false);
  const autoScrollPausedRef = useRef(false);
  const autoScrollingRef = useRef(false);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollReleaseRef = useRef<number | null>(null);
  const previousMessageCountRef = useRef(0);

  async function loadAuth() {
    const res = await fetch("/api/auth/status", { cache: "no-store" });
    if (res.ok) setAuth(await res.json());
  }

  function activeParams() {
    const params = new URLSearchParams();
    for (const p of platforms) {
      if (channels[p]?.channelId) params.set(p, channels[p]!.channelId);
    }
    return params;
  }

  async function loadMessages(initial = false) {
    if (!platforms.some((p) => channels[p]?.channelId)) {
      setMessages([]);
      return;
    }
    const after = initial ? 0 : lastId.current;
    const params = activeParams();
    params.set("after", String(after));
    params.set("limit", "120");
    const res = await fetch(`/api/messages?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    setDemo(!json.dbConfigured);
    setDbProvider(json.dbProvider || "demo");
    const incoming: Message[] = json.messages || [];
    if (!incoming.length) return;
    setMessages((prev) => {
      const next = initial ? [...incoming] : [...prev];
      const positions = new Map(
        next.map((message, index) => [
          `${message.platform}:${message.platform_message_id}`,
          index,
        ]),
      );

      for (const message of initial ? prev : incoming) {
        const key = `${message.platform}:${message.platform_message_id}`;
        const index = positions.get(key);

        if (index === undefined) {
          positions.set(key, next.length);
          next.push(message);
          continue;
        }

        const existing = next[index];
        const existingV2 = Array.isArray(
          existing.raw?.sender?.identity?.badges_v2,
        )
          ? existing.raw.sender.identity.badges_v2
          : [];
        const incomingV2 = Array.isArray(
          message.raw?.sender?.identity?.badges_v2,
        )
          ? message.raw.sender.identity.badges_v2
          : [];

        if (incomingV2.length > existingV2.length) {
          next[index] = {
            ...existing,
            ...message,
            id: existing.id ?? message.id,
          };
        }
      }

      next.sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime(),
      );
      return next.slice(-500);
    });
    for (const m of incoming) {
      lastId.current = Math.max(lastId.current, Number(m.id || 0));
    }
  }

  async function resolveChannels() {
    setResolving(true);
    setChannelErrors({});
    setError("");
    try {
      const requested = Object.fromEntries(platforms.map((p) => [p, channelInputs[p].trim()]));
      localStorage.setItem("achatado_channel_inputs", JSON.stringify(requested));

      if (!platforms.some((p) => requested[p])) {
        setChannels({});
        localStorage.removeItem("achatado_channels");
        return;
      }

      const res = await fetch("/api/channels/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: requested }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Não foi possível identificar os canais.");

      const next: ChannelMap = json.channels || {};
      setChannels(next);
      setChannelErrors(json.errors || {});
      localStorage.setItem("achatado_channels", JSON.stringify(next));
      setMessages([]);
      setReplyingTo(null);
      lastId.current = 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao identificar os canais.");
    } finally {
      setResolving(false);
    }
  }

  useEffect(() => {
    try {
      const savedInputs = localStorage.getItem("achatado_channel_inputs");
      const savedChannels = localStorage.getItem("achatado_channels");
      if (savedInputs) setChannelInputs({ ...emptyInputs, ...JSON.parse(savedInputs) });
      if (savedChannels) setChannels(JSON.parse(savedChannels));
    } catch {
      // Ignora dados locais inválidos.
    }

    const query = new URLSearchParams(window.location.search);
    const isPopup = query.get("popup") === "1";
    setPopupMode(isPopup);

    const authError = query.get("auth_error");
    if (authError) setError(authError);
    if (query.get("connected")) autoResolveAfterAuth.current = true;
    if (authError || query.get("connected")) {
      query.delete("auth_error");
      query.delete("connected");
      const cleanQuery = query.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`,
      );
    }

    loadAuth().finally(() => setReady(true));
  }, []);

  useEffect(() => {
    function syncFromStorage(event: StorageEvent) {
      try {
        if (event.key === "achatado_channel_inputs" && event.newValue) {
          setChannelInputs({ ...emptyInputs, ...JSON.parse(event.newValue) });
        }
        if (event.key === "achatado_channels") {
          setChannels(event.newValue ? JSON.parse(event.newValue) : {});
        }
      } catch {
        // Ignora sincronizações inválidas.
      }
    }

    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [settingsOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [profileOpen]);

  const channelKey = platforms
    .map((p) => `${p}:${channels[p]?.channelId || ""}:${channels[p]?.liveChatId || ""}`)
    .join("|");

  useEffect(() => {
    const channelId = channels.twitch?.channelId;
    if (!ready || !channelId) {
      setThirdPartyEmotes({});
      return;
    }

    let cancelled = false;
    fetch(`/api/emotes?channelId=${encodeURIComponent(channelId)}`, { cache: "no-store" })
      .then(async (res) => res.ok ? res.json() : Promise.reject(new Error("Falha ao carregar emotes")))
      .then((json) => {
        if (!cancelled) setThirdPartyEmotes(json.emotes || {});
      })
      .catch(() => {
        if (!cancelled) setThirdPartyEmotes({});
      });

    return () => {
      cancelled = true;
    };
  }, [ready, channels.twitch?.channelId]);

  useEffect(() => {
    const slug = channels.kick?.channelName;
    if (!ready || !slug) {
      setKickSubscriberBadges([]);
      return;
    }

    let cancelled = false;
    fetch(`/api/kick/badges?slug=${encodeURIComponent(slug)}`, {
      cache: "no-store",
    })
      .then(async (res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error("Falha ao carregar badges de inscrito da Kick")),
      )
      .then((json) => {
        if (!cancelled) {
          const badges = Array.isArray(json.badges) ? json.badges : [];
          setKickSubscriberBadges(
            badges
              .map((badge: any) => ({
                id: Number(badge.id || 0),
                months: Number(badge.months || 0),
                imageUrl: String(badge.imageUrl || ""),
              }))
              .filter(
                (badge: KickSubscriberBadge) =>
                  badge.id > 0 && badge.months > 0 && Boolean(badge.imageUrl),
              )
              .sort(
                (a: KickSubscriberBadge, b: KickSubscriberBadge) =>
                  a.months - b.months,
              ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setKickSubscriberBadges([]);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, channels.kick?.channelName]);


  useEffect(() => {
    const videoId = channels.youtube?.videoId;
    if (!ready || !videoId) {
      setYoutubeEmotes({});
      return;
    }

    let cancelled = false;
    let refreshTimer: number | undefined;

    const load = (force = false) => {
      const params = new URLSearchParams({ videoId });
      if (force) params.set("refresh", "1");

      fetch(`/api/youtube/emotes?${params.toString()}`, { cache: "no-store" })
        .then(async (res) =>
          res.ok
            ? res.json()
            : Promise.reject(new Error("Falha ao carregar emotes do YouTube")),
        )
        .then((json) => {
          if (!cancelled) setYoutubeEmotes(json.emotes || {});
        })
        .catch(() => {
          // Mantém o catálogo anterior em falhas transitórias.
        });
    };

    load(false);
    refreshTimer = window.setInterval(() => load(true), 5 * 60_000);

    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
    };
  }, [ready, channels.youtube?.videoId]);

  useEffect(() => {
    const channelId = channels.twitch?.channelId;
    if (!ready || !channelId) {
      setTwitchBadgeCatalog({});
      return;
    }

    let cancelled = false;
    fetch(`/api/twitch/badges?channelId=${encodeURIComponent(channelId)}`, {
      cache: "no-store",
    })
      .then(async (res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error("Falha ao carregar badges da Twitch")),
      )
      .then((json) => {
        if (!cancelled) setTwitchBadgeCatalog(json.badges || {});
      })
      .catch(() => {
        if (!cancelled) setTwitchBadgeCatalog({});
      });

    return () => {
      cancelled = true;
    };
  }, [ready, channels.twitch?.channelId]);


  useEffect(() => {
    if (!ready) return;
    setMessages([]);
    lastId.current = 0;
    previousMessageCountRef.current = 0;
    autoScrollPausedRef.current = false;
    setAutoScrollPaused(false);
    setUnseenMessageCount(0);
    loadMessages(true);

    const events = new EventSource("/api/events");
    events.addEventListener("chat", (event) => {
      try {
        const incoming = JSON.parse((event as MessageEvent).data) as Message;
        const activeChannel = channels[incoming.platform]?.channelId;
        if (!activeChannel || incoming.channel_id !== activeChannel) return;

        setMessages((prev) => {
          const key = `${incoming.platform}:${incoming.platform_message_id}`;
          const index = prev.findIndex(
            (message) =>
              `${message.platform}:${message.platform_message_id}` === key,
          );

          if (index >= 0) {
            const previous = prev[index];
            const previousV2 = Array.isArray(
              previous.raw?.sender?.identity?.badges_v2,
            )
              ? previous.raw.sender.identity.badges_v2
              : [];
            const incomingV2 = Array.isArray(
              incoming.raw?.sender?.identity?.badges_v2,
            )
              ? incoming.raw.sender.identity.badges_v2
              : [];
            const next = [...prev];
            next[index] = {
              ...previous,
              ...incoming,
              id: previous.id ?? incoming.id,
              badges:
                incomingV2.length || (incoming.badges || []).length
                  ? incoming.badges
                  : previous.badges,
              raw:
                previousV2.length && !incomingV2.length
                  ? previous.raw
                  : incoming.raw,
            };
            return next;
          }

          return [...prev, incoming].slice(-500);
        });
      } catch {
        // O reconciliador periódico recupera qualquer evento perdido.
      }
    });

    // Apenas reconciliação de segurança; as mensagens chegam por SSE em tempo real.
    const reconcile = window.setInterval(() => loadMessages(false), 30_000);

    let youtubeTimer: number | undefined;
    let cancelled = false;

    const syncYouTube = async () => {
      const channel = channels.youtube;
      if (cancelled || !channel?.channelId) return;

      let delay = 60_000;
      try {
        const res = await fetch("/api/youtube/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: channel.channelId,
            liveChatId: channel.liveChatId || undefined,
            videoId: channel.videoId || undefined,
          }),
        });
        const json = await res.json().catch(() => null);

        if (json?.mode === "stream") {
          if (json.videoId || json.liveChatId) {
            setChannels((prev) => {
              const current = prev.youtube;
              if (!current) return prev;
              const nextVideoId = json.videoId || current.videoId;
              const nextLiveChatId = json.liveChatId || current.liveChatId;
              if (nextVideoId === current.videoId && nextLiveChatId === current.liveChatId) return prev;
              const next = {
                ...prev,
                youtube: {
                  ...current,
                  videoId: nextVideoId,
                  liveChatId: nextLiveChatId,
                  live: Boolean(nextLiveChatId),
                },
              };
              localStorage.setItem("achatado_channels", JSON.stringify(next));
              return next;
            });
          }

          if (json.quotaExceeded) {
            delay = 30 * 60_000;
          } else if (json.status === "backoff" || json.active === false) {
            // Se o gRPC falhar, usa o endpoint REST já protegido por nextPollAt.
            // Isso evita ficar "silenciosamente conectado" sem receber mensagens.
            const fallback = await fetch("/api/youtube/poll", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                channelId: channel.channelId,
                liveChatId: json.liveChatId || channel.liveChatId || undefined,
                videoId: json.videoId || channel.videoId || undefined,
              }),
            });
            const fallbackJson = await fallback.json().catch(() => null);

            if (fallback.status === 429 || fallbackJson?.quotaExceeded) {
              delay = Math.max(30 * 60_000, Number(fallbackJson?.retryAfterMs || 0));
            } else {
              delay = Math.max(
                json.rateLimited ? 15_000 : 10_000,
                Number(fallbackJson?.retryAfterMs || 0),
              );
            }
          } else {
            delay = 60_000;
          }
        } else {
          const fallback = await fetch("/api/youtube/poll", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channelId: channel.channelId,
              liveChatId: channel.liveChatId || undefined,
              videoId: channel.videoId || undefined,
            }),
          });
          const fallbackJson = await fallback.json().catch(() => null);
          delay = fallback.status === 429 || fallbackJson?.quotaExceeded
            ? Math.max(30 * 60_000, Number(fallbackJson?.retryAfterMs || 0))
            : Math.max(10_000, Number(fallbackJson?.retryAfterMs || 0));
        }
      } catch {
        delay = 15_000;
      }

      if (!cancelled) youtubeTimer = window.setTimeout(syncYouTube, delay);
    };

    syncYouTube();

    return () => {
      cancelled = true;
      events.close();
      clearInterval(reconcile);
      if (youtubeTimer) clearTimeout(youtubeTimer);
    };
  }, [ready, channelKey]);

  useEffect(() => {
    const channel = channels.kick;
    if (!ready || !channel?.channelId || !channel.channelName) return;

    const slug = channel.channelName
      .trim()
      .replace(/^@/, "")
      .replace(/^https?:\/\/(?:www\.)?kick\.com\//i, "")
      .split(/[/?#]/)[0]
      .toLowerCase();
    if (!slug) return;

    const PUSHER_KEY = "32cbd69e4b950bf97679";
    const PUSHER_URL =
      `wss://ws-us2.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let pingTimer: number | undefined;
    let chatroomId: string | null = null;

    const clearSocket = () => {
      if (pingTimer) {
        window.clearInterval(pingTimer);
        pingTimer = undefined;
      }
      if (socket) {
        const current = socket;
        socket = null;
        current.onopen = null;
        current.onmessage = null;
        current.onerror = null;
        current.onclose = null;
        try {
          current.close();
        } catch {
          // noop
        }
      }
    };

    const createdAtIso = (value: unknown) => {
      if (typeof value === "number") {
        const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
        const date = new Date(milliseconds);
        if (!Number.isNaN(date.getTime())) return date.toISOString();
      }
      const date = new Date(String(value || ""));
      return Number.isNaN(date.getTime())
        ? new Date().toISOString()
        : date.toISOString();
    };

    const mergeKickMessage = (incoming: Message) => {
      setMessages((prev) => {
        const key = `${incoming.platform}:${incoming.platform_message_id}`;
        const index = prev.findIndex(
          (message) =>
            `${message.platform}:${message.platform_message_id}` === key,
        );

        if (index >= 0) {
          const next = [...prev];
          const previous = next[index];
          next[index] = {
            ...previous,
            ...incoming,
            id: previous.id ?? incoming.id,
          };
          return next;
        }

        return [...prev, incoming]
          .sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          )
          .slice(-500);
      });
    };

    const kickMessageFromRaw = (raw: any): Message | null => {
      const messageId = String(raw?.id || raw?.message_id || "").trim();
      if (!messageId || !raw?.sender) return null;

      const legacyBadges = Array.isArray(raw.sender?.identity?.badges)
        ? raw.sender.identity.badges
        : [];
      const badgesV2 = Array.isArray(raw.sender?.identity?.badges_v2)
        ? raw.sender.identity.badges_v2.map((badge: any) => ({
            ...badge,
            type: String(badge?.type || badge?.name || "badge"),
            text: String(badge?.text || badge?.name || "Badge"),
          }))
        : [];

      return {
        platform: "kick",
        platform_message_id: messageId,
        channel_id: channel.channelId,
        author_id:
          raw.sender?.id != null
            ? String(raw.sender.id)
            : raw.sender?.user_id != null
              ? String(raw.sender.user_id)
              : null,
        author_name: String(
          raw.sender?.username || raw.sender?.slug || "Kick user",
        ),
        author_avatar:
          raw.sender?.profile_pic ||
          raw.sender?.profile_picture ||
          raw.sender?.profile_image ||
          null,
        author_color:
          raw.sender?.identity?.color ||
          raw.sender?.identity?.username_color ||
          null,
        message: String(raw?.content || "").replace(
          /\[emote:\d+:([^\]]+)\]/g,
          "$1",
        ),
        created_at: createdAtIso(raw?.created_at || raw?.timestamp),
        badges: [...legacyBadges, ...badgesV2],
        raw,
      };
    };

    const loadRecentKickMessages = async () => {
      if (!chatroomId || cancelled) return;
      try {
        const response = await fetch(
          `https://kick.com/api/v2/channels/${encodeURIComponent(chatroomId)}/messages`,
          {
            cache: "no-store",
            credentials: "omit",
          },
        );
        if (!response.ok) return;

        const payload = await response.json();
        const recent = Array.isArray(payload?.data?.messages)
          ? payload.data.messages
          : Array.isArray(payload?.messages)
            ? payload.messages
            : [];

        for (const raw of recent) {
          const incoming = kickMessageFromRaw(raw);
          if (incoming) mergeKickMessage(incoming);
        }
      } catch {
        // Live Pusher remains available even if history is temporarily unavailable.
      }
    };

    const connectSocket = () => {
      if (cancelled || !chatroomId) return;
      clearSocket();

      const ws = new WebSocket(PUSHER_URL);
      socket = ws;

      ws.onopen = () => {
        if (cancelled || socket !== ws) return;
        pingTimer = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: "pusher:ping", data: {} }));
          }
        }, 30_000);
      };

      ws.onmessage = (event) => {
        if (cancelled || socket !== ws || typeof event.data !== "string") return;

        try {
          const frame = JSON.parse(event.data);

          if (frame.event === "pusher:connection_established") {
            ws.send(
              JSON.stringify({
                event: "pusher:subscribe",
                data: {
                  auth: "",
                  channel: `chatrooms.${chatroomId}.v2`,
                },
              }),
            );
            return;
          }

          if (frame.event === "pusher:ping") {
            ws.send(JSON.stringify({ event: "pusher:pong", data: {} }));
            return;
          }

          if (
            frame.event !== "App\\Events\\ChatMessageEvent" &&
            frame.event !== "App\\Events\\ChatMessageSentEvent"
          ) {
            return;
          }

          const raw =
            typeof frame.data === "string"
              ? JSON.parse(frame.data)
              : frame.data;
          const incoming = kickMessageFromRaw(raw);
          if (incoming) mergeKickMessage(incoming);
        } catch {
          // Ignore frames unrelated to chat messages.
        }
      };

      ws.onerror = () => {
        if (socket === ws) {
          try {
            ws.close();
          } catch {
            // noop
          }
        }
      };

      ws.onclose = () => {
        if (cancelled || socket !== ws) return;
        socket = null;
        if (pingTimer) {
          window.clearInterval(pingTimer);
          pingTimer = undefined;
        }
        reconnectTimer = window.setTimeout(connectSocket, 3_000);
      };
    };

    const resolveChatroomAndConnect = async () => {
      const endpoints = [
        `https://kick.com/api/v1/channels/${encodeURIComponent(slug)}`,
        `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            cache: "no-store",
            credentials: "omit",
          });
          if (!response.ok) continue;
          const payload = await response.json();
          const resolved = Number(payload?.chatroom?.id);
          if (Number.isInteger(resolved) && resolved > 0) {
            chatroomId = String(resolved);
            await loadRecentKickMessages();
            connectSocket();
            return;
          }
        } catch {
          // Try the alternate Kick endpoint.
        }
      }

      if (!cancelled) {
        reconnectTimer = window.setTimeout(resolveChatroomAndConnect, 15_000);
      }
    };

    resolveChatroomAndConnect();

    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      clearSocket();
    };
  }, [ready, channels.kick?.channelId, channels.kick?.channelName]);

  useEffect(() => {
    const channel = channels.twitch;
    if (!ready || !channel?.channelId || !auth.twitch.connected || !auth.twitch.configured) return;

    const events = new EventSource(
      `/api/twitch/stream?channelId=${encodeURIComponent(channel.channelId)}`,
    );
    // A conexão abaixo mantém o EventSub da Twitch ativo. As mensagens em si
    // chegam pelo /api/events, sem uma consulta extra ao banco por mensagem.
    events.addEventListener("error", () => undefined);

    return () => events.close();
  }, [ready, channels.twitch?.channelId, auth.twitch.connected, auth.twitch.configured]);

  useEffect(() => {
    if (!ready || !autoResolveAfterAuth.current) return;
    if (!platforms.some((p) => channelInputs[p].trim())) return;
    autoResolveAfterAuth.current = false;
    resolveChannels();
  }, [ready, auth.twitch.connected, auth.kick.connected, auth.youtube.connected]);

  function setAutoScrollState(paused: boolean) {
    autoScrollPausedRef.current = paused;
    setAutoScrollPaused(paused);
    if (!paused) setUnseenMessageCount(0);
  }

  function cancelPendingAutoScroll() {
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    if (autoScrollReleaseRef.current !== null) {
      window.clearTimeout(autoScrollReleaseRef.current);
      autoScrollReleaseRef.current = null;
    }
  }

  function pinToLatest() {
    if (autoScrollPausedRef.current) return;
    const list = messageListRef.current;
    if (!list) return;

    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
    }

    autoScrollFrameRef.current = requestAnimationFrame(() => {
      autoScrollFrameRef.current = null;
      const current = messageListRef.current;
      if (!current || autoScrollPausedRef.current) return;

      autoScrollingRef.current = true;
      current.scrollTop = current.scrollHeight;

      // Um segundo frame cobre mudanças de layout ocorridas no mesmo ciclo
      // (badges, avatars, emotes e quebra de linha da mensagem).
      requestAnimationFrame(() => {
        const latest = messageListRef.current;
        if (latest && !autoScrollPausedRef.current) {
          latest.scrollTop = latest.scrollHeight;
        }
        autoScrollingRef.current = false;
      });
    });
  }

  function scrollToLatest(behavior: ScrollBehavior = "smooth") {
    const list = messageListRef.current;
    if (!list) return;

    cancelPendingAutoScroll();
    autoScrollingRef.current = true;
    setAutoScrollState(false);

    if (behavior === "smooth") {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
      autoScrollReleaseRef.current = window.setTimeout(() => {
        autoScrollReleaseRef.current = null;
        const current = messageListRef.current;
        if (current && !autoScrollPausedRef.current) {
          current.scrollTop = current.scrollHeight;
        }
        autoScrollingRef.current = false;
      }, 550);
      return;
    }

    list.scrollTop = list.scrollHeight;
    requestAnimationFrame(() => {
      const current = messageListRef.current;
      if (current && !autoScrollPausedRef.current) {
        current.scrollTop = current.scrollHeight;
      }
      autoScrollingRef.current = false;
    });
  }

  function handleMessageListScroll() {
    const list = messageListRef.current;
    if (!list || autoScrollingRef.current) return;

    const distanceFromBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight;
    const isNearBottom = distanceFromBottom <= 72;

    if (isNearBottom) {
      if (autoScrollPausedRef.current) setAutoScrollState(false);
      return;
    }

    if (!autoScrollPausedRef.current) {
      setAutoScrollState(true);
    }
  }

  function handleMessageListWheel(event: WheelEvent<HTMLDivElement>) {
    // Pausa antes do primeiro evento de scroll para não haver disputa entre
    // uma nova mensagem e a intenção do usuário de subir no histórico.
    if (event.deltaY < 0 && !autoScrollPausedRef.current) {
      cancelPendingAutoScroll();
      autoScrollingRef.current = false;
      setAutoScrollState(true);
    }
  }

  const visibleMessageCount =
    filter === "all"
      ? messages.length
      : messages.reduce(
          (count, message) => count + (message.platform === filter ? 1 : 0),
          0,
        );

  useEffect(() => {
    const previous = previousMessageCountRef.current;
    const added = Math.max(0, visibleMessageCount - previous);
    previousMessageCountRef.current = visibleMessageCount;

    if (autoScrollPausedRef.current) {
      if (added > 0) {
        setUnseenMessageCount((count) => count + added);
      }
      return;
    }

    pinToLatest();
  }, [visibleMessageCount]);

  useEffect(() => {
    previousMessageCountRef.current = visibleMessageCount;
    if (!autoScrollPausedRef.current) pinToLatest();
  }, [filter]);

  useEffect(() => {
    const content = messageContentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      // Mantém o chat preso ao fim quando imagens, badges ou emotes alteram
      // a altura depois da mensagem já ter sido renderizada.
      if (!autoScrollPausedRef.current) pinToLatest();
    });
    observer.observe(content);

    return () => observer.disconnect();
  }, [ready, channelKey]);

  useEffect(() => {
    return () => cancelPendingAutoScroll();
  }, []);

  const visible = useMemo(
    () => messages.filter((m) => filter === "all" || m.platform === filter),
    [messages, filter],
  );
  const counts = useMemo(() => ({
    twitch: messages.filter((m) => m.platform === "twitch").length,
    kick: messages.filter((m) => m.platform === "kick").length,
    youtube: messages.filter((m) => m.platform === "youtube").length,
  }), [messages]);

  const profileRecentMessages = useMemo(() => {
    if (!profileOpen) return [];
    return messages
      .filter((message) => sameProfileAuthor(message, profileOpen))
      .slice(-10)
      .reverse();
  }, [messages, profileOpen]);

  const activeChannelCount = platforms.filter((p) => channels[p]?.channelId).length;

  function openUserProfile(message: Message) {
    setProfileOpen({
      platform: message.platform,
      authorId: message.author_id ? String(message.author_id) : null,
      authorName: message.author_name,
      authorAvatar: message.author_avatar || null,
      authorColor: message.author_color || null,
      profileUrl: profileUrl(message),
    });
  }

  function beginReply(message: Message) {
    if (message.platform !== "twitch" && message.platform !== "kick") return;

    setSelected(message.platform);
    setReplyingTo({
      platform: message.platform,
      messageId: message.platform_message_id,
      authorName: message.author_name,
      message: cleanReplyPreview(message.message),
      channelId: message.channel_id || null,
    });
    setPickerOpen(false);
    setError("");

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function jumpToMessage(platform: Platform, messageId: string) {
    const target = document.getElementById(messageDomId(platform, messageId));
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("replyTargetFlash");
    requestAnimationFrame(() => {
      target.classList.add("replyTargetFlash");
      window.setTimeout(() => target.classList.remove("replyTargetFlash"), 1400);
    });
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!text.trim()) return;

    const target = channels[selected];
    if (!target?.channelId) {
      setError(`Informe e identifique primeiro o canal da ${labels[selected]}.`);
      return;
    }
    if (!auth[selected]?.configured) {
      setError(`A API da ${labels[selected]} ainda não foi configurada no servidor.`);
      return;
    }
    if (!auth[selected]?.connected) {
      window.location.href = `/api/auth/${selected}/start`;
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selected,
          message:
            selected === "kick"
              ? kickMessageWithNativeEmotes(text, pickerEmotes)
              : text,
          channelId: target.channelId,
          liveChatId: target.liveChatId || undefined,
          replyToMessageId:
            replyingTo?.platform === selected
              ? replyingTo.messageId
              : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Não foi possível enviar a mensagem.");

      if (selected === "youtube" && (json.liveChatId || json.videoId)) {
        setChannels((prev) => {
          const current = prev.youtube;
          if (!current) return prev;
          const next = {
            ...prev,
            youtube: {
              ...current,
              live: true,
              liveChatId: json.liveChatId || current.liveChatId,
              videoId: json.videoId || current.videoId,
            },
          };
          localStorage.setItem("achatado_channels", JSON.stringify(next));
          return next;
        });
      }

      setText("");
      setReplyingTo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }

  async function logout(platform: Platform) {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    });
    await loadAuth();
  }

  function updateChannelInput(platform: Platform, value: string) {
    setChannelInputs((prev) => ({ ...prev, [platform]: value }));
    setChannelErrors((prev) => ({ ...prev, [platform]: undefined }));
    if (channels[platform]?.input !== value) {
      setChannels((prev) => ({ ...prev, [platform]: undefined }));
    }
  }

  function openChatPopup() {
    const width = Math.max(720, Math.min(window.screen.availWidth || 1100, 1200));
    const height = Math.max(600, Math.min(window.screen.availHeight || 820, 900));
    const left = Math.max(0, Math.round(((window.screen.availWidth || width) - width) / 2));
    const top = Math.max(0, Math.round(((window.screen.availHeight || height) - height) / 2));

    const popup = window.open(
      "/chat?popup=1",
      "achatado_chat_popup",
      `popup=yes,resizable=yes,scrollbars=no,width=${width},height=${height},left=${left},top=${top}`,
    );
    popup?.focus();
  }

  const maxLength = selected === "youtube" ? 200 : 500;
  const selectedTarget = channels[selected];

  useEffect(() => {
    let cancelled = false;
    setPickerOpen(false);
    setPickerSearch("");
    setPickerProvider("all");
    setPickerScopeUpgradeRequired(false);

    if (!ready || !selectedTarget?.channelId) {
      setPickerEmotes([]);
      return;
    }

    setPickerLoading(true);

    const loadPickerEmotes = async () => {
      try {
        const params = new URLSearchParams({
          platform: selected,
          channelId: selectedTarget.channelId,
        });
        if (selectedTarget.videoId) params.set("videoId", selectedTarget.videoId);

        const response = await fetch(`/api/emote-picker?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "Falha ao carregar emotes.");
        }

        let emotes: PickerEmote[] = Array.isArray(json.emotes)
          ? json.emotes
          : [];

        if (selected === "kick" && selectedTarget.channelName) {
          const slug = selectedTarget.channelName
            .trim()
            .replace(/^@/, "")
            .toLowerCase();
          const endpoints = [
            `https://kick.com/emotes/${encodeURIComponent(slug)}`,
            `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}/emotes`,
          ];

          for (const endpoint of endpoints) {
            try {
              const kickResponse = await fetch(endpoint, {
                cache: "no-store",
                credentials: "omit",
                headers: { Accept: "application/json" },
              });
              if (!kickResponse.ok) continue;

              const kickPayload = await kickResponse.json();
              const native = kickNativePickerEmotes(kickPayload);
              if (!native.length) continue;

              const unique = new Map<string, PickerEmote>();
              for (const emote of [...native, ...emotes]) {
                const key = `${emote.provider}:${emote.id || emote.code}`;
                if (!unique.has(key)) unique.set(key, emote);
              }
              emotes = [...unique.values()];
              break;
            } catch {
              // Tenta o endpoint alternativo da própria Kick.
            }
          }
        }

        if (cancelled) return;
        setPickerEmotes(emotes);
        setPickerScopeUpgradeRequired(Boolean(json.scopeUpgradeRequired));

        if (
          selected === "youtube" &&
          json.videoId &&
          json.videoId !== channels.youtube?.videoId
        ) {
          setChannels((prev) => {
            const current = prev.youtube;
            if (!current) return prev;
            const next = {
              ...prev,
              youtube: {
                ...current,
                videoId: String(json.videoId),
              },
            };
            localStorage.setItem("achatado_channels", JSON.stringify(next));
            return next;
          });
        }
      } catch {
        if (!cancelled) setPickerEmotes([]);
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    };

    loadPickerEmotes();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    selected,
    selectedTarget?.channelId,
    selectedTarget?.channelName,
    selectedTarget?.videoId,
    auth[selected]?.connected,
  ]);

  const pickerProviders = useMemo(() => {
    const available = new Set(pickerEmotes.map((emote) => emote.provider));
    return (["all", "twitch", "kick", "youtube", "7tv", "bttv", "ffz"] as PickerProvider[])
      .filter((provider) => provider === "all" || available.has(provider as PickerEmote["provider"]));
  }, [pickerEmotes]);

  const filteredPickerEmotes = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    return pickerEmotes.filter((emote) => {
      if (pickerProvider !== "all" && emote.provider !== pickerProvider) return false;
      if (
        query &&
        !emote.code.toLowerCase().includes(query) &&
        !(emote.name || "").toLowerCase().includes(query)
      ) return false;
      return true;
    });
  }, [pickerEmotes, pickerProvider, pickerSearch]);

  const composerRichParts = useMemo(() => {
    const byCode = new Map<string, PickerEmote>();
    for (const emote of pickerEmotes) {
      if (!emote.code || !emote.url) continue;
      if (!byCode.has(emote.code)) byCode.set(emote.code, emote);
    }

    return text.split(/(\s+)/).map((part, index) => {
      const emote = byCode.get(part);
      return emote
        ? { type: "emote" as const, emote, index }
        : { type: "text" as const, text: part, index };
    });
  }, [pickerEmotes, text]);

  const composerHasEmotes = composerRichParts.some(
    (part) => part.type === "emote",
  );

  const youtubeEmotePattern = useMemo(() => {
    const codes = Object.keys(youtubeEmotes)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    if (!codes.length) return null;

    const escaped = codes.map((code) =>
      code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    return new RegExp(`(${escaped.join("|")})`, "g");
  }, [youtubeEmotes]);

  function insertPickerEmote(emote: PickerEmote) {
    const node = textareaRef.current;
    const start = node?.selectionStart ?? text.length;
    const end = node?.selectionEnd ?? start;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
    const needsTrailingSpace = after.length === 0 || !/^\s/.test(after);
    const insertion = `${needsLeadingSpace ? " " : ""}${emote.code}${needsTrailingSpace ? " " : ""}`;
    const next = `${before}${insertion}${after}`.slice(0, maxLength);
    const cursor = Math.min(before.length + insertion.length, next.length);

    setText(next);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  function renderThirdPartyTwitchText(textValue: string, messageId: string, prefix: string) {
    if (!Object.keys(thirdPartyEmotes).length) return textValue;

    return textValue.split(/(\s+)/).map((part, index) => {
      const emote = thirdPartyEmotes[part];
      if (!emote) return part;

      return (
        <img
          className={`chatEmote ${emote.zeroWidth ? "zeroWidth" : ""}`}
          src={emote.url}
          alt={part}
          title={`${part} · ${emote.provider.toUpperCase()}`}
          loading="lazy"
          key={`${messageId}-${prefix}-third-${index}`}
        />
      );
    });
  }

  function renderTwitchMessage(message: Message) {
    const fragments = message.raw?.message?.fragments;
    if (!Array.isArray(fragments) || !fragments.length) {
      return renderThirdPartyTwitchText(message.message, message.platform_message_id, "fallback");
    }

    return fragments.map((fragment: any, index: number) => {
      if (fragment?.type === "emote" && fragment?.emote?.id) {
        const id = encodeURIComponent(String(fragment.emote.id));
        const formats = Array.isArray(fragment.emote.format) ? fragment.emote.format : [];
        const format = formats.includes("animated") ? "animated" : "static";
        const url = `https://static-cdn.jtvnw.net/emoticons/v2/${id}/${format}/dark/2.0`;
        return (
          <img
            className="chatEmote nativeEmote twitchNativeEmote"
            src={url}
            alt={fragment.text || "Twitch emote"}
            title={fragment.text || "Twitch emote"}
            loading="lazy"
            key={`${message.platform_message_id}-tw-native-${index}`}
          />
        );
      }

      if (fragment?.type === "gif" && fragment?.gif?.url) {
        return (
          <img
            className="chatEmote nativeEmote twitchNativeEmote"
            src={String(fragment.gif.url)}
            alt={fragment.text || "Twitch GIF"}
            title={fragment.text || "Twitch GIF"}
            loading="lazy"
            key={`${message.platform_message_id}-tw-gif-${index}`}
          />
        );
      }

      return (
        <span key={`${message.platform_message_id}-tw-text-${index}`}>
          {renderThirdPartyTwitchText(
            String(fragment?.text || ""),
            message.platform_message_id,
            `fragment-${index}`,
          )}
        </span>
      );
    });
  }

  function renderKickMessage(message: Message) {
    const source = typeof message.raw?.content === "string" ? message.raw.content : "";
    if (!source) return message.message;

    const parts: any[] = [];
    const regex = /\[emote:([^:\]]+):([^\]]+)\]/g;
    let cursor = 0;
    let match: RegExpExecArray | null;
    let index = 0;

    while ((match = regex.exec(source)) !== null) {
      if (match.index > cursor) {
        parts.push(source.slice(cursor, match.index));
      }

      const emoteId = encodeURIComponent(match[1]);
      const emoteName = match[2];
      parts.push(
        <img
          className="chatEmote nativeEmote kickNativeEmote"
          src={`https://files.kick.com/emotes/${emoteId}/fullsize`}
          alt={emoteName}
          title={emoteName}
          loading="lazy"
          key={`${message.platform_message_id}-kick-native-${index++}`}
        />,
      );
      cursor = regex.lastIndex;
    }

    if (cursor < source.length) parts.push(source.slice(cursor));
    return parts.length ? parts : message.message;
  }

  function kickSubscriberBadgeForCount(count: number | null) {
    if (!kickSubscriberBadges.length) return null;

    const months = Math.max(1, Number(count || 1));
    let selected = kickSubscriberBadges[0];

    for (const badge of kickSubscriberBadges) {
      if (badge.months <= months) selected = badge;
      else break;
    }

    return selected;
  }

  function kickSubGifterBadgeTier(count: number | null) {
    const total = Math.max(0, Number(count || 0));
    const tiers = [
      5000, 4000, 3000, 2000, 1000, 950, 900, 850, 800, 750, 700, 650,
      600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100, 50, 25, 10,
      5, 1,
    ];
    return tiers.find((tier) => total >= tier) || 1;
  }

  function kickSubGifterBadgeAsset(count: number | null) {
    const tier = kickSubGifterBadgeTier(count);
    return `/badges/kick/sub-gifter-${tier}.svg`;
  }

  function kickBadgeAsset(type: string, count: number | null = null) {
    const normalized = type.toLowerCase().replace(/[^a-z0-9_-]/g, "");

    if (
      normalized === "sub_gifter" ||
      normalized === "subgifter" ||
      normalized === "sub-gifter"
    ) {
      return kickSubGifterBadgeAsset(count);
    }

    const assets: Record<string, string> = {
      broadcaster: "/badges/kick/broadcaster.svg",
      owner: "/badges/kick/broadcaster.svg",
      channel_owner: "/badges/kick/broadcaster.svg",
      host: "/badges/kick/broadcaster.svg",
      streamer: "/badges/kick/broadcaster.svg",
      moderator: "/badges/kick/mod.svg",
      mod: "/badges/kick/mod.svg",
      og: "/badges/kick/ogog.svg",
      ogog: "/badges/kick/ogog.svg",
      vip: "/badges/kick/vip.svg",
      verified: "/badges/kick/verified.svg",
      verificado: "/badges/kick/verified.svg",
      founder: "/badges/kick/founder.svg",
      founding_subscriber: "/badges/kick/founder.svg",
      subscriber: "/badges/kick/subscriber.svg",
      sub: "/badges/kick/subscriber.svg",
      staff: "/badges/kick/staff.svg",
      kick_staff: "/badges/kick/staff.svg",
      bot: "/badges/kick/bot.svg",
      sidekick: "/badges/kick/sidekick.svg",
    };
    return assets[normalized] || null;
  }

  function kickBadgeGlyph(type: string) {
    const normalized = type.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const glyphs: Record<string, string> = {
      level: "LV",
    };
    return glyphs[normalized] || normalized.slice(0, 2).toUpperCase() || "?";
  }

  function kickLevelBadgeNumber(badge: MessageBadge) {
    const badgeName = String(badge.name || badge.type || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    const fromMetadata = Number(badge.metadata?.level);
    const fromCount = Number(badge.count);
    const fromText = String(badge.text || "").match(/(?:level|nível)\s*(\d{1,3})/i);

    const candidate =
      Number.isFinite(fromMetadata) && fromMetadata > 0
        ? fromMetadata
        : badgeName === "level" && Number.isFinite(fromCount) && fromCount > 0
          ? fromCount
          : fromText
            ? Number(fromText[1])
            : NaN;

    if (!Number.isInteger(candidate) || candidate < 1 || candidate > 99) {
      return null;
    }
    return candidate;
  }

  function kickLevelBadgeAsset(level: number | null) {
    return level ? `/badges/kick/level-${level}.svg` : null;
  }

  function kickBadgesForMessage(message: Message) {
    const result: MessageBadge[] = [...(message.badges || [])];
    const seen = new Set(
      result
        .map((badge) =>
          String(badge.name || badge.type || "")
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, ""),
        )
        .filter(Boolean),
    );

    const raw = message.raw;
    const badgesV2 = Array.isArray(raw?.sender?.identity?.badges_v2)
      ? raw.sender.identity.badges_v2
      : [];

    for (const badge of badgesV2) {
      const name = String(badge?.name || "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");
      if (!name || seen.has(name)) continue;

      if (name === "level") {
        const level = Number(badge?.metadata?.level);
        if (Number.isInteger(level) && level >= 1 && level <= 99) {
          result.push({
            type: "level",
            name: "level",
            text: `Level ${level}`,
            count: level,
            metadata: badge?.metadata || { level },
            image_url:
              typeof badge?.image_url === "string" ? badge.image_url : undefined,
          });
          seen.add("level");
        }
        continue;
      }

      result.push({
        type: name,
        name,
        text: String(badge?.text || badge?.name || name),
        metadata: badge?.metadata,
        image_url:
          typeof badge?.image_url === "string" ? badge.image_url : undefined,
      });
      seen.add(name);
    }

    const senderId = raw?.sender?.user_id;
    const broadcasterId = raw?.broadcaster?.user_id;

    if (
      senderId &&
      broadcasterId &&
      String(senderId) === String(broadcasterId) &&
      !seen.has("broadcaster")
    ) {
      result.unshift({ type: "broadcaster", text: "Broadcaster" });
      seen.add("broadcaster");
    }

    if (raw?.sender?.is_verified && !seen.has("verified")) {
      result.push({ type: "verified", text: "Verified" });
    }

    return result;
  }

  function renderUserBadges(message: Message) {
    if (message.platform === "twitch") {
      const badges = (message.badges || [])
        .map((badge) => {
          const setId = String(badge.set_id || badge.setId || "");
          const id = String(badge.id || "");
          if (!setId || !id) return null;
          const resolved = twitchBadgeCatalog[`${setId}:${id}`];
          return resolved ? { badge, resolved, key: `${setId}:${id}` } : null;
        })
        .filter(Boolean) as Array<{
          badge: MessageBadge;
          resolved: TwitchBadgeCatalogEntry;
          key: string;
        }>;

      if (!badges.length) return null;

      return (
        <span className="userBadges twitchBadges" aria-label="Badges da Twitch">
          {badges.map(({ resolved, key }, index) => (
            <img
              className="chatUserBadge twitchUserBadge"
              key={`${key}-${index}`}
              src={resolved.imageUrl}
              alt=""
              title={resolved.title}
              loading="lazy"
            />
          ))}
        </span>
      );
    }

    if (message.platform === "kick") {
      const badges = kickBadgesForMessage(message);
      if (!badges.length) return null;

      return (
        <span className="userBadges kickBadges" aria-label="Badges da Kick">
          {badges.map((badge, index) => {
            const type = String(badge.type || "badge")
              .toLowerCase()
              .replace(/[^a-z0-9_-]/g, "");
            const label = String(badge.text || badge.type || "Badge");
            const count =
              typeof badge.count === "number" && badge.count > 0
                ? badge.count
                : null;

            const level = kickLevelBadgeNumber(badge);
            const subscriberBadge =
              type === "subscriber"
                ? kickSubscriberBadgeForCount(count)
                : null;
            const asset =
              subscriberBadge?.imageUrl ||
              kickLevelBadgeAsset(level) ||
              (typeof badge.image_url === "string" && badge.image_url
                ? badge.image_url
                : null) ||
              kickBadgeAsset(type, count);

            if (asset) {
              return (
                <img
                  className={`chatUserBadge kickUserBadgeImage kickBadge-${type}`}
                  key={`${type}-${index}`}
                  src={asset}
                  alt=""
                  title={
                    subscriberBadge
                      ? `${label} · badge de ${subscriberBadge.months} ${subscriberBadge.months === 1 ? "mês" : "meses"}`
                      : type === "sub_gifter" || type === "subgifter" || type === "sub-gifter"
                        ? `Sub Gifter · ${kickSubGifterBadgeTier(count)}+ sub gifts`
                        : level
                          ? `Nível ${level}`
                          : label
                  }
                  aria-label={
                    subscriberBadge
                      ? `${label}, badge de ${subscriberBadge.months} ${subscriberBadge.months === 1 ? "mês" : "meses"}`
                      : type === "sub_gifter" || type === "subgifter" || type === "sub-gifter"
                        ? `Sub Gifter, ${kickSubGifterBadgeTier(count)} ou mais sub gifts`
                        : level
                          ? `Badge de nível ${level} da Kick`
                          : label
                  }
                  loading="eager"
                />
              );
            }

            return (
              <span
                className={`chatUserBadge kickUserBadge kickBadge-${type}`}
                key={`${type}-${index}`}
                title={count ? `${label} · ${count}` : label}
                aria-label={count ? `${label}, ${count}` : label}
              >
                <b aria-hidden="true">{kickBadgeGlyph(type)}</b>
                {count !== null && <i aria-hidden="true">{count}</i>}
              </span>
            );
          })}
        </span>
      );
    }

    return null;
  }

  function renderYouTubeMessage(message: Message) {
    if (!youtubeEmotePattern) return message.message;

    return message.message.split(youtubeEmotePattern).map((part, index) => {
      const emote = youtubeEmotes[part];
      if (!emote) return part;

      return (
        <img
          className="chatEmote nativeEmote youtubeNativeEmote"
          src={emote.url}
          alt={emote.shortcut || part}
          title={emote.shortcut || part}
          loading="lazy"
          key={`${message.platform_message_id}-yt-native-${index}`}
        />
      );
    });
  }

  function renderMessageText(message: Message) {
    if (message.platform === "twitch") return renderTwitchMessage(message);
    if (message.platform === "kick") return renderKickMessage(message);
    if (message.platform === "youtube") return renderYouTubeMessage(message);
    return message.message;
  }

  function renderSidebarContent() {
    return (
      <>
        <section className="channelSetup sidebarChannels">
                    <div className="channelSetupHead">
                      <div>
                        <strong>Canais que serão mesclados</strong>
                        <span>Digite o username, @handle ou URL. O aCHATado identifica o canal e a live automaticamente.</span>
                      </div>
                    </div>
        
                    <div className="channelGrid">
                      {platforms.map((p) => {
                        const channel = channels[p];
                        const platformError = channelErrors[p];
                        return (
                          <div className={`channelCard ${p}`} key={p}>
                            <div className="channelCardTitle">
                              <span className={`platformIcon ${p}`}>{initials[p]}</span>
                              <strong>{labels[p]}</strong>
                            </div>
                            <input
                              value={channelInputs[p]}
                              onChange={(e) => updateChannelInput(p, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") resolveChannels();
                              }}
                              placeholder={placeholders[p]}
                              aria-label={`Canal da ${labels[p]}`}
                            />
        
                            {channel ? (
                              <div className="channelResolved">
                                <span className={`resolveDot ${channel.subscriptionReady === false ? "warning" : "ok"}`} />
                                <div>
                                  <b>{channel.channelName}</b>
                                  <small>{channel.note || "Canal identificado."}</small>
                                </div>
                              </div>
                            ) : platformError ? (
                              <div className="channelResolved error">
                                <span className="resolveDot bad" />
                                <div>
                                  <b>Não integrado</b>
                                  <small>{platformError}</small>
                                </div>
                              </div>
                            ) : (
                              <div className="channelHint">Nenhum canal selecionado.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
        
                    <button className="mergeButton" onClick={resolveChannels} disabled={resolving}>
                      {resolving ? "Identificando…" : "Identificar e mesclar"}
                    </button>
                  </section>
        
                  <div className="sidebarTitle">EXIBIR MENSAGENS</div>
                  <button
                    className={`filterButton ${filter === "all" ? "active" : ""}`}
                    onClick={() => setFilter("all")}
                  >
                    <span className="allIcon">∞</span><span>Todas</span><b>{messages.length}</b>
                  </button>
        
                  {platforms.map((p) => (
                    <button
                      key={p}
                      className={`filterButton ${filter === p ? "active" : ""}`}
                      onClick={() => setFilter(p)}
                    >
                      <span className={`platformIcon ${p}`}>{initials[p]}</span>
                      <span>{labels[p]}</span>
                      <b>{counts[p]}</b>
                    </button>
                  ))}
        
                  <div className="sidebarTitle accountsTitle">SUAS CONTAS</div>
                  {platforms.map((p) => (
                    <div className="accountRow" key={p}>
                      <span className={`platformIcon ${p}`}>{initials[p]}</span>
                      <div className="accountText">
                        <strong>{labels[p]}</strong>
                        <small>
                          {!auth[p].configured
                            ? "API não configurada"
                            : auth[p].connected
                              ? auth[p].userName || "Conectado"
                              : "Não conectado"}
                        </small>
                      </div>
        
                      {!auth[p].configured ? (
                        <span className="tinyButton disabled">Indisponível</span>
                      ) : auth[p].connected ? (
                        <button className="tinyButton" onClick={() => logout(p)}>Sair</button>
                      ) : (
                        <a className="tinyButton" href={`/api/auth/${p}/start${popupMode ? "?popup=1" : ""}`}>Conectar</a>
                      )}
                    </div>
                  ))}
        
                  <div className="dbStatus">
                    Banco: <b>
                      {dbProvider === "render-postgres"
                        ? "Render PostgreSQL"
                        : dbProvider === "supabase"
                          ? "Supabase"
                          : "demonstração"}
                    </b>
                  </div>
      </>
    );
  }

  return (
    <main className={`shell ${popupMode ? "popupMode" : ""}`}>
      {!popupMode && <header className="topbar">
        <div className="brand">
          <div className="brandMark"><span>T</span><span>K</span><span>Y</span></div>
          <div>
            <h1>aCHATado</h1>
            <p>Twitch + Kick + YouTube em um só chat</p>
          </div>
        </div>
        <div className="livePill">
          <span className="liveDot" />
          {activeChannelCount
            ? `${activeChannelCount} ${activeChannelCount === 1 ? "CANAL" : "CANAIS"}`
            : "CONFIGURAR"}
        </div>
      </header>}

      {!popupMode && demo && (
        <div className="demoBanner">
          <strong>Modo demonstração.</strong> O banco de dados ainda não está configurado.
        </div>
      )}

      <section className="workspace">
        <aside className="sidebar">
          {renderSidebarContent()}
        </aside>

        <section className="chatPanel">
          <div className="chatHeader">
            <div>
              <strong>{filter === "all" ? "Chat unificado" : `Chat da ${labels[filter]}`}</strong>
              <span>{visible.length} mensagens carregadas</span>
            </div>
            <div className="chatHeaderActions">
              <div className="status">
                <span />
                {activeChannelCount ? "sincronizando" : "aguardando canais"}
              </div>
              {popupMode ? (
                <button
                  type="button"
                  className="chatUtilityButton"
                  onClick={() => setSettingsOpen(true)}
                  title="Configurações"
                  aria-label="Abrir configurações do chat"
                >
                  ⚙
                  <span>Configurações</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="chatUtilityButton"
                  onClick={openChatPopup}
                  title="Abrir chat em popup"
                  aria-label="Abrir chat em uma nova janela"
                >
                  ↗
                  <span>Popup</span>
                </button>
              )}
            </div>
          </div>

          {autoScrollPaused && (
            <button
              type="button"
              className="jumpLatestButton"
              onClick={() => scrollToLatest("smooth")}
              aria-label={
                unseenMessageCount
                  ? `Voltar às mensagens mais novas. ${unseenMessageCount} novas mensagens.`
                  : "Voltar às mensagens mais novas."
              }
              title="Voltar às mensagens mais novas"
            >
              <span aria-hidden="true">↓</span>
              <b>Ver mensagens mais novas</b>
              {unseenMessageCount > 0 && (
                <i>{unseenMessageCount > 99 ? "99+" : unseenMessageCount}</i>
              )}
            </button>
          )}

          <div
            className="messageList"
            ref={messageListRef}
            onScroll={handleMessageListScroll}
            onWheel={handleMessageListWheel}
          >
            <div className="messageListContent" ref={messageContentRef}>
            {visible.map((m) => (
              <article
                className="message"
                id={messageDomId(m.platform, m.platform_message_id)}
                key={`${m.platform}-${m.platform_message_id}`}
              >
                <div className={`avatarRing ${m.platform}`}>
                  {profileUrl(m) ? (
                    <a
                      className="avatarProfileLink"
                      href={profileUrl(m)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Abrir perfil de ${m.author_name}`}
                      aria-label={`Abrir perfil de ${m.author_name}`}
                    >
                      {m.author_avatar
                        ? <img src={m.author_avatar} alt="" />
                        : <span>{avatarFallback(m.author_name)}</span>}
                    </a>
                  ) : (
                    m.author_avatar
                      ? <img src={m.author_avatar} alt="" />
                      : <span>{avatarFallback(m.author_name)}</span>
                  )}
                  <span className={`miniPlatform ${m.platform}`}>{initials[m.platform]}</span>
                </div>
                <div className="messageBody">
                  {(() => {
                    const reply = messageReplyInfo(m);
                    if (!reply) return null;
                    const parentLoaded = messages.some(
                      (candidate) =>
                        candidate.platform === reply.platform &&
                        candidate.platform_message_id === reply.messageId,
                    );

                    return (
                      <button
                        type="button"
                        className={`messageReplyContext ${m.platform} ${parentLoaded ? "clickable" : ""}`}
                        onClick={() => {
                          if (parentLoaded) {
                            jumpToMessage(reply.platform, reply.messageId);
                          }
                        }}
                        title={
                          parentLoaded
                            ? "Ir para a mensagem original"
                            : "Mensagem original não está carregada"
                        }
                      >
                        <span aria-hidden="true">↪</span>
                        <span>
                          <b>{reply.authorName}</b>
                          <small>{reply.message || "Mensagem original"}</small>
                        </span>
                      </button>
                    );
                  })()}
                  <div className="meta">
                    {renderUserBadges(m)}
                    <button
                      type="button"
                      className="authorProfileButton"
                      onClick={() => openUserProfile(m)}
                      title={`Ver perfil de ${m.author_name}`}
                      aria-label={`Ver perfil de ${m.author_name}`}
                    >
                      <strong style={m.author_color ? { color: m.author_color } : undefined}>
                        {m.author_name}
                      </strong>
                    </button>
                    <span className={`platformLabel ${m.platform}`}>{labels[m.platform]}</span>
                    <time>{timeLabel(m.created_at)}</time>
                    {(m.platform === "twitch" || m.platform === "kick") && (
                      <button
                        type="button"
                        className="messageReplyAction"
                        onClick={() => beginReply(m)}
                        title={`Responder a ${m.author_name}`}
                        aria-label={`Responder a ${m.author_name}`}
                      >
                        ↩ <span>Responder</span>
                      </button>
                    )}
                  </div>
                  <p className="chatText">{renderMessageText(m)}</p>
                </div>
              </article>
            ))}

            {!activeChannelCount && (
              <div className="emptyState">
                Informe ao menos um canal acima para começar a mesclar os chats.
              </div>
            )}
            {activeChannelCount > 0 && !visible.length && (
              <div className="emptyState">
                Aguardando mensagens dos canais selecionados…
              </div>
            )}
            <div ref={bottomRef} />
            </div>
          </div>

          <form className="composer" onSubmit={send}>
            <div className="sendVia">
              <span>Enviar pela</span>
              <div className="platformSwitch">
                {platforms.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => {
                      setSelected(p);
                      if (replyingTo?.platform !== p) setReplyingTo(null);
                      setPickerOpen(false);
                      setError("");
                    }}
                    className={`${selected === p ? "selected" : ""} ${p}`}
                  >
                    <span>{initials[p]}</span>{labels[p]}
                    <i className={auth[p]?.connected ? "connected" : ""} />
                  </button>
                ))}
              </div>
              {selectedTarget && <span className="sendingTo">→ {selectedTarget.channelName}</span>}
            </div>

            {replyingTo && replyingTo.platform === selected && (
              <div className={`composerReplyPreview ${selected}`}>
                <span aria-hidden="true">↩</span>
                <div>
                  <strong>Respondendo a {replyingTo.authorName}</strong>
                  <small>{replyingTo.message || "Mensagem"}</small>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  aria-label="Cancelar resposta"
                  title="Cancelar resposta"
                >
                  ×
                </button>
              </div>
            )}

            {!selectedTarget ? (
              <div className="connectCallout">
                Selecione o canal da {labels[selected]} acima.
              </div>
            ) : !auth[selected]?.configured ? (
              <div className={`connectCallout ${selected}`}>
                A API da {labels[selected]} precisa ser configurada no servidor.
              </div>
            ) : !auth[selected]?.connected ? (
              <a className={`connectCallout ${selected}`} href={`/api/auth/${selected}/start${popupMode ? "?popup=1" : ""}`}>
                Conectar {labels[selected]} para enviar mensagens como você
              </a>
            ) : (
              <div className="inputRow">
                <div className={`textWrap ${composerHasEmotes ? "hasComposerEmotes" : ""}`}>
                  <button
                    type="button"
                    className={`emotePickerButton ${pickerOpen ? "active" : ""}`}
                    onClick={() => setPickerOpen((value) => !value)}
                    aria-label="Abrir menu de emotes"
                    title="Emotes"
                  >
                    ☺
                  </button>

                  {pickerOpen && (
                    <div className="emotePickerPanel">
                      <div className="emotePickerHeader">
                        <div>
                          <strong>Emotes da {labels[selected]}</strong>
                          <span>
                            {pickerEmotes.filter((emote) => !emote.locked).length} disponíveis
                            {pickerEmotes.some((emote) => emote.locked)
                              ? ` · ${pickerEmotes.filter((emote) => emote.locked).length} bloqueados`
                              : ""}
                          </span>
                        </div>
                        <button type="button" onClick={() => setPickerOpen(false)} aria-label="Fechar emotes">×</button>
                      </div>

                      <input
                        className="emotePickerSearch"
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        placeholder="Pesquisar emote…"
                        autoComplete="off"
                      />

                      <div className="emoteProviderTabs">
                        {pickerProviders.map((provider) => (
                          <button
                            type="button"
                            key={provider}
                            className={pickerProvider === provider ? "active" : ""}
                            onClick={() => setPickerProvider(provider)}
                          >
                            {pickerProviderLabels[provider]}
                          </button>
                        ))}
                      </div>

                      {selected === "twitch" && pickerScopeUpgradeRequired && (
                        <a className="emoteScopeNotice" href={`/api/auth/twitch/start${popupMode ? "?popup=1" : ""}`}>
                          Reconecte a Twitch para incluir emotes da sua conta e assinaturas.
                        </a>
                      )}

                      <div className="emotePickerContent">
                        {pickerLoading ? (
                          <div className="emotePickerEmpty">Carregando emotes…</div>
                        ) : filteredPickerEmotes.length === 0 ? (
                          <div className="emotePickerEmpty">Nenhum emote encontrado.</div>
                        ) : (
                          (["user", "channel", "official", "thirdparty"] as PickerCategory[]).map((category) => {
                            const grouped = filteredPickerEmotes.filter((emote) => emote.category === category);
                            if (!grouped.length) return null;
                            return (
                              <section className="emotePickerGroup" key={category}>
                                <div className="emotePickerGroupTitle">
                                  {category === "official"
                                    ? `Oficiais da ${labels[selected]}`
                                    : pickerCategoryLabels[category]}
                                </div>
                                <div className="emotePickerGrid">
                                  {grouped.map((emote, index) => (
                                    <button
                                      type="button"
                                      className={`emotePickerItem ${emote.locked ? "locked" : ""}`}
                                      key={`${emote.provider}-${emote.id || emote.code}-${index}`}
                                      onClick={() => {
                                        if (!emote.locked) insertPickerEmote(emote);
                                      }}
                                      disabled={Boolean(emote.locked)}
                                      aria-disabled={Boolean(emote.locked)}
                                      title={
                                        emote.locked
                                          ? `${emote.code} · ${emote.lockReason || "Requer assinatura deste canal."}`
                                          : `${emote.name || emote.code} · ${pickerProviderLabels[emote.provider]} · ${pickerCategoryLabels[emote.category]}`
                                      }
                                    >
                                      <span className="emoteImageWrap">
                                        {emote.url ? (
                                          <img src={emote.url} alt={emote.code} loading="lazy" />
                                        ) : null}
                                        {emote.locked && (
                                          <span className="emoteLockBadge" aria-hidden="true">🔒</span>
                                        )}
                                      </span>
                                      <span>{emote.code}</span>
                                      <small>
                                        {emote.locked
                                          ? emote.tier === "3000"
                                            ? "SUB TIER 3"
                                            : emote.tier === "2000"
                                              ? "SUB TIER 2"
                                              : "SUB"
                                          : pickerProviderLabels[emote.provider]}
                                      </small>
                                    </button>
                                  ))}
                                </div>
                              </section>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {composerHasEmotes && (
                    <div
                      ref={composerMirrorRef}
                      className="composerRichMirror"
                      aria-hidden="true"
                    >
                      {composerRichParts.map((part) =>
                        part.type === "emote" ? (
                          <span
                            className="composerRichEmote"
                            key={`emote-${part.emote.provider}-${part.emote.id || part.emote.code}-${part.index}`}
                          >
                            <img
                              src={part.emote.url}
                              alt=""
                              loading="eager"
                            />
                          </span>
                        ) : (
                          <span key={`text-${part.index}`}>{part.text}</span>
                        ),
                      )}
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, maxLength))}
                    onScroll={(e) => {
                      if (composerMirrorRef.current) {
                        composerMirrorRef.current.scrollTop = e.currentTarget.scrollTop;
                        composerMirrorRef.current.scrollLeft = e.currentTarget.scrollLeft;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder={
                      replyingTo?.platform === selected
                        ? `Responder a ${replyingTo.authorName} como ${auth[selected]?.userName || "você"}...`
                        : `Mensagem como ${auth[selected]?.userName || "você"} em ${selectedTarget.channelName}...`
                    }
                    rows={1}
                    maxLength={maxLength}
                    spellCheck={false}
                  />
                  <span className="counter">{[...text].length}/{maxLength}</span>
                </div>
                <button
                  className={`sendButton ${selected}`}
                  disabled={sending || !text.trim()}
                >
                  {sending ? "Enviando…" : "Enviar"}
                </button>
              </div>
            )}

            {error && <div className="errorBox">{error}</div>}
          </form>
        </section>
      </section>

      {profileOpen && (
        <div
          className="userProfileOverlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setProfileOpen(null);
          }}
        >
          <section
            className={`userProfileDialog ${profileOpen.platform}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-profile-title"
          >
            <button
              type="button"
              className="userProfileClose"
              onClick={() => setProfileOpen(null)}
              aria-label="Fechar perfil"
              title="Fechar"
            >
              ×
            </button>

            <div className="userProfileHeader">
              <div className={`userProfileAvatar ${profileOpen.platform}`}>
                {profileOpen.authorAvatar ? (
                  <img src={profileOpen.authorAvatar} alt="" />
                ) : (
                  <span>{avatarFallback(profileOpen.authorName)}</span>
                )}
              </div>
              <div className="userProfileIdentity">
                <span className={`platformLabel ${profileOpen.platform}`}>
                  {labels[profileOpen.platform]}
                </span>
                <div className="userProfileNameRow">
                  {profileRecentMessages[0]
                    ? renderUserBadges(profileRecentMessages[0])
                    : null}
                  <h2
                    id="user-profile-title"
                    style={
                      profileOpen.authorColor
                        ? { color: profileOpen.authorColor }
                        : undefined
                    }
                  >
                    {profileOpen.authorName}
                  </h2>
                </div>
                {profileOpen.profileUrl ? (
                  <a
                    className={`userProfileExternalLink ${profileOpen.platform}`}
                    href={profileOpen.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir perfil na {labels[profileOpen.platform]} ↗
                  </a>
                ) : (
                  <span className="userProfileExternalUnavailable">
                    Link do perfil indisponível
                  </span>
                )}
              </div>
            </div>

            <div className="userProfileMessagesHeader">
              <strong>Últimas mensagens</strong>
              <span>
                {profileRecentMessages.length
                  ? `${profileRecentMessages.length} carregadas`
                  : "Nenhuma mensagem carregada"}
              </span>
            </div>

            <div className="userProfileMessages">
              {profileRecentMessages.length ? (
                profileRecentMessages.map((message) => (
                  <button
                    type="button"
                    className="userProfileMessage"
                    key={`${message.platform}-${message.platform_message_id}`}
                    onClick={() => {
                      setProfileOpen(null);
                      requestAnimationFrame(() =>
                        jumpToMessage(
                          message.platform,
                          message.platform_message_id,
                        ),
                      );
                    }}
                    title="Ir para esta mensagem no chat"
                  >
                    <time>{timeLabel(message.created_at)}</time>
                    <span>{cleanReplyPreview(message.message) || "Mensagem"}</span>
                  </button>
                ))
              ) : (
                <div className="userProfileEmpty">
                  Nenhuma mensagem recente deste usuário está carregada.
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {popupMode && settingsOpen && (
        <div
          className="popupSettingsOverlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            className="popupSettingsDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="popup-settings-title"
          >
            <div className="popupSettingsHeader">
              <div>
                <strong id="popup-settings-title">Configurações do chat</strong>
                <span>Canais, filtros e contas conectadas</span>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Fechar configurações"
              >
                ×
              </button>
            </div>
            <div className="popupSettingsBody">
              {renderSidebarContent()}
            </div>
          </section>
        </div>
      )}

      {!popupMode && <footer className="siteFooter">
        <span>aCHATado</span>
        <nav aria-label="Links legais">
          <a href="/privacy">Política de Privacidade</a>
          <a href="/terms">Termos de Serviço</a>
        </nav>
      </footer>}
    </main>
  );
}
