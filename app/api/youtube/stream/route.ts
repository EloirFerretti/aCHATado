import { NextRequest, NextResponse } from "next/server";
import { ensureYouTubeLiveChatStream } from "@/lib/youtube-live-stream";
import { findActiveYouTubeLive, isYouTubeQuotaError } from "@/lib/youtube";
import { getState, setState } from "@/lib/store";

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

    const stream = await ensureYouTubeLiveChatStream(channelId, liveChatId);
    return NextResponse.json({
      mode: "stream",
      ...stream,
      liveChatId,
      videoId: videoId || undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao iniciar stream do YouTube." },
      { status: 500 },
    );
  }
}
