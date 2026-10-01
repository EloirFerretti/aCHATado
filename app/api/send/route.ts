import { NextRequest, NextResponse } from "next/server";
import { readPlatformSession, writePlatformSession } from "@/lib/session";
import { refreshPlatformSession } from "@/lib/platform-auth";
import { getYouTubeLiveChatId } from "@/lib/youtube";
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
    if (!isPlatform(platform)) return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Digite uma mensagem" }, { status: 400 });
    const max = platform === "youtube" ? 200 : 500;
    if ([...message].length > max) return NextResponse.json({ error: `Limite de ${max} caracteres para ${platform}.` }, { status: 400 });

    const stored = await readPlatformSession(platform);
    if (!stored) return NextResponse.json({ error: `Conecte sua conta ${platform} antes de enviar.` }, { status: 401 });
    const session = await refreshPlatformSession(platform, stored);

    let upstream: Response;
    if (platform === "twitch") {
      const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
      if (!broadcasterId || !session.userId) throw new Error("TWITCH_BROADCASTER_ID ou usuário não configurado.");
      upstream = await fetch("https://api.twitch.tv/helix/chat/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          broadcaster_id: broadcasterId,
          sender_id: session.userId,
          message,
        }),
      });
    } else if (platform === "kick") {
      const broadcasterId = Number(process.env.KICK_BROADCASTER_ID || 0);
      if (!broadcasterId) throw new Error("KICK_BROADCASTER_ID não configurado.");
      upstream = await fetch("https://api.kick.com/public/v1/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          broadcaster_user_id: broadcasterId,
          content: message,
          type: "user",
        }),
      });
    } else {
      const liveChatId = await getYouTubeLiveChatId();
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
    let data: unknown;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!upstream.ok) {
      const errorMessage = (data as any)?.message || (data as any)?.error?.message || `A plataforma respondeu ${upstream.status}.`;
      return NextResponse.json({ error: errorMessage, details: data }, { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 });
    }

    const sendResult = (data as any)?.data?.[0] ?? (data as any)?.data;
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
