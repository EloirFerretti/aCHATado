import { NextRequest, NextResponse } from "next/server";
import { readPlatformSession, writePlatformSession } from "@/lib/session";
import { refreshPlatformSession } from "@/lib/platform-auth";
import { findActiveYouTubeLive } from "@/lib/youtube";
import type { Platform } from "@/lib/types";

export const runtime = "nodejs";

function isPlatform(value: unknown): value is Platform {
  return value === "twitch" || value === "kick" || value === "youtube";
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const platform = payload.platform;
    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    const channelId = typeof payload.channelId === "string" ? payload.channelId.trim() : "";
    let liveChatId = typeof payload.liveChatId === "string" ? payload.liveChatId.trim() : "";

    if (!isPlatform(platform)) return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Digite uma mensagem" }, { status: 400 });
    if (!channelId) return NextResponse.json({ error: `Selecione primeiro o canal da ${platform}.` }, { status: 400 });
    const max = platform === "youtube" ? 200 : 500;
    if ([...message].length > max) {
      return NextResponse.json({ error: `Limite de ${max} caracteres para ${platform}.` }, { status: 400 });
    }

    const stored = await readPlatformSession(platform);
    if (!stored) return NextResponse.json({ error: `Conecte sua conta ${platform} antes de enviar.` }, { status: 401 });
    const session = await refreshPlatformSession(platform, stored);

    let upstream: Response;
    if (platform === "twitch") {
      if (!session.userId) throw new Error("Não foi possível identificar sua conta Twitch.");
      upstream = await fetch("https://api.twitch.tv/helix/chat/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ broadcaster_id: channelId, sender_id: session.userId, message }),
      });
    } else if (platform === "kick") {
      upstream = await fetch("https://api.kick.com/public/v1/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ broadcaster_user_id: Number(channelId), content: message, type: "user" }),
      });
    } else {
      if (!liveChatId) {
        const live = await findActiveYouTubeLive(channelId);
        liveChatId = live?.liveChatId || "";
      }
      if (!liveChatId) {
        return NextResponse.json({ error: "Esse canal do YouTube não tem uma live com chat ativo agora." }, { status: 409 });
      }
      const u = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
      u.searchParams.set("part", "snippet");
      upstream = await fetch(u, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            liveChatId,
            type: "textMessageEvent",
            textMessageDetails: { messageText: message },
          },
        }),
      });
    }

    const text = await upstream.text();
    let data: any;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!upstream.ok) {
      const errorMessage = data?.message || data?.error?.message || `A plataforma respondeu ${upstream.status}.`;
      return NextResponse.json(
        { error: errorMessage, details: data },
        { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 },
      );
    }

    const sendResult = data?.data?.[0] ?? data?.data;
    if (sendResult?.is_sent === false) {
      const reason = sendResult?.drop_reason?.message || sendResult?.drop_reason?.code || "A plataforma recusou a mensagem.";
      return NextResponse.json({ error: reason, details: data }, { status: 422 });
    }

    const response = NextResponse.json({ ok: true, platform, result: data });
    if (session.accessToken !== stored.accessToken) writePlatformSession(response, platform, session);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao enviar mensagem" }, { status: 500 });
  }
}
