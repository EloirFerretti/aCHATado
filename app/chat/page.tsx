"use client";

import {
  FormEvent,
  PointerEvent,
  WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Platform,
  MessageBadge,
  TwitchBadgeCatalogEntry,
  KickSubscriberBadge,
  Message,
  ReplyTarget,
  UserProfileTarget,
  ModerationAction,
  ModerationRole,
  FeedFontSize,
  ChatSettings,
  ResolvedChannel,
  AuthInfo,
  ChannelInputs,
  ChannelMap,
  ChannelErrors,
  EmoteDefinition,
  YouTubeEmote,
  PickerProvider,
  PickerEmote,
  platforms,
  labels,
  emptyAuth,
  emptyInputs,
  defaultChatSettings,
  CHAT_SETTINGS_STORAGE_KEY,
  normalizeChatSettings,
  isBotMessage,
  CHAT_LINK_PATTERN,
  maskUntrustedLinks,
  trimChatLinkPunctuation,
  chatLinkHref,
  kickNativePickerEmotes,
  kickMessageWithNativeEmotes,
  timeLabel,
  avatarFallback,
  kickAvatarFromRaw,
  messageEmbeddedAvatar,
  mergedAuthorAvatar,
  mergedMessageRaw,
  cleanReplyPreview,
  messageReplyInfo,
  twitchReplyMentionPattern,
  stripTwitchReplyMention,
  messageDomId,
  profileUrl,
  sameProfileAuthor,
  messageModerationRole,
} from "@/components/chat/model";
import { Icon, PlatformIcon } from "@/components/chat/icons";
import { ChannelSidebar } from "@/components/chat/channel-sidebar";
import { SettingsDialog } from "@/components/chat/settings-dialog";
import { MessageCard } from "@/components/chat/message-card";
import { EmotePicker } from "@/components/chat/emote-picker";
import { Dialog } from "@/components/chat/dialog";
import { YouTubeBadges } from "@/components/chat/youtube-badges";
import { overlayUrl, overlayChannels } from "@/components/chat/overlay";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<"all" | Platform>("all");
  const [selected, setSelected] = useState<Platform>("twitch");
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [auth, setAuth] = useState<AuthInfo>(emptyAuth);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [mentionsOpen, setMentionsOpen] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [readMentionKeys, setReadMentionKeys] = useState<string[]>([]);
  const [mutedProfiles, setMutedProfiles] = useState<UserProfileTarget[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
  const [channelInputs, setChannelInputs] =
    useState<ChannelInputs>(emptyInputs);
  const [channels, setChannels] = useState<ChannelMap>({});
  const [channelErrors, setChannelErrors] = useState<ChannelErrors>({});
  const [thirdPartyEmotes, setThirdPartyEmotes] = useState<
    Record<string, EmoteDefinition>
  >({});
  const [youtubeEmotes, setYoutubeEmotes] = useState<
    Record<string, YouTubeEmote>
  >({});
  const [twitchBadgeCatalog, setTwitchBadgeCatalog] = useState<
    Record<string, TwitchBadgeCatalogEntry>
  >({});
  const [kickSubscriberBadges, setKickSubscriberBadges] = useState<
    KickSubscriberBadge[]
  >([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerEmotes, setPickerEmotes] = useState<PickerEmote[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerScopeUpgradeRequired, setPickerScopeUpgradeRequired] =
    useState(false);
  const [popupMode, setPopupMode] = useState(false);
  const [overlayMode, setOverlayMode] = useState(false);
  const [overlayLink, setOverlayLink] = useState("");
  const [overlayCopied, setOverlayCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatSettings, setChatSettings] =
    useState<ChatSettings>(defaultChatSettings);
  const [settingsDraft, setSettingsDraft] =
    useState<ChatSettings>(defaultChatSettings);
  const [profileOpen, setProfileOpen] = useState<UserProfileTarget | null>(
    null,
  );
  const [profilePosition, setProfilePosition] = useState({ x: 0, y: 0 });
  const [profileDragging, setProfileDragging] = useState(false);
  const [emotePreview, setEmotePreview] = useState<{
    code: string;
    url: string;
    provider: string;
    left: number;
    top: number;
  } | null>(null);
  const [moderationBusy, setModerationBusy] = useState("");
  const [moderationRoles, setModerationRoles] = useState<
    Partial<Record<Platform, ModerationRole>>
  >({});
  const [moderationFeedback, setModerationFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [resolvingPlatform, setResolvingPlatform] = useState<Platform | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const [unseenMessageCount, setUnseenMessageCount] = useState(0);
  const [brokenAvatarUrls, setBrokenAvatarUrls] = useState<
    Record<string, true>
  >({});
  const lastId = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messageContentRef = useRef<HTMLDivElement | null>(null);
  const composerEditorRef = useRef<HTMLDivElement | null>(null);
  const profileDialogRef = useRef<HTMLElement | null>(null);
  const profileDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const autoResolveAfterAuth = useRef<Platform | null>(null);
  const autoScrollPausedRef = useRef(false);
  const autoScrollingRef = useRef(false);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollReleaseRef = useRef<number | null>(null);
  const previousMessageCountRef = useRef(0);
  const soundInitializedRef = useRef(false);
  const lastSoundMessageKeyRef = useRef("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const avatarLookupAttemptedRef = useRef<Map<string, number>>(new Map());
  const clickedComposerEmotesRef = useRef<
    Record<Platform, Map<string, PickerEmote>>
  >({
    twitch: new Map(),
    kick: new Map(),
    youtube: new Map(),
  });

  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMentionsOpen(false);
        setCommandsOpen(false);
        setPickerOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  async function loadAuth() {
    const res = await fetch("/api/auth/status", { cache: "no-store" });
    if (res.ok) setAuth(await res.json());
  }

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    const verify = async (platform: Platform) => {
      const channelId = channels[platform]?.channelId;
      if (!channelId || !auth[platform]?.connected) {
        if (!cancelled) {
          setModerationRoles((previous) => ({
            ...previous,
            [platform]: "none",
          }));
        }
        return;
      }

      try {
        const response = await fetch("/api/moderation/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, channelId }),
          cache: "no-store",
        });
        const json = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) {
          setModerationRoles((previous) => ({
            ...previous,
            [platform]:
              json.role === "owner" ||
              json.role === "moderator" ||
              json.role === "none"
                ? json.role
                : "unknown",
          }));
        }
      } catch {
        if (!cancelled) {
          setModerationRoles((previous) => ({
            ...previous,
            [platform]: "unknown",
          }));
        }
      }
    };

    platforms.forEach((platform) => void verify(platform));

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    channels.twitch?.channelId,
    channels.kick?.channelId,
    channels.youtube?.channelId,
    auth.twitch.connected,
    auth.kick.connected,
    auth.youtube.connected,
    auth.twitch.userId,
    auth.kick.userId,
    auth.youtube.userId,
  ]);

  const effectiveModerationRoles = useMemo(() => {
    const result: Partial<Record<Platform, ModerationRole>> = {
      ...moderationRoles,
    };

    for (const platform of platforms) {
      const userId = String(auth[platform]?.userId || "").trim();
      const channelId = String(channels[platform]?.channelId || "").trim();

      if (userId && channelId && userId === channelId) {
        result[platform] = "owner";
        continue;
      }

      if (!userId) continue;

      const ownMessages = messages.filter(
        (message) =>
          message.platform === platform &&
          String(message.author_id || "").trim() === userId,
      );

      for (const message of ownMessages) {
        const role = messageModerationRole(message);
        if (role === "owner") {
          result[platform] = "owner";
          break;
        }
        if (role === "moderator") {
          result[platform] = "moderator";
        }
      }
    }

    return result;
  }, [moderationRoles, auth, channels, messages]);

  function canModerate(platform: Platform) {
    return (
      effectiveModerationRoles[platform] === "owner" ||
      effectiveModerationRoles[platform] === "moderator"
    );
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
    const res = await fetch(`/api/messages?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const json = await res.json();
    setHistoryUnavailable(!json.dbConfigured);
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
        const incomingV2 = Array.isArray(
          message.raw?.sender?.identity?.badges_v2,
        )
          ? message.raw.sender.identity.badges_v2
          : [];

        next[index] = {
          ...existing,
          ...message,
          id: existing.id ?? message.id,
          author_avatar: mergedAuthorAvatar(existing, message),
          badges:
            incomingV2.length || (message.badges || []).length
              ? message.badges
              : existing.badges,
          raw: mergedMessageRaw(existing.raw, message.raw),
        };
      }

      next.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      return next.slice(-500);
    });
    for (const m of incoming) {
      lastId.current = Math.max(lastId.current, Number(m.id || 0));
    }
  }

  async function resolveChannel(platform: Platform) {
    const input = channelInputs[platform].trim();
    if (!input || resolvingPlatform) return;

    setResolvingPlatform(platform);
    setChannelErrors((previous) => ({ ...previous, [platform]: undefined }));
    setError("");

    const requested = {
      ...channelInputs,
      [platform]: input,
    };
    localStorage.setItem("achatado_channel_inputs", JSON.stringify(requested));

    try {
      const res = await fetch("/api/channels/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: { [platform]: input },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error ||
            `Não foi possível identificar o canal da ${labels[platform]}.`,
        );
      }

      const resolved = json.channels?.[platform] as ResolvedChannel | undefined;
      const platformError = json.errors?.[platform] as string | undefined;

      if (platformError || !resolved) {
        setChannelErrors((previous) => ({
          ...previous,
          [platform]:
            platformError ||
            `Não foi possível identificar o canal da ${labels[platform]}.`,
        }));
        return;
      }

      setChannels((previous) => {
        const next = {
          ...previous,
          [platform]: resolved,
        };
        localStorage.setItem("achatado_channels", JSON.stringify(next));
        return next;
      });

      setChannelErrors((previous) => ({
        ...previous,
        [platform]: undefined,
      }));
      setReplyingTo((current) =>
        current?.platform === platform ? null : current,
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Falha ao identificar o canal da ${labels[platform]}.`;
      setChannelErrors((previous) => ({
        ...previous,
        [platform]: message,
      }));
    } finally {
      setResolvingPlatform(null);
    }
  }

  useEffect(() => {
    try {
      const savedInputs = localStorage.getItem("achatado_channel_inputs");
      const savedChannels = localStorage.getItem("achatado_channels");
      if (savedInputs)
        setChannelInputs({ ...emptyInputs, ...JSON.parse(savedInputs) });
      if (savedChannels) setChannels(JSON.parse(savedChannels));
    } catch {
      // Ignora dados locais inválidos.
    }

    const query = new URLSearchParams(window.location.search);
    if (query.get("overlay") === "1") {
      setOverlayMode(true);
      setPopupMode(true);
      setChannels(overlayChannels(query));
      setReady(true);
      return;
    }
    const isPopup = query.get("popup") === "1";
    setPopupMode(isPopup);

    const authError = query.get("auth_error");
    if (authError) setError(authError);
    const connectedPlatform = query.get("connected");
    if (
      connectedPlatform === "twitch" ||
      connectedPlatform === "kick" ||
      connectedPlatform === "youtube"
    ) {
      autoResolveAfterAuth.current = connectedPlatform;
    }
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
    try {
      const saved = localStorage.getItem(CHAT_SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = normalizeChatSettings(JSON.parse(saved));
        setChatSettings(parsed);
        setSettingsDraft(parsed);
      }
    } catch {
      // Mantém as configurações padrão se o armazenamento estiver inválido.
    }
  }, []);

  useEffect(() => {
    function syncFromStorage(event: StorageEvent) {
      if (new URLSearchParams(window.location.search).get("overlay") === "1")
        return;
      try {
        if (event.key === "achatado_channel_inputs" && event.newValue) {
          setChannelInputs({ ...emptyInputs, ...JSON.parse(event.newValue) });
        }
        if (event.key === "achatado_channels") {
          setChannels(event.newValue ? JSON.parse(event.newValue) : {});
        }
        if (event.key === CHAT_SETTINGS_STORAGE_KEY) {
          const next = event.newValue
            ? normalizeChatSettings(JSON.parse(event.newValue))
            : defaultChatSettings;
          setChatSettings(next);
          setSettingsDraft(next);
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
      if (event.key === "Escape") {
        setSettingsDraft(chatSettings);
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [settingsOpen, chatSettings]);

  useEffect(() => {
    if (!profileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = profileDialogRef.current;
    const items = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href]",
        ) || [],
      ).filter((element) => element.getClientRects().length);
    items()[0]?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(null);
      if (event.key === "Tab") {
        const controls = items();
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      previous?.focus();
    };
  }, [profileOpen]);

  const channelKey = platforms
    .map(
      (p) =>
        `${p}:${channels[p]?.channelId || ""}:${channels[p]?.liveChatId || ""}`,
    )
    .join("|");

  useEffect(() => {
    const channelId = channels.twitch?.channelId;
    if (!ready || !channelId) {
      setThirdPartyEmotes({});
      return;
    }

    let cancelled = false;
    fetch(`/api/emotes?channelId=${encodeURIComponent(channelId)}`, {
      cache: "no-store",
    })
      .then(async (res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error("Falha ao carregar emotes")),
      )
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
          : Promise.reject(
              new Error("Falha ao carregar badges de inscrito da Kick"),
            ),
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
    const refreshTimer = window.setInterval(() => load(true), 5 * 60_000);

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
              author_avatar: mergedAuthorAvatar(previous, incoming),
              badges:
                incomingV2.length || (incoming.badges || []).length
                  ? incoming.badges
                  : previous.badges,
              raw: mergedMessageRaw(previous.raw, incoming.raw),
            };
            return next;
          }

          return [...prev, incoming].slice(-500);
        });
      } catch {
        // O reconciliador periódico recupera qualquer evento perdido.
      }
    });

    events.addEventListener("chat-delete", (event) => {
      try {
        const deleted = JSON.parse((event as MessageEvent).data) as {
          platform: Platform;
          platform_message_id: string;
        };
        setMessages((previous) =>
          previous.filter(
            (message) =>
              !(
                message.platform === deleted.platform &&
                message.platform_message_id === deleted.platform_message_id
              ),
          ),
        );
      } catch {
        // Ignora eventos de exclusão inválidos.
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
              if (
                nextVideoId === current.videoId &&
                nextLiveChatId === current.liveChatId
              )
                return prev;
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
              delay = Math.max(
                30 * 60_000,
                Number(fallbackJson?.retryAfterMs || 0),
              );
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
          delay =
            fallback.status === 429 || fallbackJson?.quotaExceeded
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
    const PUSHER_URL = `wss://ws-us2.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;

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
            author_avatar: mergedAuthorAvatar(previous, incoming),
            raw: mergedMessageRaw(previous.raw, incoming.raw),
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
        author_avatar: kickAvatarFromRaw(raw),
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
        if (cancelled || socket !== ws || typeof event.data !== "string")
          return;

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
    if (
      !ready ||
      !channel?.channelId ||
      !auth.twitch.connected ||
      !auth.twitch.configured
    )
      return;

    const events = new EventSource(
      `/api/twitch/stream?channelId=${encodeURIComponent(channel.channelId)}`,
    );
    // A conexão abaixo mantém o EventSub da Twitch ativo. As mensagens em si
    // chegam pelo /api/events, sem uma consulta extra ao banco por mensagem.
    events.addEventListener("error", () => undefined);

    return () => events.close();
  }, [
    ready,
    channels.twitch?.channelId,
    auth.twitch.connected,
    auth.twitch.configured,
  ]);

  useEffect(() => {
    if (!ready || !autoResolveAfterAuth.current) return;
    const platform = autoResolveAfterAuth.current;
    if (!channelInputs[platform].trim()) {
      autoResolveAfterAuth.current = null;
      return;
    }
    autoResolveAfterAuth.current = null;
    resolveChannel(platform);
  }, [
    ready,
    auth.twitch.connected,
    auth.kick.connected,
    auth.youtube.connected,
  ]);

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

  function clearChat() {
    setMessages([]);
    setPinnedMessage(null);
    setReplyingTo(null);
    setProfileOpen(null);
    setUnseenMessageCount(0);
    previousMessageCountRef.current = 0;
    autoScrollPausedRef.current = false;
    setAutoScrollPaused(false);
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

  const visibleMessageCount = messages.reduce((count, message) => {
    if (filter !== "all" && message.platform !== filter) return count;
    if (chatSettings.hideBots && isBotMessage(message)) return count;
    if (mutedProfiles.some((profile) => sameProfileAuthor(message, profile)))
      return count;
    return count + 1;
  }, 0);

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
    () =>
      messages.filter(
        (message) =>
          (filter === "all" || message.platform === filter) &&
          !mutedProfiles.some((profile) =>
            sameProfileAuthor(message, profile),
          ) &&
          (!chatSettings.hideBots || !isBotMessage(message)),
      ),
    [messages, filter, chatSettings.hideBots, mutedProfiles],
  );

  useEffect(() => {
    if (!ready || !messages.length) return;

    const latest = messages[messages.length - 1];
    const key = `${latest.platform}:${latest.platform_message_id}`;

    if (!soundInitializedRef.current) {
      soundInitializedRef.current = true;
      lastSoundMessageKeyRef.current = key;
      return;
    }
    if (lastSoundMessageKeyRef.current === key) return;
    lastSoundMessageKeyRef.current = key;

    if (chatSettings.hideBots && isBotMessage(latest)) return;
    if (mutedProfiles.some((profile) => sameProfileAuthor(latest, profile)))
      return;

    const mentioned =
      chatSettings.mentionSound && messageMentionsConnectedAccount(latest);
    if (mentioned) {
      playNotificationTone("mention");
    } else if (chatSettings.newMessageSound) {
      playNotificationTone("message");
    }
  }, [
    messages,
    ready,
    chatSettings.hideBots,
    chatSettings.newMessageSound,
    chatSettings.mentionSound,
    auth.twitch.userName,
    auth.kick.userName,
    auth.youtube.userName,
    mutedProfiles,
  ]);

  const knownAuthorAvatars = useMemo(() => {
    const known = new Map<string, string>();

    for (const message of messages) {
      const avatar = messageEmbeddedAvatar(message);
      if (!avatar || brokenAvatarUrls[avatar]) continue;

      const id = String(message.author_id || "").trim();
      if (id) known.set(`${message.platform}:id:${id}`, avatar);

      const name = message.author_name.trim().toLocaleLowerCase();
      if (name) known.set(`${message.platform}:name:${name}`, avatar);
    }

    return known;
  }, [messages, brokenAvatarUrls]);

  function messageAvatarUrl(message: Message) {
    const direct = messageEmbeddedAvatar(message);
    if (direct && !brokenAvatarUrls[direct]) return direct;

    const id = String(message.author_id || "").trim();
    if (id) {
      const byId = knownAuthorAvatars.get(`${message.platform}:id:${id}`);
      if (byId && !brokenAvatarUrls[byId]) return byId;
    }

    const name = message.author_name.trim().toLocaleLowerCase();
    if (name) {
      const byName = knownAuthorAvatars.get(`${message.platform}:name:${name}`);
      if (byName && !brokenAvatarUrls[byName]) return byName;
    }

    return null;
  }

  function markAvatarBroken(_message: Message | null, url: string) {
    if (!url) return;
    setBrokenAvatarUrls((previous) =>
      previous[url] ? previous : { ...previous, [url]: true },
    );
  }


  useEffect(() => {
    if (!ready || !messages.length) return;

    const users: Array<{
      platform: Platform;
      userId?: string;
      userName?: string;
    }> = [];

    for (const message of messages) {
      const embeddedAvatar = messageEmbeddedAvatar(message);
      if (embeddedAvatar && !brokenAvatarUrls[embeddedAvatar]) continue;

      const raw = message.raw || {};
      const userId = String(
        message.author_id ||
          raw?.sender?.user_id ||
          raw?.sender?.id ||
          raw?.authorDetails?.channelId ||
          raw?.author_details?.channel_id ||
          raw?.chatter_user_id ||
          "",
      ).trim();
      const userName = String(
        message.author_name ||
          raw?.sender?.username ||
          raw?.sender?.slug ||
          raw?.authorDetails?.displayName ||
          raw?.author_details?.display_name ||
          raw?.chatter_user_login ||
          "",
      )
        .trim()
        .replace(/^@/, "");

      if (!userId && !userName) continue;

      const key = `${message.platform}:${userId || userName.toLocaleLowerCase()}`;
      const attemptedAt = avatarLookupAttemptedRef.current.get(key) || 0;
      if (Date.now() - attemptedAt < 2 * 60_000) continue;
      avatarLookupAttemptedRef.current.set(key, Date.now());
      users.push({
        platform: message.platform,
        userId: userId || undefined,
        userName: userName || undefined,
      });

      if (users.length >= 40) break;
    }

    if (!users.length) return;

    fetch("/api/avatars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ users }),
      cache: "no-store",
    })
      .then(async (response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("Falha ao carregar avatares")),
      )
      .then((json) => {
        if (!json?.avatars) return;
        const avatars = json.avatars as Record<string, string>;

        setMessages((previous) => {
          let changed = false;
          const next = previous.map((message) => {
            if (messageEmbeddedAvatar(message)) return message;

            const raw = message.raw || {};
            const userId = String(
              message.author_id ||
                raw?.sender?.user_id ||
                raw?.sender?.id ||
                raw?.authorDetails?.channelId ||
                raw?.author_details?.channel_id ||
                raw?.chatter_user_id ||
                "",
            ).trim();
            const userName = String(message.author_name || "")
              .trim()
              .replace(/^@/, "")
              .toLocaleLowerCase();

            const avatar =
              (userId
                ? avatars[`${message.platform}:id:${userId}`]
                : undefined) ||
              (userName
                ? avatars[`${message.platform}:name:${userName}`]
                : undefined);

            if (!avatar) return message;
            changed = true;
            return { ...message, author_avatar: avatar };
          });

          return changed ? next : previous;
        });
      })
      .catch(() => {
        // Avatar é complementar e nunca deve interromper o chat.
      });
  }, [messages, ready, brokenAvatarUrls]);

  const counts = useMemo(() => {
    const countableMessages = messages.filter(
      (message) =>
        (!chatSettings.hideBots || !isBotMessage(message)) &&
        !mutedProfiles.some((profile) => sameProfileAuthor(message, profile)),
    );

    return {
      twitch: countableMessages.filter((m) => m.platform === "twitch").length,
      kick: countableMessages.filter((m) => m.platform === "kick").length,
      youtube: countableMessages.filter((m) => m.platform === "youtube").length,
    };
  }, [messages, chatSettings.hideBots, mutedProfiles]);

  const profileRecentMessages = useMemo(() => {
    if (!profileOpen) return [];
    return messages
      .filter((message) => sameProfileAuthor(message, profileOpen))
      .slice(-10)
      .reverse();
  }, [messages, profileOpen]);

  const activeChannelCount = platforms.filter(
    (p) => channels[p]?.channelId,
  ).length;

  function openSettings() {
    setSettingsDraft(chatSettings);
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsDraft(chatSettings);
    setSettingsOpen(false);
  }

  function saveSettings() {
    const normalized = normalizeChatSettings(settingsDraft);
    setChatSettings(normalized);
    setSettingsDraft(normalized);
    localStorage.setItem(CHAT_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));

    if (normalized.newMessageSound || normalized.mentionSound) {
      try {
        const context = audioContextRef.current || new window.AudioContext();
        audioContextRef.current = context;
        if (context.state === "suspended") void context.resume();
      } catch {
        // Áudio continuará desativado se o navegador não disponibilizar Web Audio.
      }
    }

    setSettingsOpen(false);
  }

  function restoreDefaultSettings() {
    setSettingsDraft({ ...defaultChatSettings });
  }

  function playNotificationTone(kind: "message" | "mention") {
    try {
      const context = audioContextRef.current || new window.AudioContext();
      audioContextRef.current = context;
      if (context.state === "suspended") void context.resume();

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = kind === "mention" ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(kind === "mention" ? 880 : 620, now);
      if (kind === "mention") {
        oscillator.frequency.exponentialRampToValueAtTime(1180, now + 0.12);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(
        kind === "mention" ? 0.12 : 0.07,
        now + 0.012,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + (kind === "mention" ? 0.24 : 0.13),
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + (kind === "mention" ? 0.25 : 0.14));
    } catch {
      // Alguns navegadores bloqueiam áudio até a primeira interação do usuário.
    }
  }

  function messageMentionsConnectedAccount(message: Message) {
    const content = String(message.message || "").toLocaleLowerCase();
    const reply = messageReplyInfo(message);
    const replyAuthor = String(reply?.authorName || "")
      .trim()
      .replace(/^@/, "")
      .toLocaleLowerCase();

    return platforms.some((platform) => {
      const userName = String(auth[platform]?.userName || "")
        .trim()
        .replace(/^@/, "")
        .toLocaleLowerCase();
      if (!userName) return false;

      return (
        content.includes(`@${userName}`) ||
        content
          .split(/\s+/)
          .some((part) => part.replace(/^@/, "") === userName) ||
        replyAuthor === userName
      );
    });
  }

  function shouldMaskLinks(message: Message) {
    if (!chatSettings.blockLinks) return false;
    const ownUserId = String(auth[message.platform]?.userId || "").trim();
    const authorId = String(message.author_id || "").trim();
    if (ownUserId && authorId && ownUserId === authorId) return false;
    return messageModerationRole(message) === null;
  }

  function openUserProfileTarget(target: UserProfileTarget) {
    setModerationFeedback(null);
    setProfilePosition({ x: 0, y: 0 });
    setProfileDragging(false);
    profileDragRef.current = null;
    setProfileOpen(target);
  }

  function openUserProfile(message: Message) {
    openUserProfileTarget({
      platform: message.platform,
      authorId: message.author_id ? String(message.author_id) : null,
      authorName: message.author_name,
      authorAvatar: messageAvatarUrl(message),
      authorColor: message.author_color || null,
      profileUrl: profileUrl(message),
    });
  }

  function normalizedMentionName(value: unknown) {
    return String(value || "")
      .trim()
      .replace(/^@/, "")
      .toLocaleLowerCase();
  }

  function messageMentionAliases(message: Message) {
    const aliases = [
      message.author_name,
      message.platform === "twitch" ? message.raw?.chatter_user_login : null,
      message.platform === "twitch" ? message.raw?.chatter_user_name : null,
      message.platform === "kick" ? message.raw?.sender?.username : null,
      message.platform === "kick" ? message.raw?.sender?.slug : null,
      message.platform === "youtube"
        ? message.raw?.authorDetails?.displayName
        : null,
      message.platform === "youtube"
        ? message.raw?.author_details?.display_name
        : null,
    ]
      .map(normalizedMentionName)
      .filter(Boolean);

    return new Set(aliases);
  }

  function mentionProfileUrl(
    platform: Platform,
    userName: string,
    authorId?: string | null,
  ) {
    const cleanName = userName.trim().replace(/^@/, "");
    if (platform === "twitch") {
      return cleanName
        ? `https://www.twitch.tv/${encodeURIComponent(cleanName.toLowerCase())}`
        : null;
    }
    if (platform === "kick") {
      return cleanName
        ? `https://kick.com/${encodeURIComponent(cleanName)}`
        : null;
    }
    const cleanId = String(authorId || "").trim();
    return cleanId
      ? `https://www.youtube.com/channel/${encodeURIComponent(cleanId)}`
      : null;
  }

  function resolveMentionTarget(
    platform: Platform,
    userName: string,
    verified?: {
      authorId?: string | null;
      authorName?: string | null;
    },
  ): UserProfileTarget | null {
    const normalized = normalizedMentionName(userName);
    if (!normalized) return null;

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = messages[index];
      if (candidate.platform !== platform) continue;
      if (!messageMentionAliases(candidate).has(normalized)) continue;

      return {
        platform,
        authorId: candidate.author_id ? String(candidate.author_id) : null,
        authorName: candidate.author_name,
        authorAvatar: messageAvatarUrl(candidate),
        authorColor: candidate.author_color || null,
        profileUrl: profileUrl(candidate),
      };
    }

    const connectedName = normalizedMentionName(auth[platform]?.userName);
    if (connectedName && connectedName === normalized) {
      const authorId = String(auth[platform]?.userId || "").trim() || null;
      return {
        platform,
        authorId,
        authorName: String(auth[platform]?.userName || userName).replace(
          /^@/,
          "",
        ),
        authorAvatar: auth[platform]?.avatar || null,
        authorColor: null,
        profileUrl: mentionProfileUrl(platform, userName, authorId),
      };
    }

    const channel = channels[platform];
    const channelAliases = [
      channel?.channelName,
      channelInputs[platform],
      channel?.input,
    ]
      .map(normalizedMentionName)
      .filter(Boolean);
    if (channel && channelAliases.includes(normalized)) {
      return {
        platform,
        authorId: channel.channelId || null,
        authorName: channel.channelName || userName.replace(/^@/, ""),
        authorAvatar: channel.avatar || null,
        authorColor: null,
        profileUrl: mentionProfileUrl(platform, userName, channel.channelId),
      };
    }

    if (verified?.authorId || verified?.authorName) {
      const authorId = String(verified.authorId || "").trim() || null;
      const authorName = String(verified.authorName || userName)
        .trim()
        .replace(/^@/, "");
      return {
        platform,
        authorId,
        authorName,
        authorAvatar: null,
        authorColor: null,
        profileUrl: mentionProfileUrl(platform, userName, authorId),
      };
    }

    return null;
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
      composerEditorRef.current?.focus();
    });
  }

  function jumpToMessage(platform: Platform, messageId: string) {
    const target = document.getElementById(messageDomId(platform, messageId));
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.remove("replyTargetFlash");
    requestAnimationFrame(() => {
      target.classList.add("replyTargetFlash");
      window.setTimeout(
        () => target.classList.remove("replyTargetFlash"),
        1400,
      );
    });
  }

  function youtubeBanStorageKey(channelId: string, userId: string) {
    return `achatado_youtube_ban:${channelId}:${userId}`;
  }

  async function requestModeration(options: {
    platform: Platform;
    action: ModerationAction;
    userId?: string | null;
    messageId?: string;
    durationSeconds?: number;
    reason?: string;
  }) {
    const channel = channels[options.platform];
    if (!channel?.channelId) {
      throw new Error(`Canal da ${labels[options.platform]} não identificado.`);
    }
    if (!auth[options.platform]?.connected) {
      throw new Error(
        `Conecte sua conta da ${labels[options.platform]} antes de moderar.`,
      );
    }
    if (!canModerate(options.platform)) {
      throw new Error(
        `Sua conta não foi confirmada como moderadora deste canal da ${labels[options.platform]}.`,
      );
    }

    const userId = String(options.userId || "").trim();
    const busyKey = `${options.platform}:${options.action}:${userId || options.messageId || ""}`;
    setModerationBusy(busyKey);

    try {
      const storageKey =
        options.platform === "youtube" && userId
          ? youtubeBanStorageKey(channel.channelId, userId)
          : "";
      const storedBanId =
        storageKey && options.action === "unban"
          ? localStorage.getItem(storageKey) || ""
          : "";

      const response = await fetch("/api/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: options.platform,
          action: options.action,
          channelId: channel.channelId,
          liveChatId: channel.liveChatId || undefined,
          userId: userId || undefined,
          messageId: options.messageId || undefined,
          durationSeconds: options.durationSeconds || undefined,
          reason: options.reason || undefined,
          banId: storedBanId || undefined,
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          json.error ||
            (response.status === 403
              ? `Sua conta não tem permissão para moderar este canal da ${labels[options.platform]}.`
              : "Falha ao executar moderação."),
        );
      }

      if (storageKey && json.banId) {
        localStorage.setItem(storageKey, String(json.banId));
      } else if (storageKey && options.action === "unban") {
        localStorage.removeItem(storageKey);
      }

      return json;
    } finally {
      setModerationBusy("");
    }
  }

  function beginProfileDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;

    profileDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: profilePosition.x,
      originY: profilePosition.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setProfileDragging(true);
    event.preventDefault();
  }

  function moveProfileDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = profileDragRef.current;
    const dialog = profileDialogRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !dialog) return;

    const rect = dialog.getBoundingClientRect();
    const baseLeft = rect.left - profilePosition.x;
    const baseTop = rect.top - profilePosition.y;
    const nextX = drag.originX + event.clientX - drag.startX;
    const nextY = drag.originY + event.clientY - drag.startY;
    const margin = 8;

    setProfilePosition({
      x: Math.min(
        window.innerWidth - rect.width - baseLeft - margin,
        Math.max(-baseLeft + margin, nextX),
      ),
      y: Math.min(
        window.innerHeight - rect.height - baseTop - margin,
        Math.max(-baseTop + margin, nextY),
      ),
    });
  }

  function endProfileDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = profileDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    profileDragRef.current = null;
    setProfileDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // O navegador pode já ter liberado o ponteiro.
    }
  }

  async function moderateProfile(action: "ban" | "timeout" | "unban") {
    if (!profileOpen) return;
    if (!profileOpen.authorId) {
      setModerationFeedback({
        type: "error",
        text: "Não foi possível identificar o ID deste usuário.",
      });
      return;
    }

    let durationSeconds: number | undefined;
    let reason = "";

    if (action === "ban") {
      if (
        !window.confirm(
          `Banir ${profileOpen.authorName} permanentemente da ${labels[profileOpen.platform]}?`,
        )
      ) {
        return;
      }
      reason = window.prompt("Motivo do ban (opcional):", "")?.trim() || "";
    } else if (action === "timeout") {
      const duration = window.prompt(
        `Timeout de ${profileOpen.authorName}: quantos minutos?`,
        "10",
      );
      if (duration === null) return;
      const minutes = Number(duration.replace(",", "."));
      if (!Number.isFinite(minutes) || minutes <= 0) {
        setModerationFeedback({
          type: "error",
          text: "Informe uma duração válida em minutos.",
        });
        return;
      }
      durationSeconds = Math.round(minutes * 60);
      reason = window.prompt("Motivo do timeout (opcional):", "")?.trim() || "";
    } else if (
      !window.confirm(
        `Remover ban/timeout de ${profileOpen.authorName} na ${labels[profileOpen.platform]}?`,
      )
    ) {
      return;
    }

    setModerationFeedback(null);
    try {
      await requestModeration({
        platform: profileOpen.platform,
        action,
        userId: profileOpen.authorId,
        durationSeconds,
        reason,
      });
      setModerationFeedback({
        type: "success",
        text:
          action === "ban"
            ? "Usuário banido com sucesso."
            : action === "timeout"
              ? "Timeout aplicado com sucesso."
              : "Ban/timeout removido com sucesso.",
      });
    } catch (moderationError) {
      setModerationFeedback({
        type: "error",
        text:
          moderationError instanceof Error
            ? moderationError.message
            : "Falha ao executar moderação.",
      });
    }
  }

  async function deleteChatMessage(message: Message) {
    if (
      !window.confirm(
        `Apagar esta mensagem de ${message.author_name} na ${labels[message.platform]}?`,
      )
    ) {
      return;
    }

    setError("");
    try {
      await requestModeration({
        platform: message.platform,
        action: "delete_message",
        messageId: message.platform_message_id,
      });
      setMessages((previous) =>
        previous.filter(
          (candidate) =>
            !(
              candidate.platform === message.platform &&
              candidate.platform_message_id === message.platform_message_id
            ),
        ),
      );
    } catch (moderationError) {
      setError(
        moderationError instanceof Error
          ? moderationError.message
          : "Falha ao apagar mensagem.",
      );
    }
  }

  function findLoadedUser(platform: Platform, username: string) {
    const normalized = username.replace(/^@/, "").trim().toLocaleLowerCase();
    return [...messages]
      .reverse()
      .find(
        (message) =>
          message.platform === platform &&
          message.author_name.replace(/^@/, "").trim().toLocaleLowerCase() ===
            normalized &&
          Boolean(message.author_id),
      );
  }

  async function handleModerationCommand(value: string) {
    const command = value.trim();
    let match = command.match(/^\/ban\s+@?(\S+)(?:\s+(.+))?$/i);
    let action: "ban" | "timeout" | "unban" | null = null;
    let username = "";
    let reason = "";
    let durationSeconds: number | undefined;

    if (match) {
      action = "ban";
      username = match[1];
      reason = match[2]?.trim() || "";
    } else {
      match = command.match(
        /^\/timeout\s+@?(\S+)\s+(\d+(?:[.,]\d+)?)(?:\s+(.+))?$/i,
      );
      if (match) {
        action = "timeout";
        username = match[1];
        durationSeconds = Math.round(Number(match[2].replace(",", ".")) * 60);
        reason = match[3]?.trim() || "";
      } else {
        match = command.match(/^\/unban\s+@?(\S+)$/i);
        if (match) {
          action = "unban";
          username = match[1];
        }
      }
    }

    if (!action) return false;

    if (!canModerate(selected)) {
      setError(
        `Sua conta não foi confirmada como moderadora deste canal da ${labels[selected]}.`,
      );
      return true;
    }
    if (!auth[selected]?.moderationReady) {
      setError(
        `Reconecte sua conta da ${labels[selected]} para conceder as permissões de moderação.`,
      );
      return true;
    }

    const user = findLoadedUser(selected, username);
    if (!user?.author_id) {
      setError(
        `Não encontrei @${username.replace(/^@/, "")} entre os usuários carregados da ${labels[selected]}.`,
      );
      return true;
    }

    if (action === "timeout" && (!durationSeconds || durationSeconds < 1)) {
      setError("Use /timeout usuário minutos [motivo].");
      return true;
    }

    try {
      await requestModeration({
        platform: selected,
        action,
        userId: user.author_id,
        durationSeconds,
        reason,
      });
      setText("");
      composerEditorRef.current?.replaceChildren();
      setReplyingTo(null);
      setError(
        action === "ban"
          ? `${user.author_name} foi banido.`
          : action === "timeout"
            ? `Timeout aplicado em ${user.author_name}.`
            : `Ban/timeout removido de ${user.author_name}.`,
      );
    } catch (moderationError) {
      setError(
        moderationError instanceof Error
          ? moderationError.message
          : "Falha ao executar comando de moderação.",
      );
    }
    return true;
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!text.trim()) return;

    const target = channels[selected];
    if (!target?.channelId) {
      setError(
        `Informe e identifique primeiro o canal da ${labels[selected]}.`,
      );
      return;
    }
    if (!auth[selected]?.configured) {
      setError(
        `A API da ${labels[selected]} ainda não foi configurada no servidor.`,
      );
      return;
    }
    if (!auth[selected]?.connected) {
      // OAuth starts on the server and requires a full navigation.
      window.location.assign(
        new URL(
          `/api/auth/${selected}/start${popupMode ? "?popup=1" : ""}`,
          window.location.origin,
        ).href,
      );
      return;
    }

    if (await handleModerationCommand(text)) return;

    setSending(true);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selected,
          message:
            selected === "kick"
              ? kickMessageWithNativeEmotes(text, [
                  ...pickerEmotes,
                  ...clickedComposerEmotesRef.current.kick.values(),
                ])
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
      if (!res.ok)
        throw new Error(json.error || "Não foi possível enviar a mensagem.");

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
      composerEditorRef.current?.replaceChildren();
      setReplyingTo(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao enviar mensagem.",
      );
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
    setChannelInputs((previous) => {
      const next = { ...previous, [platform]: value };
      localStorage.setItem("achatado_channel_inputs", JSON.stringify(next));
      return next;
    });
    setChannelErrors((previous) => ({
      ...previous,
      [platform]: undefined,
    }));

    const current = channels[platform];
    if (current && current.input !== value) {
      setChannels((previous) => {
        const next = { ...previous };
        delete next[platform];
        localStorage.setItem("achatado_channels", JSON.stringify(next));
        return next;
      });
    }
  }

  function openChatPopup() {
    const width = Math.max(
      720,
      Math.min(window.screen.availWidth || 1100, 1200),
    );
    const height = Math.max(
      600,
      Math.min(window.screen.availHeight || 820, 900),
    );
    const left = Math.max(
      0,
      Math.round(((window.screen.availWidth || width) - width) / 2),
    );
    const top = Math.max(
      0,
      Math.round(((window.screen.availHeight || height) - height) / 2),
    );

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
        if (selectedTarget.videoId)
          params.set("videoId", selectedTarget.videoId);

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

  function composerPlainText(root: HTMLElement) {
    return Array.from(root.childNodes)
      .map((node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
        if (node instanceof HTMLElement && node.dataset.emoteCode) {
          return node.dataset.emoteCode;
        }
        if (node.nodeName === "BR") return "\n";
        return node.textContent || "";
      })
      .join("");
  }

  function composerEmoteElement(emote: PickerEmote) {
    const wrapper = document.createElement("span");
    wrapper.className = "composerRichEmote";
    wrapper.dataset.emoteCode = emote.code;
    wrapper.contentEditable = "false";
    wrapper.title = emote.name || emote.code;

    const image = document.createElement("img");
    image.src = emote.url || "";
    image.alt = emote.code;
    image.draggable = false;
    wrapper.appendChild(image);
    return wrapper;
  }

  function placeCaretAfter(node: Node) {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function hydrateComposer(value: string) {
    const root = composerEditorRef.current;
    if (!root) return;

    const byCode = new Map<string, PickerEmote>();
    for (const emote of clickedComposerEmotesRef.current[selected].values()) {
      if (emote.code && emote.url && !byCode.has(emote.code)) {
        byCode.set(emote.code, emote);
      }
    }
    for (const emote of pickerEmotes) {
      if (emote.code && emote.url && !byCode.has(emote.code)) {
        byCode.set(emote.code, emote);
      }
    }

    const fragment = document.createDocumentFragment();
    for (const part of value.split(/(\s+)/)) {
      const emote = byCode.get(part);
      if (emote) fragment.appendChild(composerEmoteElement(emote));
      else if (part) fragment.appendChild(document.createTextNode(part));
    }
    root.replaceChildren(fragment);
  }

  function syncComposerText(limit = maxLength) {
    const root = composerEditorRef.current;
    if (!root) return;

    const next = composerPlainText(root);
    if (next.length <= limit) {
      setText(next);
      return;
    }

    const trimmed = next.slice(0, limit);
    setText(trimmed);
    hydrateComposer(trimmed);
    root.focus();

    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function upgradeTypedComposerEmote() {
    const root = composerEditorRef.current;
    const selection = window.getSelection();
    if (
      !root ||
      !selection ||
      !selection.isCollapsed ||
      !selection.anchorNode ||
      selection.anchorNode.nodeType !== Node.TEXT_NODE ||
      !root.contains(selection.anchorNode)
    )
      return;

    const textNode = selection.anchorNode as Text;
    const offset = selection.anchorOffset;
    const prefix = textNode.data.slice(0, offset);
    const match = prefix.match(/(^|\s)([^\s]+)$/);
    const code = match?.[2] || "";
    if (!code) return;

    const emote = pickerEmotes.find(
      (item) => !item.locked && item.code === code && Boolean(item.url),
    );
    if (!emote) return;

    const start = offset - code.length;
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, offset);
    range.deleteContents();

    const emoteNode = composerEmoteElement(emote);
    range.insertNode(emoteNode);
    placeCaretAfter(emoteNode);
  }

  function insertPlainComposerText(value: string) {
    const root = composerEditorRef.current;
    if (!root || !value) return;

    root.focus();
    const selection = window.getSelection();
    if (!selection) return;

    const selectionInside =
      selection.rangeCount > 0 &&
      selection.anchorNode &&
      root.contains(selection.anchorNode);

    const range = selectionInside
      ? selection.getRangeAt(0)
      : document.createRange();

    if (!selectionInside) {
      range.selectNodeContents(root);
      range.collapse(false);
    }

    range.deleteContents();
    const node = document.createTextNode(value);
    range.insertNode(node);
    placeCaretAfter(node);
    syncComposerText();
  }

  function insertPickerEmote(emote: PickerEmote, limit = maxLength) {
    const root = composerEditorRef.current;
    if (!root) return;

    root.focus();
    const selection = window.getSelection();
    const selectionInside =
      Boolean(selection?.rangeCount) &&
      Boolean(selection?.anchorNode) &&
      root.contains(selection!.anchorNode);

    const range = selectionInside
      ? selection!.getRangeAt(0)
      : document.createRange();

    if (!selectionInside) {
      range.selectNodeContents(root);
      range.collapse(false);
    }

    range.deleteContents();

    const previous =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? (range.startContainer.nodeValue || "").slice(0, range.startOffset)
        : "";

    if (previous && !/\s$/.test(previous)) {
      const leading = document.createTextNode(" ");
      range.insertNode(leading);
      range.setStartAfter(leading);
      range.collapse(true);
    }

    const emoteNode = composerEmoteElement(emote);
    range.insertNode(emoteNode);
    range.setStartAfter(emoteNode);
    range.collapse(true);

    const trailing = document.createTextNode(" ");
    range.insertNode(trailing);
    placeCaretAfter(trailing);
    syncComposerText(limit);
  }

  function addChatEmoteToComposer(emote: {
    id?: string;
    code: string;
    url: string;
    provider: Exclude<PickerProvider, "all">;
    platform: Platform;
    animated?: boolean;
    zeroWidth?: boolean;
    native?: boolean;
  }) {
    const composerEmote: PickerEmote = {
      id: emote.id,
      code: emote.code,
      name: emote.code,
      url: emote.url,
      provider: emote.provider,
      category:
        emote.provider === "bttv" ||
        emote.provider === "ffz" ||
        emote.provider === "7tv"
          ? "thirdparty"
          : "official",
      scope: "channel",
      animated: emote.animated,
      zeroWidth: emote.zeroWidth,
      native: emote.native,
      locked: false,
    };

    clickedComposerEmotesRef.current[emote.platform].set(
      emote.code,
      composerEmote,
    );

    setPickerOpen(false);
    setProfileOpen(null);
    setSelected(emote.platform);

    const targetLimit = emote.platform === "youtube" ? 200 : 500;
    const insert = () => insertPickerEmote(composerEmote, targetLimit);

    if (selected === emote.platform) {
      insert();
    } else {
      requestAnimationFrame(() => requestAnimationFrame(insert));
    }
  }

  function showChatEmotePreview(
    code: string,
    url: string,
    provider: string,
    element: HTMLElement,
  ) {
    const rect = element.getBoundingClientRect();
    const width = 142;
    const left = Math.max(
      8,
      Math.min(
        window.innerWidth - width - 8,
        rect.left + rect.width / 2 - width / 2,
      ),
    );
    const top = Math.max(8, rect.top - 112);

    setEmotePreview({
      code,
      url,
      provider,
      left,
      top,
    });
  }

  function interactiveChatEmote(options: {
    key: string;
    id?: string;
    code: string;
    url: string;
    provider: Exclude<PickerProvider, "all">;
    platform: Platform;
    className?: string;
    animated?: boolean;
    zeroWidth?: boolean;
    native?: boolean;
  }) {
    const providerLabel =
      options.provider === "7tv"
        ? "7TV"
        : options.provider === "bttv"
          ? "BTTV"
          : options.provider === "ffz"
            ? "FFZ"
            : labels[options.provider as Platform] ||
              options.provider.toUpperCase();

    return (
      <span
        className="interactiveChatEmote"
        key={options.key}
        role="button"
        tabIndex={0}
        aria-label={`Adicionar emote ${options.code} à mensagem da ${labels[options.platform]}`}
        onClick={(event) => {
          event.stopPropagation();
          setEmotePreview(null);
          addChatEmoteToComposer(options);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          setEmotePreview(null);
          addChatEmoteToComposer(options);
        }}
        onMouseEnter={(event) =>
          showChatEmotePreview(
            options.code,
            options.url,
            providerLabel,
            event.currentTarget,
          )
        }
        onMouseLeave={() => setEmotePreview(null)}
        onFocus={(event) =>
          showChatEmotePreview(
            options.code,
            options.url,
            providerLabel,
            event.currentTarget,
          )
        }
        onBlur={() => setEmotePreview(null)}
      >
        <img
          className={`chatEmote ${options.className || ""} ${options.zeroWidth ? "zeroWidth" : ""}`.trim()}
          src={options.url}
          alt={options.code}
          draggable={false}
          loading="lazy"
        />
      </span>
    );
  }

  useEffect(() => {
    const root = composerEditorRef.current;
    if (!root) return;
    if (document.activeElement !== root) hydrateComposer(text);
  }, [
    selected,
    selectedTarget?.channelId,
    auth[selected]?.connected,
    pickerEmotes,
  ]);

  const youtubeEmotePattern = useMemo(() => {
    const codes = Object.keys(youtubeEmotes)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    if (!codes.length) return null;

    const escaped = codes.map((code) =>
      code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );
    return new RegExp("(" + escaped.join("|") + ")", "g");
  }, [youtubeEmotes]);

  function renderMentionButton(
    label: string,
    target: UserProfileTarget,
    key: string,
  ) {
    return (
      <button
        type="button"
        key={key}
        className={`chatMention ${target.platform}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openUserProfileTarget(target);
        }}
        title={`Abrir perfil de ${target.authorName}`}
        aria-label={`Abrir perfil de ${target.authorName}`}
      >
        {label}
      </button>
    );
  }

  function renderMentionsInText(
    textValue: string,
    message: Message,
    keyPrefix: string,
  ) {
    const parts: any[] = [];
    const pattern = /@([a-zA-Z0-9_][a-zA-Z0-9_.-]{0,38})/g;
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(textValue)) !== null) {
      const previousCharacter =
        match.index > 0 ? textValue[match.index - 1] : "";
      if (previousCharacter && /[a-zA-Z0-9._%+-]/.test(previousCharacter)) {
        continue;
      }

      const target = resolveMentionTarget(message.platform, match[1]);
      if (!target) continue;

      if (match.index > cursor) {
        parts.push(textValue.slice(cursor, match.index));
      }
      parts.push(
        renderMentionButton(
          match[0],
          target,
          `${keyPrefix}-mention-${match.index}`,
        ),
      );
      cursor = pattern.lastIndex;
    }

    if (cursor < textValue.length) parts.push(textValue.slice(cursor));
    return parts.length ? parts : textValue;
  }

  function renderClickableText(
    textValue: string,
    keyPrefix: string,
    message: Message,
  ) {
    const parts: any[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;
    const pattern = new RegExp(CHAT_LINK_PATTERN.source, "gi");

    while ((match = pattern.exec(textValue)) !== null) {
      if (match.index > cursor) {
        parts.push(
          renderMentionsInText(
            textValue.slice(cursor, match.index),
            message,
            `${keyPrefix}-before-${match.index}`,
          ),
        );
      }

      const { link, trailing } = trimChatLinkPunctuation(match[0]);
      if (link) {
        parts.push(
          <a
            key={`${keyPrefix}-link-${match.index}`}
            className="chatMessageLink"
            href={chatLinkHref(link)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            title={link}
          >
            {link}
          </a>,
        );
      }
      if (trailing) {
        parts.push(
          renderMentionsInText(
            trailing,
            message,
            `${keyPrefix}-trailing-${match.index}`,
          ),
        );
      }
      cursor = pattern.lastIndex;
    }

    if (cursor < textValue.length) {
      parts.push(
        renderMentionsInText(
          textValue.slice(cursor),
          message,
          `${keyPrefix}-after`,
        ),
      );
    }
    return parts.length ? parts : textValue;
  }

  function renderThirdPartyTwitchText(
    textValue: string,
    message: Message,
    prefix: string,
  ) {
    if (!Object.keys(thirdPartyEmotes).length) {
      return renderClickableText(
        textValue,
        `${message.platform_message_id}-${prefix}`,
        message,
      );
    }

    return textValue.split(/(\s+)/).map((part, index) => {
      const emote = thirdPartyEmotes[part];
      if (!emote) {
        return renderClickableText(
          part,
          `${message.platform_message_id}-${prefix}-text-${index}`,
          message,
        );
      }

      return interactiveChatEmote({
        key: `${message.platform_message_id}-${prefix}-third-${index}`,
        code: part,
        url: emote.url,
        provider: emote.provider,
        platform: "twitch",
        animated: emote.animated,
        zeroWidth: emote.zeroWidth,
      });
    });
  }

  function renderTwitchMessage(message: Message) {
    const fragments = message.raw?.message?.fragments;
    if (!Array.isArray(fragments) || !fragments.length) {
      const source = stripTwitchReplyMention(message, message.message);
      return renderThirdPartyTwitchText(
        shouldMaskLinks(message) ? maskUntrustedLinks(source) : source,
        message,
        "fallback",
      );
    }

    const replyMentionPattern = twitchReplyMentionPattern(message);
    let replyMentionRemoved = false;
    let trimFollowingText = false;

    const visibleFragments = fragments.reduce(
      (result: any[], fragment: any) => {
        let nextFragment = fragment;
        const fragmentText = String(fragment?.text || "");

        if (!replyMentionRemoved && replyMentionPattern && fragmentText) {
          const stripped = fragmentText.replace(replyMentionPattern, "");
          if (stripped !== fragmentText) {
            replyMentionRemoved = true;
            const cleaned = stripped.replace(/^\s+/, "");
            if (!cleaned) {
              trimFollowingText = true;
              return result;
            }
            nextFragment = { ...fragment, text: cleaned };
          }
        } else if (trimFollowingText && fragmentText) {
          trimFollowingText = false;
          const cleaned = fragmentText.replace(/^\s+/, "");
          if (!cleaned && fragment?.type === "text") return result;
          nextFragment = { ...fragment, text: cleaned };
        }

        result.push(nextFragment);
        return result;
      },
      [],
    );

    return visibleFragments.map((fragment: any, index: number) => {
      if (fragment?.type === "emote" && fragment?.emote?.id) {
        const id = encodeURIComponent(String(fragment.emote.id));
        const formats = Array.isArray(fragment.emote.format)
          ? fragment.emote.format
          : [];
        const format = formats.includes("animated") ? "animated" : "static";
        const url = `https://static-cdn.jtvnw.net/emoticons/v2/${id}/${format}/dark/2.0`;
        return interactiveChatEmote({
          key: `${message.platform_message_id}-tw-native-${index}`,
          id: String(fragment.emote.id),
          code: String(fragment.text || "Twitch emote"),
          url,
          provider: "twitch",
          platform: "twitch",
          animated: format === "animated",
          native: true,
          className: "nativeEmote twitchNativeEmote",
        });
      }

      if (fragment?.type === "gif" && fragment?.gif?.url) {
        return interactiveChatEmote({
          key: `${message.platform_message_id}-tw-gif-${index}`,
          code: String(fragment.text || "Twitch GIF"),
          url: String(fragment.gif.url),
          provider: "twitch",
          platform: "twitch",
          animated: true,
          native: true,
          className: "nativeEmote twitchNativeEmote",
        });
      }

      if (fragment?.type === "mention" && fragment?.mention) {
        const mentionName = String(
          fragment.mention.user_login ||
            fragment.mention.user_name ||
            fragment.text ||
            "",
        )
          .trim()
          .replace(/^@/, "");
        const target = resolveMentionTarget("twitch", mentionName, {
          authorId: fragment.mention.user_id || null,
          authorName:
            fragment.mention.user_name ||
            fragment.mention.user_login ||
            mentionName,
        });
        if (target) {
          return renderMentionButton(
            String(fragment.text || `@${mentionName}`),
            target,
            `${message.platform_message_id}-tw-mention-${index}`,
          );
        }
      }

      return (
        <span key={`${message.platform_message_id}-tw-text-${index}`}>
          {renderThirdPartyTwitchText(
            shouldMaskLinks(message)
              ? maskUntrustedLinks(String(fragment?.text || ""))
              : String(fragment?.text || ""),
            message,
            `fragment-${index}`,
          )}
        </span>
      );
    });
  }

  function renderKickMessage(message: Message) {
    const rawSource =
      typeof message.raw?.content === "string" ? message.raw.content : "";
    const source = shouldMaskLinks(message)
      ? maskUntrustedLinks(rawSource || message.message)
      : rawSource;
    if (!source) {
      const fallback = shouldMaskLinks(message)
        ? maskUntrustedLinks(message.message)
        : message.message;
      return renderClickableText(
        fallback,
        `${message.platform_message_id}-kick-fallback`,
        message,
      );
    }

    const parts: any[] = [];
    const regex = /\[emote:([^:\]]+):([^\]]+)\]/g;
    let cursor = 0;
    let match: RegExpExecArray | null;
    let index = 0;

    while ((match = regex.exec(source)) !== null) {
      if (match.index > cursor) {
        parts.push(
          renderClickableText(
            source.slice(cursor, match.index),
            `${message.platform_message_id}-kick-text-${index}`,
            message,
          ),
        );
      }

      const emoteId = encodeURIComponent(match[1]);
      const emoteName = match[2];
      const kickEmoteUrl = `https://files.kick.com/emotes/${emoteId}/fullsize`;
      parts.push(
        interactiveChatEmote({
          key: `${message.platform_message_id}-kick-native-${index++}`,
          id: match[1],
          code: emoteName,
          url: kickEmoteUrl,
          provider: "kick",
          platform: "kick",
          native: true,
          className: "nativeEmote kickNativeEmote",
        }),
      );
      cursor = regex.lastIndex;
    }

    if (cursor < source.length) {
      parts.push(
        renderClickableText(
          source.slice(cursor),
          `${message.platform_message_id}-kick-text-${index}`,
          message,
        ),
      );
    }
    return parts.length
      ? parts
      : renderClickableText(
          message.message,
          `${message.platform_message_id}-kick-fallback`,
          message,
        );
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
      5000, 4000, 3000, 2000, 1000, 950, 900, 850, 800, 750, 700, 650, 600, 550,
      500, 450, 400, 350, 300, 250, 200, 150, 100, 50, 25, 10, 5, 1,
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
    const fromText = String(badge.text || "").match(
      /(?:level|nível)\s*(\d{1,3})/i,
    );

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
              typeof badge?.image_url === "string"
                ? badge.image_url
                : undefined,
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

    return result.sort((a, b) => {
      const aIsLevel = kickLevelBadgeNumber(a) !== null;
      const bIsLevel = kickLevelBadgeNumber(b) !== null;
      return Number(bIsLevel) - Number(aIsLevel);
    });
  }

  function renderUserBadges(message: Message) {
    if (message.platform === "youtube")
      return <YouTubeBadges badges={message.badges || []} />;
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
              type === "subscriber" ? kickSubscriberBadgeForCount(count) : null;
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
                      : type === "sub_gifter" ||
                          type === "subgifter" ||
                          type === "sub-gifter"
                        ? `Sub Gifter · ${kickSubGifterBadgeTier(count)}+ sub gifts`
                        : level
                          ? `Nível ${level}`
                          : label
                  }
                  aria-label={
                    subscriberBadge
                      ? `${label}, badge de ${subscriberBadge.months} ${subscriberBadge.months === 1 ? "mês" : "meses"}`
                      : type === "sub_gifter" ||
                          type === "subgifter" ||
                          type === "sub-gifter"
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
    const source = shouldMaskLinks(message)
      ? maskUntrustedLinks(message.message)
      : message.message;
    if (!youtubeEmotePattern) {
      return renderClickableText(
        source,
        `${message.platform_message_id}-yt-text`,
        message,
      );
    }

    return source.split(youtubeEmotePattern).map((part, index) => {
      const emote = youtubeEmotes[part];
      if (!emote) {
        return renderClickableText(
          part,
          `${message.platform_message_id}-yt-text-${index}`,
          message,
        );
      }

      return interactiveChatEmote({
        key: `${message.platform_message_id}-yt-native-${index}`,
        code: emote.shortcut || part,
        url: emote.url,
        provider: "youtube",
        platform: "youtube",
        native: true,
        className: "nativeEmote youtubeNativeEmote",
      });
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
      <ChannelSidebar
        auth={auth}
        channels={channels}
        inputs={channelInputs}
        errors={channelErrors}
        resolving={resolvingPlatform}
        popup={popupMode}
        onInput={updateChannelInput}
        onResolve={resolveChannel}
        onLogout={logout}
      />
    );
  }

  function changeFeedFont(direction: number) {
    const sizes: FeedFontSize[] = ["small", "medium", "large"];
    const next = {
      ...chatSettings,
      feedFontSize:
        sizes[
          Math.max(
            0,
            Math.min(2, sizes.indexOf(chatSettings.feedFontSize) + direction),
          )
        ],
    };
    setChatSettings(next);
    localStorage.setItem(CHAT_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  }
  const recentMentions = messages
    .filter(
      (m) =>
        messageMentionsConnectedAccount(m) &&
        (!chatSettings.hideBots || !isBotMessage(m)),
    )
    .slice(-30)
    .reverse();
  const unreadMentions = recentMentions.filter(
    (m) => !readMentionKeys.includes(m.platform + ":" + m.platform_message_id),
  ).length;
  const canSend = Boolean(
    selectedTarget && auth[selected].configured && auth[selected].connected,
  );
  const needsAccountConnection = Boolean(
    auth[selected].configured && !auth[selected].connected,
  );

  return (
    <main
      className={`shell chatShell ${popupMode ? "popupMode" : ""} ${overlayMode ? "overlayMode" : ""} ${chatSettings.compactMode ? "compactFeed" : ""} feedFont-${chatSettings.feedFontSize}`}
    >
      {!popupMode && (
        <header className="topbar">
          <div className="brand">
            <div className="brandMark">
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <ellipse cx="16" cy="8" rx="10" ry="3" fill="currentColor" />
                <path
                  d="M6 9.5c4 3 16 3 20 0V24c-4 4-16 4-20 0Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div>
              <h1>aCHATado</h1>
              <p>Twitch + Kick + YouTube em um só lugar</p>
            </div>
          </div>
          <div className="topbarActions">
            <div className="notificationsWrapper">
              <button
                type="button"
                className="topSettingsButton"
                onClick={() => setMentionsOpen((v) => !v)}
                aria-label="Menções recentes"
                aria-expanded={mentionsOpen}
              >
                <Icon name="bell" />
                {unreadMentions > 0 && <i className="notificationDot" />}
              </button>
              {mentionsOpen && (
                <>
                  <button
                    className="popoverDismiss"
                    type="button"
                    aria-label="Fechar menções"
                    onClick={() => setMentionsOpen(false)}
                  />
                  <section
                    className="mentionsPopover"
                    aria-label="Menções recentes"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setMentionsOpen(false);
                    }}
                  >
                    <header>
                      <Icon name="at" />
                      <strong>Menções Recentes</strong>
                      <button
                        type="button"
                        onClick={() => setMentionsOpen(false)}
                        aria-label="Fechar menções"
                      >
                        <Icon name="close" />
                      </button>
                    </header>
                    <div className="mentionsList">
                      {recentMentions.length ? (
                        recentMentions.map((m) => (
                          <button
                            type="button"
                            className="mentionItem"
                            key={m.platform + m.platform_message_id}
                            onClick={() => {
                              setMentionsOpen(false);
                              setFilter("all");
                              requestAnimationFrame(() =>
                                jumpToMessage(
                                  m.platform,
                                  m.platform_message_id,
                                ),
                              );
                            }}
                          >
                            <span className="mentionIdentity">
                              <span className={`platformIcon ${m.platform}`}>
                                <PlatformIcon platform={m.platform} />
                              </span>
                              <strong
                                style={
                                  m.author_color
                                    ? { color: m.author_color }
                                    : undefined
                                }
                              >
                                {m.author_name}
                              </strong>
                              <time>{timeLabel(m.created_at)}</time>
                            </span>
                            <span className="mentionText">{m.message}</span>
                          </button>
                        ))
                      ) : (
                        <p className="popoverEmpty">
                          Suas menções aparecerão aqui quando uma conta
                          conectada for citada.
                        </p>
                      )}
                    </div>
                    <footer>
                      <button
                        type="button"
                        onClick={() =>
                          setReadMentionKeys(
                            recentMentions.map(
                              (m) => m.platform + ":" + m.platform_message_id,
                            ),
                          )
                        }
                      >
                        Marcar todas como lidas
                      </button>
                    </footer>
                  </section>
                </>
              )}
            </div>
            <button
              type="button"
              className="topSettingsButton"
              onClick={openSettings}
              aria-label="Abrir configurações do chat"
              title="Configurações do chat"
            >
              <Icon name="settings" />
            </button>
          </div>
        </header>
      )}

      <section className="workspace">
        <aside className="sidebar">{renderSidebarContent()}</aside>

        <section className="chatPanel">
          <div className="chatHeader">
            <div>
              <strong>
                {filter === "all"
                  ? "Chat unificado"
                  : `Chat da ${labels[filter]}`}
              </strong>
              <span>{visible.length} mensagens carregadas</span>
            </div>
            <div className="chatHeaderActions">
              <div className="chatFilterBar" aria-label="Exibir mensagens">
                <span className="chatFilterLabel">Exibir mensagens</span>
                <button
                  type="button"
                  className={`chatFilterButton ${filter === "all" ? "active" : ""}`}
                  onClick={() => setFilter("all")}
                  aria-pressed={filter === "all"}
                  title="Exibir mensagens de todas as plataformas"
                >
                  <span className="chatFilterIcon all">∞</span>
                  <span>Todas</span>
                  <b>{counts.twitch + counts.kick + counts.youtube}</b>
                </button>
                {platforms.map((platform) => (
                  <button
                    type="button"
                    key={platform}
                    className={`chatFilterButton ${platform} ${filter === platform ? "active" : ""}`}
                    onClick={() => setFilter(platform)}
                    aria-pressed={filter === platform}
                    title={`Exibir somente mensagens da ${labels[platform]}`}
                  >
                    <span className={`chatFilterIcon ${platform}`}>
                      <PlatformIcon platform={platform} />
                    </span>
                    <span>{labels[platform]}</span>
                    <b>{counts[platform]}</b>
                  </button>
                ))}
              </div>
              {popupMode ? (
                <button
                  type="button"
                  className="chatUtilityButton"
                  onClick={openSettings}
                  title="Configurações"
                  aria-label="Abrir configurações do chat"
                >
                  <Icon name="settings" />
                  <span>Configurações</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="chatUtilityButton popupLaunchButton"
                  onClick={openChatPopup}
                  title="Abrir chat em popup"
                  aria-label="Abrir chat em uma nova janela"
                >
                  <Icon name="external" />
                  <span>Pop-up</span>
                </button>
              )}
            </div>
          </div>

          <div className="messageViewport">
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
            role="log"
            aria-label="Mensagens do chat unificado"
            aria-live="polite"
            aria-relevant="additions"
            ref={messageListRef}
            onScroll={handleMessageListScroll}
            onWheel={handleMessageListWheel}
          >
            <div className="messageListContent" ref={messageContentRef}>
              <div className="feedNotice">
                <Icon name="hub" />
                <span>
                  {activeChannelCount
                    ? `Feed unificado · ${platforms
                        .filter((p) => channels[p])
                        .map((p) => labels[p])
                        .join(" + ")}`
                    : "Conecte seus canais para acompanhar o chat em um só lugar."}
                </span>
              </div>
              {historyUnavailable && (
                <div className="historyNotice">
                  Histórico indisponível neste ambiente. As mensagens recebidas
                  ao vivo continuam no feed.
                </div>
              )}
              {pinnedMessage && (
                <div className="pinnedMessage" role="status">
                  <Icon name="pin" />
                  <div>
                    <strong>{pinnedMessage.author_name}</strong>
                    <p>{renderMessageText(pinnedMessage)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPinnedMessage(null)}
                    aria-label="Desafixar mensagem"
                  >
                    <Icon name="close" />
                  </button>
                </div>
              )}
              {mutedProfiles.length > 0 && (
                <div className="mutedNotice">
                  <span>
                    {mutedProfiles.length} usuário(s) silenciado(s) nesta
                    sessão.
                  </span>
                  <button type="button" onClick={() => setMutedProfiles([])}>
                    Mostrar novamente
                  </button>
                </div>
              )}
              {visible.map((m) => {
                const reply = messageReplyInfo(m);
                const parent = reply
                  ? messages.find(
                      (candidate) =>
                        candidate.platform === reply.platform &&
                        candidate.platform_message_id === reply.messageId,
                    )
                  : undefined;
                return (
                  <MessageCard
                    key={m.platform + "-" + m.platform_message_id}
                    message={m}
                    settings={chatSettings}
                    avatar={messageAvatarUrl(m)}
                    mentioned={messageMentionsConnectedAccount(m)}
                    reply={reply}
                    parent={parent}
                    canDelete={
                      canModerate(m.platform) &&
                      Boolean(auth[m.platform]?.moderationReady)
                    }
                    busy={Boolean(moderationBusy)}
                    badges={renderUserBadges(m)}
                    onProfile={() => openUserProfile(m)}
                    onReply={() => beginReply(m)}
                    onPin={() => setPinnedMessage(m)}
                    onDelete={() => deleteChatMessage(m)}
                    onJump={(target) =>
                      jumpToMessage(target.platform, target.messageId)
                    }
                    onAvatarError={(url) => markAvatarBroken(m, url)}
                  >
                    {renderMessageText(m)}
                  </MessageCard>
                );
              })}

              {!activeChannelCount && (
                <div className="emptyState">
                  Selecione um canal em Plataformas para começar. Em telas
                  menores, abra Configurações → Canais & contas.
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
          </div>

          {!overlayMode && (
            <form className="composer" onSubmit={send}>
              <div className="composerToolbar">
                <div className="sendVia">
                  <span>Enviar pela:</span>
                  <select
                    className="mobilePlatformSelect"
                    aria-label="Plataforma para enviar"
                    value={selected}
                    onChange={(event) => {
                      const platform = event.target.value as Platform;
                      setSelected(platform);
                      if (replyingTo?.platform !== platform)
                        setReplyingTo(null);
                      setPickerOpen(false);
                      setError("");
                    }}
                  >
                    {platforms.map((platform) => (
                      <option key={platform} value={platform}>
                        {labels[platform]}
                      </option>
                    ))}
                  </select>
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
                        aria-pressed={selected === p}
                        className={`${selected === p ? "selected" : ""} ${p}`}
                      >
                        <PlatformIcon platform={p} />
                        {labels[p]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="composerTools">
                  <div className="toolGroup">
                    <button
                      type="button"
                      onClick={() => {
                        if (autoScrollPaused) scrollToLatest();
                        else {
                          cancelPendingAutoScroll();
                          setAutoScrollState(true);
                        }
                      }}
                      aria-pressed={autoScrollPaused}
                      aria-label={
                        autoScrollPaused
                          ? "Retomar rolagem do chat"
                          : "Pausar rolagem do chat"
                      }
                    >
                      <Icon name={autoScrollPaused ? "play" : "pause"} />
                      <span>{autoScrollPaused ? "Retomar" : "Pausar"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={clearChat}
                      disabled={!messages.length}
                      aria-label="Limpar chat"
                    >
                      <Icon name="trash" />
                      <span>Limpar</span>
                    </button>
                  </div>
                  <div className="toolGroup">
                    <button
                      type="button"
                      onClick={() => changeFeedFont(-1)}
                      disabled={chatSettings.feedFontSize === "small"}
                      aria-label="Diminuir tamanho da fonte"
                    >
                      A-
                    </button>
                    <button
                      type="button"
                      onClick={() => changeFeedFont(1)}
                      disabled={chatSettings.feedFontSize === "large"}
                      aria-label="Aumentar tamanho da fonte"
                    >
                      A+
                    </button>
                  </div>
                  <button
                    type="button"
                    className="moderationTool"
                    onClick={() => setModerationOpen(true)}
                  >
                    <Icon name="shield" />
                    <span>Moderação</span>
                  </button>
                </div>
              </div>

              {needsAccountConnection ? (
                <a
                  className={`composerConnectCta ${selected}`}
                  href={`/api/auth/${selected}/start${popupMode ? "?popup=1" : ""}`}
                >
                  Conecte sua conta {selected === "youtube" ? "do" : "da"}{" "}
                  {labels[selected]} para enviar mensagens
                </a>
              ) : (
                <>
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
  
                {!canSend && (
                  <div className="composerStatus">
                    {!selectedTarget ? (
                      `Selecione um canal da ${labels[selected]} para enviar.`
                    ) : !auth[selected].configured ? (
                      `Envio pela ${labels[selected]} indisponível neste ambiente.`
                    ) : (
                      <a
                        href={`/api/auth/${selected}/start${popupMode ? "?popup=1" : ""}`}
                      >
                        Conectar {labels[selected]} para enviar mensagens como
                        você
                      </a>
                    )}
                  </div>
                )}
                <div className="inputRow">
                  <div className="textWrap">
                    <button
                      type="button"
                      className={`emotePickerButton ${pickerOpen ? "active" : ""}`}
                      onClick={() => setPickerOpen((value) => !value)}
                      aria-label="Abrir menu de emotes"
                      title="Emotes"
                    >
                      <Icon name="smile" />
                    </button>
  
                    <button
                      type="button"
                      className="commandsButton"
                      aria-label="Comandos do chat"
                      aria-expanded={commandsOpen}
                      onClick={() => setCommandsOpen((v) => !v)}
                    >
                      <Icon name="terminal" />
                    </button>
                    {commandsOpen && (
                      <div className="commandsPopover">
                        <strong>Comandos de moderação</strong>
                        {["/timeout", "/ban", "/unban"].map((command) => (
                          <button
                            type="button"
                            key={command}
                            onClick={() => {
                              insertPlainComposerText(command + " ");
                              setCommandsOpen(false);
                            }}
                            disabled={!canSend || !canModerate(selected)}
                          >
                            {command}
                          </button>
                        ))}
                        <small>
                          Disponíveis para moderadores e donos do canal. /timeout
                          usuário minutos · /ban usuário · /unban usuário
                        </small>
                        <button
                          type="button"
                          onClick={() => setCommandsOpen(false)}
                        >
                          Fechar
                        </button>
                      </div>
                    )}
                    {pickerOpen && (
                      <EmotePicker
                        platform={selected}
                        emotes={pickerEmotes}
                        loading={pickerLoading}
                        scopeUpgrade={pickerScopeUpgradeRequired}
                        popup={popupMode}
                        onInsert={insertPickerEmote}
                        onClose={() => setPickerOpen(false)}
                      />
                    )}
  
                    <div
                      ref={composerEditorRef}
                      className="composerRichEditor"
                      contentEditable={canSend}
                      aria-disabled={!canSend}
                      suppressContentEditableWarning
                      role="textbox"
                      aria-multiline="true"
                      aria-label="Mensagem"
                      data-placeholder={
                        replyingTo?.platform === selected
                          ? "Responder a " +
                            replyingTo.authorName +
                            " como " +
                            (auth[selected]?.userName || "você") +
                            "..."
                          : "Digite uma mensagem ou comando…"
                      }
                      spellCheck={false}
                      onInput={() => {
                        upgradeTypedComposerEmote();
                        syncComposerText();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          event.currentTarget.closest("form")?.requestSubmit();
                        } else if (event.key === "Enter" && event.shiftKey) {
                          event.preventDefault();
                          insertPlainComposerText("\n");
                        }
                      }}
                      onPaste={(event) => {
                        event.preventDefault();
                        insertPlainComposerText(
                          event.clipboardData.getData("text/plain"),
                        );
                      }}
                    />
                    <span className="counter">
                      {[...text].length}/{maxLength}
                    </span>
                  </div>
                  <button
                    className={`sendButton ${selected}`}
                    disabled={!canSend || sending || !text.trim()}
                  >
                    <Icon name="send" />
                    {sending ? "Enviando…" : "Enviar"}
                  </button>
                </div>
  
                {error && <div className="errorBox">{error}</div>}
                </>
              )}
            </form>
          )}
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
            ref={profileDialogRef}
            className={`userProfileDialog ${profileOpen.platform} ${profileDragging ? "dragging" : ""}`}
            style={{
              transform: `translate3d(${profilePosition.x}px, ${profilePosition.y}px, 0)`,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-profile-title"
          >
            <button
              type="button"
              className="userProfileClose"
              onClick={() => {
                setProfileOpen(null);
                setProfileDragging(false);
                profileDragRef.current = null;
              }}
              aria-label="Fechar perfil"
              title="Fechar"
            >
              ×
            </button>

            <div
              className="userProfileHeader"
              onPointerDown={beginProfileDrag}
              onPointerMove={moveProfileDrag}
              onPointerUp={endProfileDrag}
              onPointerCancel={endProfileDrag}
            >
              <span
                className={`userProfilePlatformPill ${profileOpen.platform}`}
              >
                <span className="userProfilePlatformDot" aria-hidden="true" />
                {labels[profileOpen.platform]}
              </span>

              <div className={`userProfileAvatar ${profileOpen.platform}`}>
                <span className="avatarFallback" aria-hidden="true">
                  {avatarFallback(profileOpen.authorName)}
                </span>
                {profileOpen.authorAvatar && (
                  <img
                    src={profileOpen.authorAvatar}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                      setBrokenAvatarUrls((previous) => ({
                        ...previous,
                        [event.currentTarget.src]: true,
                      }));
                    }}
                  />
                )}
                <span
                  className={`userProfileAvatarPlatform ${profileOpen.platform}`}
                  aria-hidden="true"
                >
                  <PlatformIcon platform={profileOpen.platform} />
                </span>
              </div>

              <div className="userProfileIdentity">
                <div className="userProfileNameRow">
                  {chatSettings.showPlatformBadges && profileRecentMessages[0]
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
                    {profileOpen.profileUrl ? (
                      <a
                        className="userProfileNameLink"
                        href={profileOpen.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Abrir perfil na ${labels[profileOpen.platform]}`}
                      >
                        {profileOpen.authorName}
                      </a>
                    ) : (
                      profileOpen.authorName
                    )}
                  </h2>
                </div>
              </div>
            </div>

            <div className="profileLocalActions">
              <button
                type="button"
                className="profileAction mention"
                onClick={() => {
                  const profile = profileOpen;
                  setSelected(profile.platform);
                  setReplyingTo(null);
                  setProfileOpen(null);
                  requestAnimationFrame(() =>
                    insertPlainComposerText(`@${profile.authorName} `),
                  );
                }}
              >
                <Icon name="at" /> Mencionar
              </button>

              {canModerate(profileOpen.platform) &&
                auth[profileOpen.platform]?.moderationReady && (
                  <button
                    type="button"
                    className="profileAction timeout"
                    onClick={() => moderateProfile("timeout")}
                    disabled={Boolean(moderationBusy)}
                  >
                    <Icon name="history" /> Timeout
                  </button>
                )}

              <button
                type="button"
                className="profileAction mute"
                title="Ocultar mensagens deste usuário somente nesta sessão"
                onClick={() => {
                  setMutedProfiles((profiles) => [...profiles, profileOpen]);
                  setProfileOpen(null);
                }}
              >
                <Icon name="pause" /> Silenciar
              </button>

              {canModerate(profileOpen.platform) &&
                auth[profileOpen.platform]?.moderationReady && (
                  <button
                    type="button"
                    className="profileAction ban"
                    onClick={() => moderateProfile("ban")}
                    disabled={Boolean(moderationBusy)}
                  >
                    <Icon name="shield" /> Banir
                  </button>
                )}
            </div>

            {canModerate(profileOpen.platform) &&
              (!auth[profileOpen.platform]?.moderationReady ||
                moderationFeedback) && (
                <div className="userProfileModeration">
                  {!auth[profileOpen.platform]?.moderationReady && (
                    <a
                      className="moderationReconnect"
                      href={`/api/auth/${profileOpen.platform}/start${popupMode ? "?popup=1" : ""}`}
                    >
                      Reconectar para ativar moderação
                    </a>
                  )}
                  {moderationFeedback && (
                    <div
                      className={`moderationFeedback ${moderationFeedback.type}`}
                      role="status"
                    >
                      {moderationFeedback.text}
                    </div>
                  )}
                </div>
              )}

            <div className="userProfileMessagesHeader">
              <span className="userProfileMessagesTitle">
                <Icon name="history" />
                <strong>Últimas mensagens</strong>
              </span>
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
                    {chatSettings.showTimestamps && (
                      <time>{timeLabel(message.created_at)}</time>
                    )}
                    <span className="userProfileMessageText">
                      {renderMessageText(message)}
                    </span>
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

      {emotePreview && (
        <div
          className="chatEmotePreview"
          style={{ left: emotePreview.left, top: emotePreview.top }}
          role="tooltip"
          aria-hidden="true"
        >
          <img src={emotePreview.url} alt="" draggable={false} />
          <strong>{emotePreview.code}</strong>
          <span>{emotePreview.provider}</span>
        </div>
      )}

      {settingsOpen && (
        <SettingsDialog
          draft={settingsDraft}
          onChange={setSettingsDraft}
          onClose={closeSettings}
          onSave={saveSettings}
          onRestore={restoreDefaultSettings}
          accounts={renderSidebarContent()}
        />
      )}
      {moderationOpen && (
        <Dialog
          titleId="moderation-title"
          onClose={() => setModerationOpen(false)}
        >
          <div className="popupSettingsHeader">
            <Icon name="shield" />
            <strong id="moderation-title">Moderação</strong>
            <button
              type="button"
              onClick={() => setModerationOpen(false)}
              aria-label="Fechar moderação"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="popupSettingsBody">
            <p className="moderationHelp">
              Abra o perfil de um participante para moderar. As ações
              disponíveis dependem das permissões da sua conta no canal.
            </p>
            {platforms.map((p) => (
              <div className="moderationStatus" key={p}>
                <span className={`platformIcon ${p}`}>
                  <PlatformIcon platform={p} />
                </span>
                <strong>{labels[p]}</strong>
                <span>
                  {!auth[p].connected
                    ? "Conta desconectada"
                    : canModerate(p)
                      ? auth[p].moderationReady
                        ? "Moderação disponível"
                        : "Reconexão necessária"
                      : "Sem permissão de moderação"}
                </span>
                {auth[p].connected &&
                  canModerate(p) &&
                  !auth[p].moderationReady && (
                    <a
                      href={`/api/auth/${p}/start${popupMode ? "?popup=1" : ""}`}
                    >
                      Reconectar
                    </a>
                  )}
              </div>
            ))}
            <button
              type="button"
              className="cancelSettingsButton"
              onClick={() => {
                setModerationOpen(false);
                openSettings();
              }}
            >
              Configurar filtros e bloqueio de links
            </button>
          </div>
        </Dialog>
      )}

      {!popupMode && (
        <footer className="siteFooter">
          <span>© {new Date().getFullYear()} aCHATado</span>
          <nav aria-label="Links legais">
            <button
              type="button"
              className="footerLink"
              onClick={() => {
                setOverlayCopied(false);
                setOverlayLink(overlayUrl(window.location.origin, channels));
              }}
            >
              OBS Overlay URL
            </button>
            <a href="/privacy">Política de Privacidade</a>
            <a href="/terms">Termos de Serviço</a>
          </nav>
        </footer>
      )}
      {overlayLink && (
        <Dialog
          titleId="overlay-title"
          onClose={() => setOverlayLink("")}
          className="overlayUrlDialog"
        >
          <h2 id="overlay-title">Overlay do chat</h2>
          <button
            type="button"
            className="overlayUrlClose"
            onClick={() => setOverlayLink("")}
            aria-label="Fechar overlay"
          >
            <Icon name="close" />
          </button>
          <p>
            Adicione esta URL como fonte de navegador no OBS. Ela exibe o feed
            dos canais selecionados sobre fundo transparente, sem controles de
            envio.
          </p>
          <input
            aria-label="URL do overlay"
            readOnly
            value={overlayLink}
            onFocus={(event) => event.target.select()}
          />
          {!activeChannelCount && (
            <p>Selecione pelo menos um canal antes de copiar a URL.</p>
          )}
          <div className="overlayUrlActions">
            <button
              type="button"
              disabled={!activeChannelCount}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(overlayLink);
                  setOverlayCopied(true);
                } catch {
                  setOverlayCopied(false);
                }
              }}
            >
              {overlayCopied ? "Copiado" : "Copiar URL"}
            </button>
            <a href={overlayLink} target="_blank" rel="noopener noreferrer">
              Pré-visualizar
            </a>
          </div>
        </Dialog>
      )}
    </main>
  );
}
