import { NextRequest, NextResponse } from "next/server";
import { resolveKickChannel, resolveTwitchChannel, resolveYouTubeChannel } from "@/lib/channels";
import { refreshPlatformSession } from "@/lib/platform-auth";
import { readPlatformSession, writePlatformSession } from "@/lib/session";
import { setState } from "@/lib/store";
import type { Platform, ResolvedChannel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const requested = (payload?.channels || {}) as Partial<Record<Platform, string>>;
  const channels: Partial<Record<Platform, ResolvedChannel>> = {};
  const errors: Partial<Record<Platform, string>> = {};

  const twitchStored = await readPlatformSession("twitch");
  let twitchSession = twitchStored;
  if (twitchStored) {
    try { twitchSession = await refreshPlatformSession("twitch", twitchStored); }
    catch { twitchSession = twitchStored; }
  }

  if (requested.twitch?.trim()) {
    try { channels.twitch = await resolveTwitchChannel(requested.twitch, twitchSession); }
    catch (error) { errors.twitch = error instanceof Error ? error.message : "Falha ao identificar canal da Twitch."; }
  }
  if (requested.kick?.trim()) {
    try { channels.kick = await resolveKickChannel(requested.kick); }
    catch (error) { errors.kick = error instanceof Error ? error.message : "Falha ao identificar canal da Kick."; }
  }
  if (requested.youtube?.trim()) {
    try {
      channels.youtube = await resolveYouTubeChannel(requested.youtube);
      const youtube = channels.youtube;
      if (youtube?.channelId) {
        await setState(`youtube-channel:${youtube.channelId}`, {
          liveChatId: youtube.liveChatId || null,
          videoId: youtube.videoId || null,
          nextResolveAt: Date.now() + (youtube.liveChatId ? 30 * 60_000 : 2 * 60_000),
        });
      }
    } catch (error) {
      errors.youtube = error instanceof Error ? error.message : "Falha ao identificar canal do YouTube.";
    }
  }

  const response = NextResponse.json({ channels, errors });
  if (twitchStored && twitchSession && twitchSession.accessToken !== twitchStored.accessToken) {
    writePlatformSession(response, "twitch", twitchSession);
  }
  return response;
}
