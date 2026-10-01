import { NextRequest, NextResponse } from "next/server";
import { ensureYouTubeLiveChatStream } from "@/lib/youtube-live-stream";
import { findActiveYouTubeLive, isYouTubeQuotaError } from "@/lib/youtube";
import { getState, setState } from "@/lib/store";
import { readPlatformSession, writePlatformSession } from "@/lib/session";
import { refreshPlatformSession } from "@/lib/platform-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const channelId = typeof body?.channelId === "string" ? body.channelId.trim() : "";
    let liveChatId = typeof body?.liveChatId === "string" ? body.liveChatId.trim() : "";
    let videoId = typeof body?.videoId === "string" ? body.videoId.trim() : "";

    if (!channelId) {
      return NextResponse.json({ error: "channelId obrigatório." }, { status: 400 });
    }

    const stateKey = `youtube-channel:${channelId}`;
    const state = await getState<{
      liveChatId?: string | null;
      videoId?: string | null;
      nextResolveAt?: number;
    }>(stateKey);

    if (!liveChatId && state?.liveChatId) liveChatId = state.liveChatId;
    if (!videoId && state?.videoId) videoId = state.videoId || "";

    if (!liveChatId) {
      if (state?.nextResolveAt && Date.now() < state.nextResolveAt) {
        return NextResponse.json({
          mode: "stream",
          active: false,
          offline: true,
          retryAfterMs: state.nextResolveAt - Date.now(),
        });
      }

      try {
        const live = await findActiveYouTubeLive(channelId);
        liveChatId = live?.liveChatId || "";
        videoId = live?.videoId || "";
        await setState(stateKey, {
          liveChatId: liveChatId || null,
          videoId: videoId || null,
          nextResolveAt: Date.now() + (liveChatId ? 30 * 60_000 : 2 * 60_000),
        });
      } catch (error) {
        if (isYouTubeQuotaError(error)) {
          return NextResponse.json(
            {
              mode: "stream",
              active: false,
              quotaExceeded: true,
              retryAfterMs: 30 * 60_000,
            },
            { status: 429 },
          );
        }
        throw error;
      }
    }

    if (!liveChatId) {
      return NextResponse.json({
        mode: "stream",
        active: false,
        offline: true,
        retryAfterMs: 2 * 60_000,
      });
    }

    const stored = await readPlatformSession("youtube");
    const refreshedSession = stored
      ? await refreshPlatformSession("youtube", stored).catch(() => stored)
      : null;

    const stream = await ensureYouTubeLiveChatStream(
      channelId,
      liveChatId,
      refreshedSession?.accessToken,
    );

    const lastErrorText = stream.lastError?.message || "";
    const quotaExceeded = /quotaExceeded|exceeded your quota/i.test(lastErrorText);
    const rateLimited =
      stream.lastError?.code === 8 ||
      /rate.?limit|resource has been exhausted/i.test(lastErrorText);

    const response = NextResponse.json({
      mode: "stream",
      ...stream,
      quotaExceeded,
      rateLimited,
      liveChatId,
      videoId: videoId || undefined,
    });

    if (
      stored &&
      refreshedSession &&
      refreshedSession.accessToken !== stored.accessToken
    ) {
      writePlatformSession(response, "youtube", refreshedSession);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao iniciar stream do YouTube." },
      { status: 500 },
    );
  }
}
