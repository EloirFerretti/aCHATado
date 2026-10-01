"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Platform = "twitch" | "kick" | "youtube";
type Message = {
  id?: number;
  platform: Platform;
  platform_message_id: string;
  channel_id?: string | null;
  author_name: string;
  author_avatar?: string | null;
  author_color?: string | null;
  message: string;
  created_at: string;
  badges?: unknown[];
  raw?: any;
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
type PickerProvider = "all" | "twitch" | "youtube" | "bttv" | "ffz" | "7tv";
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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<"all" | Platform>("all");
  const [selected, setSelected] = useState<Platform>("twitch");
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerEmotes, setPickerEmotes] = useState<PickerEmote[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerProvider, setPickerProvider] = useState<PickerProvider>("all");
  const [pickerScopeUpgradeRequired, setPickerScopeUpgradeRequired] = useState(false);
  const [popupMode, setPopupMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [ready, setReady] = useState(false);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const [unseenMessageCount, setUnseenMessageCount] = useState(0);
  const lastId = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autoResolveAfterAuth = useRef(false);
  const autoScrollPausedRef = useRef(false);
  const autoScrollingRef = useRef(false);
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
      if (initial) return incoming;
      const known = new Set(prev.map((m) => `${m.platform}:${m.platform_message_id}`));
      return [
        ...prev,
        ...incoming.filter((m) => !known.has(`${m.platform}:${m.platform_message_id}`)),
      ].slice(-500);
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
          if (prev.some((m) => `${m.platform}:${m.platform_message_id}` === key)) return prev;
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

  function scrollToLatest(behavior: ScrollBehavior = "smooth") {
    const list = messageListRef.current;
    if (!list) return;

    autoScrollingRef.current = true;
    setAutoScrollState(false);
    list.scrollTo({ top: list.scrollHeight, behavior });

    if (behavior === "smooth") {
      window.setTimeout(() => {
        autoScrollingRef.current = false;
        const current = messageListRef.current;
        if (current) current.scrollTop = current.scrollHeight;
      }, 450);
    } else {
      requestAnimationFrame(() => {
        autoScrollingRef.current = false;
      });
    }
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

  useEffect(() => {
    const previous = previousMessageCountRef.current;
    const added = Math.max(0, messages.length - previous);
    previousMessageCountRef.current = messages.length;

    if (autoScrollPausedRef.current) {
      if (added > 0) {
        setUnseenMessageCount((count) => count + added);
      }
      return;
    }

    requestAnimationFrame(() => scrollToLatest("auto"));
  }, [messages.length]);

  useEffect(() => {
    previousMessageCountRef.current = messages.length;
    requestAnimationFrame(() => scrollToLatest("auto"));
  }, [filter]);

  const visible = useMemo(
    () => messages.filter((m) => filter === "all" || m.platform === filter),
    [messages, filter],
  );
  const counts = useMemo(() => ({
    twitch: messages.filter((m) => m.platform === "twitch").length,
    kick: messages.filter((m) => m.platform === "kick").length,
    youtube: messages.filter((m) => m.platform === "youtube").length,
  }), [messages]);

  const activeChannelCount = platforms.filter((p) => channels[p]?.channelId).length;

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
          message: text,
          channelId: target.channelId,
          liveChatId: target.liveChatId || undefined,
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
    const params = new URLSearchParams({
      platform: selected,
      channelId: selectedTarget.channelId,
    });
    if (selectedTarget.videoId) params.set("videoId", selectedTarget.videoId);

    fetch(`/api/emote-picker?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Falha ao carregar emotes.");
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        setPickerEmotes(Array.isArray(json.emotes) ? json.emotes : []);
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
      })
      .catch(() => {
        if (!cancelled) setPickerEmotes([]);
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    selected,
    selectedTarget?.channelId,
    selectedTarget?.videoId,
    auth[selected]?.connected,
  ]);

  const pickerProviders = useMemo(() => {
    const available = new Set(pickerEmotes.map((emote) => emote.provider));
    return (["all", "twitch", "youtube", "7tv", "bttv", "ffz"] as PickerProvider[])
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
          >
            {visible.map((m) => (
              <article className="message" key={`${m.platform}-${m.platform_message_id}`}>
                <div className={`avatarRing ${m.platform}`}>
                  {m.author_avatar
                    ? <img src={m.author_avatar} alt="" />
                    : <span>{avatarFallback(m.author_name)}</span>}
                  <span className={`miniPlatform ${m.platform}`}>{initials[m.platform]}</span>
                </div>
                <div className="messageBody">
                  <div className="meta">
                    <strong style={m.author_color ? { color: m.author_color } : undefined}>
                      {m.author_name}
                    </strong>
                    <span className={`platformLabel ${m.platform}`}>{labels[m.platform]}</span>
                    <time>{timeLabel(m.created_at)}</time>
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
                <div className="textWrap">
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

                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, maxLength))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder={`Mensagem como ${auth[selected]?.userName || "você"} em ${selectedTarget.channelName}...`}
                    rows={1}
                    maxLength={maxLength}
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
