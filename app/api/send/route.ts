import { NextRequest, NextResponse } from "next/server";
import { readPlatformSession, writePlatformSession } from "@/lib/session";
import { refreshPlatformSession } from "@/lib/platform-auth";
import { findActiveYouTubeLive, isYouTubeQuotaError } from "@/lib/youtube";
import { getState, setState } from "@/lib/store";
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
    const replyToMessageId =
      typeof payload.replyToMessageId === "string"
        ? payload.replyToMessageId.trim()
        : "";
    let liveChatId = typeof payload.liveChatId === "string" ? payload.liveChatId.trim() : "";
    let youtubeVideoId = "";

    if (!isPlatform(platform)) return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Digite uma mensagem" }, { status: 400 });
    if (!channelId) return NextResponse.json({ error: `Selecione primeiro o canal da ${platform}.` }, { status: 400 });
    if (replyToMessageId && platform === "youtube") {
      return NextResponse.json(
        { error: "O YouTube Live Chat não oferece respostas nativas pela API." },
        { status: 400 },
      );
    }
    const max = platform === "youtube" ? 200 : 500;
    if ([...message].length > max) {
      return NextResponse.json({ error: `Limite de ${max} caracteres para ${platform}.` }, { status: 400 });
    }

    const stored = await readPlatformSession(platform);
    if (!stored) return NextResponse.json({ error: `Conecte sua conta ${platform} antes de enviar.` }, { status: 401 });
    const session = await refreshPlatformSession(platform, stored);
    if (
      platform === "youtube" &&
      session.scope?.length &&
      !session.scope.includes("https://www.googleapis.com/auth/youtube.force-ssl")
    ) {
      return NextResponse.json(
        { error: "O escopo youtube.force-ssl não está presente nesta autorização. Desconecte a conta do YouTube e conecte novamente." },
        { status: 403 },
      );
    }

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
        body: JSON.stringify({
          broadcaster_id: channelId,
          sender_id: session.userId,
          message,
          ...(replyToMessageId
            ? { reply_parent_message_id: replyToMessageId }
            : {}),
        }),
      });
    } else if (platform === "kick") {
      upstream = await fetch("https://api.kick.com/public/v1/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          broadcaster_user_id: Number(channelId),
          content: message,
          type: "user",
          ...(replyToMessageId
            ? { reply_to_message_id: replyToMessageId }
            : {}),
        }),
      });
    } else {
      const stateKey = `youtube-channel:${channelId}`;
      const cached = await getState<{
        liveChatId?: string | null;
        videoId?: string | null;
        nextResolveAt?: number;
      }>(stateKey);

      if (cached?.liveChatId && cached?.videoId && cached.nextResolveAt && Date.now() < cached.nextResolveAt) {
        liveChatId = cached.liveChatId;
        youtubeVideoId = cached.videoId;
      } else {
        try {
          const live = await findActiveYouTubeLive(channelId);
          liveChatId = live?.liveChatId || "";
          youtubeVideoId = live?.videoId || "";
          await setState(stateKey, {
            liveChatId: liveChatId || null,
            videoId: youtubeVideoId || null,
            nextResolveAt: Date.now() + (liveChatId ? 30 * 60_000 : 2 * 60_000),
          });
        } catch (error) {
          if (isYouTubeQuotaError(error)) {
            return NextResponse.json(
              { error: "A cota da API do YouTube está temporariamente esgotada. O envio voltará automaticamente quando a cota for liberada." },
              { status: 429 },
            );
          }
          throw error;
        }
      }

      if (!liveChatId || !youtubeVideoId) {
        return NextResponse.json(
          { error: "Não foi possível identificar a live atual desse canal do YouTube com chat ativo." },
          { status: 409 },
        );
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
      if (platform === "youtube") {
        console.warn("[youtube-send] rejected", {
          status: upstream.status,
          reason: data?.error?.errors?.[0]?.reason || data?.error?.status || "unknown",
        });
      }
      return NextResponse.json(
        { error: errorMessage, details: data },
        { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502 },
      );
    }

    if (platform === "youtube") {
      const youtubeMessageId =
        typeof data?.id === "string" && data.id.trim() ? data.id.trim() : "";

      // A documentação do liveChatMessages.insert define que uma chamada
      // bem-sucedida devolve um recurso liveChatMessage, cujo id identifica a
      // mensagem criada. Não declaramos sucesso ao navegador sem essa prova.
      if (!youtubeMessageId) {
        console.error("[youtube-send] invalid success response", {
          status: upstream.status,
          liveChatId: liveChatId.slice(0, 12),
        });
        return NextResponse.json(
          {
            error:
              "O YouTube respondeu sem confirmar o ID da mensagem. O envio não será marcado como concluído.",
          },
          { status: 502 },
        );
      }

      console.info("[youtube-send] success", {
        messageId: youtubeMessageId,
        liveChatId: liveChatId.slice(0, 12),
        videoId: youtubeVideoId,
      });
    }

    const sendResult = data?.data?.[0] ?? data?.data;
    if (sendResult?.is_sent === false) {
      const reason = sendResult?.drop_reason?.message || sendResult?.drop_reason?.code || "A plataforma recusou a mensagem.";
      return NextResponse.json({ error: reason, details: data }, { status: 422 });
    }

    const response = NextResponse.json({
      ok: true,
      platform,
      result: data,
      ...(platform === "youtube"
        ? {
            liveChatId,
            videoId: youtubeVideoId,
            watchUrl: youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : undefined,
          }
        : {}),
    });
    if (session.accessToken !== stored.accessToken) writePlatformSession(response, platform, session);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao enviar mensagem" }, { status: 500 });
  }
}
