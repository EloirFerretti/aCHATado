import { NextRequest } from "next/server";
import { refreshPlatformSession } from "@/lib/platform-auth";
import { readPlatformSession } from "@/lib/session";
import { insertMessage } from "@/lib/store";
import type { PlatformSession } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

type Listener = ReadableStreamDefaultController<Uint8Array>;
type Entry = {
  key: string;
  channelId: string;
  userId: string;
  session: PlatformSession;
  socket: WebSocket | null;
  listeners: Set<Listener>;
  connected: boolean;
  subscribed: boolean;
  stopped: boolean;
  reconnectTimer?: ReturnType<typeof setTimeout>;
  idleTimer?: ReturnType<typeof setTimeout>;
};

const registryKey = "__achatado_twitch_streams__";

function registry(): Map<string, Entry> {
  const root = globalThis as typeof globalThis & { [registryKey]?: Map<string, Entry> };
  if (!root[registryKey]) root[registryKey] = new Map();
  return root[registryKey]!;
}

function broadcast(entry: Entry, event: string, data: unknown) {
  const payload = sse(event, data);
  for (const listener of [...entry.listeners]) {
    try { listener.enqueue(payload); } catch { entry.listeners.delete(listener); }
  }
}

function stopEntry(entry: Entry) {
  if (entry.stopped) return;
  entry.stopped = true;
  if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
  if (entry.idleTimer) clearTimeout(entry.idleTimer);
  try { entry.socket?.close(); } catch { /* noop */ }
  registry().delete(entry.key);
}

function scheduleIdleStop(entry: Entry) {
  if (entry.listeners.size || entry.stopped) return;
  if (entry.idleTimer) clearTimeout(entry.idleTimer);
  entry.idleTimer = setTimeout(() => {
    if (!entry.listeners.size) stopEntry(entry);
  }, 2 * 60_000);
}

async function subscribe(entry: Entry, sessionId: string) {
  const sub = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${entry.session.accessToken}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "channel.chat.message",
      version: "1",
      condition: {
        broadcaster_user_id: entry.channelId,
        user_id: entry.userId,
      },
      transport: { method: "websocket", session_id: sessionId },
    }),
  });

  const text = await sub.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!sub.ok) throw new Error(json?.message || `Twitch EventSub respondeu ${sub.status}.`);
  entry.subscribed = true;
}

function connect(entry: Entry, url?: string, transferred = false) {
  if (entry.stopped) return;

  const endpoint = url || "wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30";
  const socket = new WebSocket(endpoint);
  entry.socket = socket;
  if (!transferred) entry.subscribed = false;

  socket.onmessage = async (message) => {
    if (entry.stopped || entry.socket !== socket) return;
    try {
      const payload = JSON.parse(String(message.data));
      const kind = payload?.metadata?.message_type;

      if (kind === "session_welcome") {
        const sessionId = payload?.payload?.session?.id;
        if (!sessionId) throw new Error("Twitch não retornou session_id do EventSub.");

        if (!transferred && !entry.subscribed) {
          await subscribe(entry, sessionId);
        }
        entry.connected = true;
        broadcast(entry, "status", { connected: true, phase: "subscribed", shared: true });
        return;
      }

      if (kind === "session_reconnect") {
        const reconnectUrl = payload?.payload?.session?.reconnect_url;
        if (reconnectUrl) {
          const oldSocket = socket;
          connect(entry, reconnectUrl, true);
          setTimeout(() => {
            try { oldSocket.close(); } catch { /* noop */ }
          }, 1000);
        }
        return;
      }

      if (kind !== "notification" || payload?.payload?.subscription?.type !== "channel.chat.message") return;
      const e = payload?.payload?.event;
      if (!e?.message_id) return;

      await insertMessage({
        platform: "twitch",
        platform_message_id: String(e.message_id),
        channel_id: e.broadcaster_user_id ? String(e.broadcaster_user_id) : entry.channelId,
        author_id: e.chatter_user_id ? String(e.chatter_user_id) : null,
        author_name: e.chatter_user_name || e.chatter_user_login || "Twitch user",
        author_avatar: null,
        author_color: e.color || null,
        message: e.message?.text || "",
        message_type: "text",
        badges: Array.isArray(e.badges) ? e.badges : [],
        created_at: payload?.metadata?.message_timestamp || new Date().toISOString(),
        raw: e,
      });

      broadcast(entry, "chat", { messageId: String(e.message_id) });
    } catch (error) {
      broadcast(entry, "error", {
        message: error instanceof Error ? error.message : "Erro no chat da Twitch",
      });
    }
  };

  socket.onerror = () => {
    if (!entry.stopped) {
      broadcast(entry, "error", { message: "Conexão em tempo real com a Twitch falhou." });
    }
  };

  socket.onclose = () => {
    if (entry.stopped || entry.socket !== socket) return;
    entry.connected = false;
    broadcast(entry, "status", { connected: false, phase: "closed" });
    if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
    entry.reconnectTimer = setTimeout(() => connect(entry), 1500);
  };
}

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId")?.trim();
  if (!channelId) return new Response("channelId obrigatório", { status: 400 });

  const stored = await readPlatformSession("twitch");
  if (!stored) return new Response("Conecte sua conta Twitch.", { status: 401 });

  let session;
  try {
    session = await refreshPlatformSession("twitch", stored);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao renovar sessão Twitch.", { status: 401 });
  }

  if (!session.userId) return new Response("Usuário Twitch não identificado.", { status: 401 });
  if (!process.env.TWITCH_CLIENT_ID) return new Response("TWITCH_CLIENT_ID não configurado.", { status: 503 });

  const key = `${session.userId}:${channelId}`;
  let entry = registry().get(key);
  if (!entry || entry.stopped) {
    entry = {
      key,
      channelId,
      userId: String(session.userId),
      session,
      socket: null,
      listeners: new Set(),
      connected: false,
      subscribed: false,
      stopped: false,
    };
    registry().set(key, entry);
    connect(entry);
  } else {
    entry.session = session;
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = undefined;
    }
  }

  const sharedEntry = entry;
  let controllerRef: Listener | null = null;

  const cleanup = () => {
    if (!controllerRef) return;
    sharedEntry.listeners.delete(controllerRef);
    controllerRef = null;
    scheduleIdleStop(sharedEntry);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      sharedEntry.listeners.add(controller);
      controller.enqueue(sse("status", {
        connected: sharedEntry.connected,
        phase: sharedEntry.connected ? "subscribed" : "connecting",
        shared: true,
      }));
      req.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
