import { NextRequest, NextResponse } from "next/server";
import { readPlatformSession, writePlatformSession } from "@/lib/session";
import { refreshPlatformSession } from "@/lib/platform-auth";
import { findActiveYouTubeLive } from "@/lib/youtube";
import { getState, removeMessage, setState } from "@/lib/store";
import type { Platform, PlatformSession } from "@/lib/types";

export const runtime = "nodejs";

type ModerationAction = "ban" | "timeout" | "unban" | "delete_message";

function isPlatform(value: unknown): value is Platform {
  return value === "twitch" || value === "kick" || value === "youtube";
}

function isAction(value: unknown): value is ModerationAction {
  return (
    value === "ban" ||
    value === "timeout" ||
    value === "unban" ||
    value === "delete_message"
  );
}

function requiredScope(platform: Platform, action: ModerationAction) {
  if (platform === "twitch") {
    return action === "delete_message"
      ? "moderator:manage:chat_messages"
      : "moderator:manage:banned_users";
  }
  if (platform === "kick") {
    return action === "delete_message"
      ? "moderation:chat_message:manage"
      : "moderation:ban";
  }
  return "https://www.googleapis.com/auth/youtube.force-ssl";
}

function reconnectMessage(platform: Platform) {
  const name =
    platform === "twitch" ? "Twitch" : platform === "kick" ? "Kick" : "YouTube";
  return `Reconecte sua conta da ${name} para conceder as permissões de moderação.`;
}

function parseUpstreamError(data: any, status: number) {
  return (
    data?.message ||
    data?.error?.message ||
    data?.error_description ||
    data?.error ||
    `A plataforma respondeu ${status}.`
  );
}

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function ensureYouTubeLiveChat(channelId: string, liveChatId: string) {
  if (liveChatId) return liveChatId;
  const live = await findActiveYouTubeLive(channelId);
  return live?.liveChatId || "";
}

async function twitchModeration(
  action: ModerationAction,
  session: PlatformSession,
  channelId: string,
  userId: string,
  messageId: string,
  durationSeconds: number,
  reason: string,
) {
  if (!session.userId) throw new Error("Não foi possível identificar sua conta Twitch.");

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Client-Id": process.env.TWITCH_CLIENT_ID || "",
    "Content-Type": "application/json",
  };

  if (action === "delete_message") {
    const url = new URL("https://api.twitch.tv/helix/moderation/chat");
    url.searchParams.set("broadcaster_id", channelId);
    url.searchParams.set("moderator_id", session.userId);
    url.searchParams.set("message_id", messageId);
    return fetch(url, { method: "DELETE", headers, cache: "no-store" });
  }

  const url = new URL("https://api.twitch.tv/helix/moderation/bans");
  url.searchParams.set("broadcaster_id", channelId);
  url.searchParams.set("moderator_id", session.userId);

  if (action === "unban") {
    url.searchParams.set("user_id", userId);
    return fetch(url, { method: "DELETE", headers, cache: "no-store" });
  }

  return fetch(url, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      data: {
        user_id: userId,
        ...(action === "timeout" ? { duration: durationSeconds } : {}),
        ...(reason ? { reason } : {}),
      },
    }),
  });
}

async function kickModeration(
  action: ModerationAction,
  session: PlatformSession,
  channelId: string,
  userId: string,
  messageId: string,
  durationSeconds: number,
  reason: string,
) {
  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  if (action === "delete_message") {
    return fetch(
      `https://api.kick.com/public/v1/chat/${encodeURIComponent(messageId)}`,
      {
        method: "DELETE",
        headers,
        cache: "no-store",
      },
    );
  }

  const body = {
    broadcaster_user_id: Number(channelId),
    user_id: Number(userId),
    ...(action === "timeout"
      ? { duration: Math.max(1, Math.min(10080, Math.ceil(durationSeconds / 60))) }
      : {}),
    ...(reason ? { reason: reason.slice(0, 100) } : {}),
  };

  return fetch("https://api.kick.com/public/v1/moderation/bans", {
    method: action === "unban" ? "DELETE" : "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify(body),
  });
}

async function youtubeModeration(
  action: ModerationAction,
  session: PlatformSession,
  channelId: string,
  userId: string,
  messageId: string,
  liveChatIdInput: string,
  durationSeconds: number,
  banIdInput: string,
) {
  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  if (action === "delete_message") {
    const url = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
    url.searchParams.set("id", messageId);
    return {
      response: await fetch(url, {
        method: "DELETE",
        headers,
        cache: "no-store",
      }),
      liveChatId: liveChatIdInput,
      stateKey: "",
    };
  }

  const liveChatId = await ensureYouTubeLiveChat(channelId, liveChatIdInput);
  if (!liveChatId) {
    throw new Error("Não foi possível identificar o chat ao vivo atual do YouTube.");
  }

  const stateKey = `youtube-ban:${liveChatId}:${userId}`;

  if (action === "unban") {
    const stored = await getState<{ banId?: string | null }>(stateKey);
    const banId = banIdInput || stored?.banId || "";
    if (!banId) {
      throw new Error(
        "Não encontrei o ID desse ban. O desbanimento automático do YouTube funciona para bans aplicados pelo aCHATado neste navegador ou salvos no banco.",
      );
    }

    const url = new URL("https://www.googleapis.com/youtube/v3/liveChat/bans");
    url.searchParams.set("id", banId);
    return {
      response: await fetch(url, {
        method: "DELETE",
        headers,
        cache: "no-store",
      }),
      liveChatId,
      stateKey,
    };
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/liveChat/bans");
  url.searchParams.set("part", "snippet");
  return {
    response: await fetch(url, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        snippet: {
          liveChatId,
          type: action === "timeout" ? "temporary" : "permanent",
          bannedUserDetails: { channelId: userId },
          ...(action === "timeout"
            ? { banDurationSeconds: Math.max(1, Math.floor(durationSeconds)) }
            : {}),
        },
      }),
    }),
    liveChatId,
    stateKey,
  };
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const platform = payload.platform;
    const action = payload.action;
    const channelId =
      typeof payload.channelId === "string" ? payload.channelId.trim() : "";
    const userId =
      typeof payload.userId === "string" ? payload.userId.trim() : "";
    const messageId =
      typeof payload.messageId === "string" ? payload.messageId.trim() : "";
    const liveChatId =
      typeof payload.liveChatId === "string" ? payload.liveChatId.trim() : "";
    const banId =
      typeof payload.banId === "string" ? payload.banId.trim() : "";
    const reason =
      typeof payload.reason === "string" ? payload.reason.trim().slice(0, 500) : "";
    const durationSeconds = Number(payload.durationSeconds || 0);

    if (!isPlatform(platform) || !isAction(action)) {
      return NextResponse.json({ error: "Ação de moderação inválida." }, { status: 400 });
    }
    if (!channelId) {
      return NextResponse.json({ error: "Canal não identificado." }, { status: 400 });
    }
    if (action === "delete_message" && !messageId) {
      return NextResponse.json({ error: "Mensagem não identificada." }, { status: 400 });
    }
    if (action !== "delete_message" && !userId) {
      return NextResponse.json({ error: "Usuário não identificado." }, { status: 400 });
    }
    if (
      action === "timeout" &&
      (!Number.isFinite(durationSeconds) || durationSeconds < 1)
    ) {
      return NextResponse.json(
        { error: "Informe uma duração válida para o timeout." },
        { status: 400 },
      );
    }

    const stored = await readPlatformSession(platform);
    if (!stored) {
      return NextResponse.json(
        { error: `Conecte sua conta ${platform} antes de moderar.` },
        { status: 401 },
      );
    }

    const session = await refreshPlatformSession(platform, stored);
    const scope = requiredScope(platform, action);
    if (session.scope?.length && !session.scope.includes(scope)) {
      const response = NextResponse.json(
        {
          error: reconnectMessage(platform),
          reconnectRequired: true,
          missingScope: scope,
        },
        { status: 403 },
      );
      if (session.accessToken !== stored.accessToken) {
        writePlatformSession(response, platform, session);
      }
      return response;
    }

    let upstream: Response;
    let youtubeStateKey = "";
    let resolvedLiveChatId = liveChatId;

    if (platform === "twitch") {
      upstream = await twitchModeration(
        action,
        session,
        channelId,
        userId,
        messageId,
        durationSeconds,
        reason,
      );
    } else if (platform === "kick") {
      upstream = await kickModeration(
        action,
        session,
        channelId,
        userId,
        messageId,
        durationSeconds,
        reason,
      );
    } else {
      const result = await youtubeModeration(
        action,
        session,
        channelId,
        userId,
        messageId,
        liveChatId,
        durationSeconds,
        banId,
      );
      upstream = result.response;
      youtubeStateKey = result.stateKey;
      resolvedLiveChatId = result.liveChatId;
    }

    const data = await readResponse(upstream);
    if (!upstream.ok) {
      const response = NextResponse.json(
        {
          error: parseUpstreamError(data, upstream.status),
          details: data,
          reconnectRequired: upstream.status === 401,
        },
        {
          status:
            upstream.status >= 400 && upstream.status < 600
              ? upstream.status
              : 502,
        },
      );
      if (session.accessToken !== stored.accessToken) {
        writePlatformSession(response, platform, session);
      }
      return response;
    }

    let youtubeBanId = "";
    if (platform === "youtube" && (action === "ban" || action === "timeout")) {
      youtubeBanId = typeof data?.id === "string" ? data.id : "";
      if (youtubeBanId && youtubeStateKey) {
        await setState(youtubeStateKey, { banId: youtubeBanId });
      }
    } else if (platform === "youtube" && action === "unban" && youtubeStateKey) {
      await setState(youtubeStateKey, { banId: null });
    }

    if (action === "delete_message") {
      await removeMessage(platform, messageId);
    }

    const response = NextResponse.json({
      ok: true,
      platform,
      action,
      result: data,
      ...(resolvedLiveChatId ? { liveChatId: resolvedLiveChatId } : {}),
      ...(youtubeBanId ? { banId: youtubeBanId } : {}),
    });

    if (session.accessToken !== stored.accessToken) {
      writePlatformSession(response, platform, session);
    }
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Falha ao executar moderação.",
      },
      { status: 500 },
    );
  }
}
