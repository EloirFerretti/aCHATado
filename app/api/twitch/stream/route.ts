import { NextRequest } from "next/server";
import { refreshPlatformSession } from "@/lib/platform-auth";
import { readPlatformSession } from "@/lib/session";
import { insertMessage } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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

  let socket: WebSocket | null = null;
  let stopped = false;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const close = () => {
    if (stopped) return;
    stopped = true;
    try { socket?.close(); } catch { /* noop */ }
    try { controllerRef?.close(); } catch { /* noop */ }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      controller.enqueue(sse("status", { connected: false, phase: "connecting" }));

      const connect = (url = "wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30") => {
        if (stopped) return;
        const currentSocket = new WebSocket(url);
        socket = currentSocket;

        currentSocket.onmessage = async (message) => {
          if (stopped) return;
          try {
            const payload = JSON.parse(String(message.data));
            const kind = payload?.metadata?.message_type;

            if (kind === "session_welcome") {
              const sessionId = payload?.payload?.session?.id;
              if (!sessionId) throw new Error("Twitch não retornou session_id do EventSub.");

              const sub = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${session.accessToken}`,
                  "Client-Id": process.env.TWITCH_CLIENT_ID || "",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  type: "channel.chat.message",
                  version: "1",
                  condition: {
                    broadcaster_user_id: channelId,
                    user_id: String(session.userId),
                  },
                  transport: { method: "websocket", session_id: sessionId },
                }),
              });

              const text = await sub.text();
              let json: any = {};
              try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
              if (!sub.ok) throw new Error(json?.message || `Twitch EventSub respondeu ${sub.status}.`);

              controller.enqueue(sse("status", { connected: true, phase: "subscribed" }));
              return;
            }

            if (kind === "session_reconnect") {
              const reconnectUrl = payload?.payload?.session?.reconnect_url;
              if (reconnectUrl) {
                connect(reconnectUrl);
                try { currentSocket.close(); } catch { /* noop */ }
              }
              return;
            }

            if (kind !== "notification" || payload?.payload?.subscription?.type !== "channel.chat.message") return;
            const e = payload?.payload?.event;
            if (!e?.message_id) return;

            await insertMessage({
              platform: "twitch",
              platform_message_id: String(e.message_id),
              channel_id: e.broadcaster_user_id ? String(e.broadcaster_user_id) : channelId,
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

            controller.enqueue(sse("chat", { messageId: String(e.message_id) }));
          } catch (error) {
            if (!stopped) {
              controller.enqueue(sse("error", {
                message: error instanceof Error ? error.message : "Erro no chat da Twitch",
              }));
            }
          }
        };

        currentSocket.onerror = () => {
          if (!stopped) controller.enqueue(sse("error", { message: "Conexão em tempo real com a Twitch falhou." }));
        };

        currentSocket.onclose = () => {
          if (!stopped && socket === currentSocket) {
            controller.enqueue(sse("status", { connected: false, phase: "closed" }));
            setTimeout(() => connect(), 1500);
          }
        };
      };

      connect();
      req.signal.addEventListener("abort", close, { once: true });
    },
    cancel() { close(); },
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
