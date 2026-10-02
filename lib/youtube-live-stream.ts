import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { getState, insertMessages, setState } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

type StreamEntry = {
  liveChatId: string;
  channelId: string;
  call: any | null;
  lastTouched: number;
  nextPageToken?: string;
  status: "connecting" | "streaming" | "backoff" | "ended";
  stopped: boolean;
  retryTimer?: ReturnType<typeof setTimeout>;
  idleTimer?: ReturnType<typeof setInterval>;
  queue: Promise<void>;
  lastStatePersistedAt: number;
  accessToken?: string;
  lastError?: { code?: number; message: string; at: number };
  readyPromise: Promise<void>;
  resolveReady: () => void;
};

type StreamRegistry = Map<string, StreamEntry>;

const registryKey = "__achatado_youtube_streams__";
const clientKey = "__achatado_youtube_grpc_client__";
const IDLE_TIMEOUT_MS = 3 * 60_000;

function registry(): StreamRegistry {
  const root = globalThis as typeof globalThis & { [registryKey]?: StreamRegistry };
  if (!root[registryKey]) root[registryKey] = new Map();
  return root[registryKey]!;
}

function youtubeClient() {
  const root = globalThis as typeof globalThis & { [clientKey]?: any };
  if (root[clientKey]) return root[clientKey];

  const definition = protoLoader.loadSync(
    path.join(process.cwd(), "proto", "youtube_live_chat.proto"),
    {
      keepCase: false,
      longs: String,
      enums: Number,
      defaults: false,
      oneofs: true,
    },
  );
  const loaded = grpc.loadPackageDefinition(definition) as any;
  const Service = loaded.youtube.api.v3.V3DataLiveChatMessageService;
  root[clientKey] = new Service(
    "dns:///youtube.googleapis.com:443",
    grpc.credentials.createSsl(),
  );
  return root[clientKey];
}

function messageType(value: unknown) {
  const types: Record<number, string> = {
    1: "textMessageEvent",
    2: "tombstone",
    3: "fanFundingEvent",
    4: "chatEndedEvent",
    5: "sponsorOnlyModeStartedEvent",
    6: "sponsorOnlyModeEndedEvent",
    7: "newSponsorEvent",
    10: "userBannedEvent",
    15: "superChatEvent",
    16: "superStickerEvent",
    17: "memberMilestoneChatEvent",
    18: "membershipGiftingEvent",
    19: "giftMembershipReceivedEvent",
    20: "pollEvent",
    21: "giftEvent",
  };
  return types[Number(value)] || "event";
}

function toChatMessage(item: any, channelId: string): ChatMessage | null {
  const snippet = item?.snippet || {};
  const author = item?.authorDetails || {};
  const text =
    snippet?.displayMessage ||
    snippet?.textMessageDetails?.messageText ||
    "";
  if (!item?.id || !text) return null;

  return {
    platform: "youtube",
    platform_message_id: String(item.id),
    channel_id: channelId,
    author_id: author?.channelId ? String(author.channelId) : null,
    author_name: author?.displayName || "YouTube user",
    author_avatar: author?.profileImageUrl || null,
    author_color: null,
    message: String(text),
    message_type: messageType(snippet?.type),
    badges: [
      ...(author?.isChatOwner ? ["owner"] : []),
      ...(author?.isChatModerator ? ["moderator"] : []),
      ...(author?.isChatSponsor ? ["member"] : []),
      ...(author?.isVerified ? ["verified"] : []),
    ],
    created_at: snippet?.publishedAt || new Date().toISOString(),
    raw: item,
  };
}

async function persistStreamState(entry: StreamEntry, force = false) {
  const now = Date.now();
  if (!force && now - entry.lastStatePersistedAt < 10_000) return;
  entry.lastStatePersistedAt = now;
  await setState(`youtube-stream:${entry.liveChatId}`, {
    nextPageToken: entry.nextPageToken || null,
    updatedAt: now,
  });
}

async function markEnded(entry: StreamEntry) {
  entry.status = "ended";
  entry.stopped = true;
  if (entry.retryTimer) clearTimeout(entry.retryTimer);
  if (entry.idleTimer) clearInterval(entry.idleTimer);
  try { entry.call?.cancel(); } catch { /* noop */ }
  await setState(`youtube-channel:${entry.channelId}`, {
    liveChatId: null,
    videoId: null,
    nextResolveAt: Date.now(),
  });
  registry().delete(entry.liveChatId);
}

function scheduleReconnect(entry: StreamEntry, delayMs: number) {
  if (entry.stopped) return;
  entry.status = "backoff";
  if (entry.retryTimer) clearTimeout(entry.retryTimer);
  entry.retryTimer = setTimeout(() => {
    if (!entry.stopped) startStream(entry);
  }, delayMs);
}

function scheduleResume(entry: StreamEntry, delayMs = 0) {
  if (entry.stopped) return;
  // O StreamList pode concluir uma rodada normalmente. O exemplo oficial do
  // YouTube abre outra chamada usando o nextPageToken; isso não é uma falha e
  // não deve colocar o stream em backoff nem acionar o fallback REST.
  entry.status = "connecting";
  if (entry.retryTimer) clearTimeout(entry.retryTimer);
  entry.retryTimer = setTimeout(() => {
    if (!entry.stopped) startStream(entry);
  }, delayMs);
}

function startStream(entry: StreamEntry) {
  if (entry.stopped) return;
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!entry.accessToken && !apiKey) {
    entry.status = "backoff";
    entry.lastError = {
      message: "Nenhuma credencial do YouTube disponível para o stream.",
      at: Date.now(),
    };
    entry.resolveReady();
    return;
  }

  entry.status = "connecting";
  entry.lastError = undefined;
  const metadata = new grpc.Metadata();
  if (entry.accessToken) {
    metadata.set("authorization", `Bearer ${entry.accessToken}`);
  } else if (apiKey) {
    metadata.set("x-goog-api-key", apiKey);
  }

  const request: Record<string, unknown> = {
    liveChatId: entry.liveChatId,
    part: ["id", "snippet", "authorDetails"],
    profileImageSize: 48,
  };
  if (entry.nextPageToken) request.pageToken = entry.nextPageToken;

  const call = youtubeClient().StreamList(request, metadata);
  entry.call = call;

  call.on("data", (response: any) => {
    if (entry.stopped) return;
    entry.status = "streaming";
    entry.lastError = undefined;
    entry.resolveReady();
    if (response?.nextPageToken) entry.nextPageToken = String(response.nextPageToken);
    console.info("[youtube-stream] response", {
      liveChatId: entry.liveChatId.slice(0, 12),
      items: Array.isArray(response?.items) ? response.items.length : 0,
      hasNextPageToken: Boolean(response?.nextPageToken),
      offline: Boolean(response?.offlineAt),
    });

    entry.queue = entry.queue.then(async () => {
      const messages = (response?.items || [])
        .map((item: any) => toChatMessage(item, entry.channelId))
        .filter(Boolean) as ChatMessage[];
      if (messages.length) await insertMessages(messages);
      await persistStreamState(entry, Boolean(response?.offlineAt));
      if (response?.offlineAt) await markEnded(entry);
    }).catch((error) => {
      console.error("[youtube-stream] persist/process error", {
        liveChatId: entry.liveChatId.slice(0, 12),
        message: error instanceof Error ? error.message : String(error),
      });
    });
  });

  call.on("error", (error: any) => {
    if (entry.stopped) return;
    const text = String(error?.details || error?.message || "");
    const code = Number(error?.code);
    entry.lastError = { code, message: text || "Erro gRPC do YouTube.", at: Date.now() };
    entry.resolveReady();

    console.warn("[youtube-stream] grpc error", {
      liveChatId: entry.liveChatId.slice(0, 12),
      code,
      message: text,
    });

    if (
      code === grpc.status.FAILED_PRECONDITION ||
      code === grpc.status.NOT_FOUND ||
      /LIVE_CHAT_ENDED|live chat ended|disabled|not found/i.test(text)
    ) {
      void markEnded(entry);
      return;
    }

    const resourceExhausted = code === grpc.status.RESOURCE_EXHAUSTED;

    // Na documentação do streamList, RESOURCE_EXHAUSTED significa que uma nova
    // leitura foi iniciada antes da taxa de atualização permitida. É um rate
    // limit do stream, não evidência suficiente de cota diária esgotada.
    scheduleReconnect(entry, resourceExhausted ? 60_000 : 5_000);
  });

  call.on("end", () => {
    if (
      !entry.stopped &&
      entry.status !== "ended" &&
      entry.status !== "backoff"
    ) {
      entry.call = null;
      console.info("[youtube-stream] stream page complete; resuming", {
        liveChatId: entry.liveChatId.slice(0, 12),
        hasNextPageToken: Boolean(entry.nextPageToken),
      });
      scheduleResume(entry);
    }
  });
}

function installIdleWatcher(entry: StreamEntry) {
  entry.idleTimer = setInterval(() => {
    if (Date.now() - entry.lastTouched <= IDLE_TIMEOUT_MS) return;
    entry.stopped = true;
    if (entry.retryTimer) clearTimeout(entry.retryTimer);
    if (entry.idleTimer) clearInterval(entry.idleTimer);
    try { entry.call?.cancel(); } catch { /* noop */ }
    registry().delete(entry.liveChatId);
  }, 30_000);
}

export async function ensureYouTubeLiveChatStream(
  channelId: string,
  liveChatId: string,
  accessToken?: string,
) {
  const existing = registry().get(liveChatId);
  if (existing) {
    existing.lastTouched = Date.now();
    if (accessToken) existing.accessToken = accessToken;
    return {
      active: !existing.stopped && existing.status !== "backoff",
      status: existing.status,
      shared: true,
      lastError: existing.lastError,
    };
  }

  const saved = await getState<{ nextPageToken?: string | null }>(
    `youtube-stream:${liveChatId}`,
  );
  let resolveReady = () => {};
  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const entry: StreamEntry = {
    liveChatId,
    channelId,
    call: null,
    lastTouched: Date.now(),
    nextPageToken: saved?.nextPageToken || undefined,
    status: "connecting",
    stopped: false,
    queue: Promise.resolve(),
    lastStatePersistedAt: 0,
    accessToken,
    readyPromise,
    resolveReady,
  };

  registry().set(liveChatId, entry);
  installIdleWatcher(entry);
  startStream(entry);

  // Aguarda brevemente o primeiro pacote ou erro. Isso permite ao endpoint
  // distinguir um stream saudável de uma falha silenciosa e acionar fallback.
  await Promise.race([
    entry.readyPromise,
    new Promise<void>((resolve) => setTimeout(resolve, 2500)),
  ]);

  return {
    active: !entry.stopped && entry.status !== "backoff",
    status: entry.status,
    shared: false,
    lastError: entry.lastError,
  };
}
