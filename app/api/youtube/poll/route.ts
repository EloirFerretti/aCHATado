import { NextRequest, NextResponse } from "next/server";
import { getState, insertMessage, setState } from "@/lib/store";
import { findActiveYouTubeLive, getYouTubeLiveChatId } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return NextResponse.json({ skipped: true, reason: "YOUTUBE_API_KEY não configurada" });

    const body = await req.json().catch(() => ({}));
    const channelId = typeof body?.channelId === "string" ? body.channelId.trim() : "";
    let liveChatId = typeof body?.liveChatId === "string" ? body.liveChatId.trim() : "";

    if (channelId && !liveChatId) {
      const discoveryKey = `youtube-channel:${channelId}`;
      const discovery = await getState<{ liveChatId?: string | null; nextResolveAt?: number }>(discoveryKey);

      if (discovery?.nextResolveAt && Date.now() < discovery.nextResolveAt) {
        liveChatId = discovery.liveChatId || "";
        if (!liveChatId) {
          return NextResponse.json({
            skipped: true,
            offline: true,
            retryAfterMs: discovery.nextResolveAt - Date.now(),
          });
        }
      } else {
        const live = await findActiveYouTubeLive(channelId);
        liveChatId = live?.liveChatId || "";
        await setState(discoveryKey, {
          liveChatId: liveChatId || null,
          nextResolveAt: Date.now() + (liveChatId ? 60_000 : 60_000),
        });
        if (!liveChatId) return NextResponse.json({ skipped: true, offline: true, retryAfterMs: 60_000 });
      }
    }

    if (!liveChatId) liveChatId = await getYouTubeLiveChatId();

    const stateKey = `youtube:${liveChatId}`;
    const state = await getState<{ nextPageToken?: string; nextPollAt?: number }>(stateKey);
    if (state?.nextPollAt && Date.now() < state.nextPollAt) {
      return NextResponse.json({ skipped: true, retryAfterMs: state.nextPollAt - Date.now() });
    }

    const url = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
    url.searchParams.set("liveChatId", liveChatId);
    url.searchParams.set("part", "id,snippet,authorDetails");
    url.searchParams.set("maxResults", "200");
    url.searchParams.set("key", apiKey);
    if (state?.nextPageToken) url.searchParams.set("pageToken", state.nextPageToken);

    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      if (channelId) {
        await setState(`youtube-channel:${channelId}`, {
          liveChatId: null,
          nextResolveAt: Date.now() + 60_000,
        });
      }
      throw new Error(json?.error?.message || `YouTube respondeu ${res.status}`);
    }

    let inserted = 0;
    for (const item of json.items || []) {
      const text = item?.snippet?.displayMessage || item?.snippet?.textMessageDetails?.messageText;
      if (!text) continue;

      await insertMessage({
        platform: "youtube",
        platform_message_id: String(item.id),
        channel_id: channelId || liveChatId,
        author_id: item.authorDetails?.channelId ? String(item.authorDetails.channelId) : null,
        author_name: item.authorDetails?.displayName || "YouTube user",
        author_avatar: item.authorDetails?.profileImageUrl || null,
        author_color: null,
        message: String(text),
        message_type: item?.snippet?.type || "textMessageEvent",
        badges: [
          ...(item.authorDetails?.isChatOwner ? ["owner"] : []),
          ...(item.authorDetails?.isChatModerator ? ["moderator"] : []),
          ...(item.authorDetails?.isChatSponsor ? ["member"] : []),
        ],
        created_at: item?.snippet?.publishedAt || new Date().toISOString(),
        raw: item,
      });
      inserted++;
    }

    const interval = Math.max(Number(json.pollingIntervalMillis || 5000), 1000);
    await setState(stateKey, {
      nextPageToken: json.nextPageToken,
      nextPollAt: Date.now() + interval,
    });

    return NextResponse.json({
      ok: true,
      fetched: json.items?.length || 0,
      inserted,
      liveChatId,
      pollingIntervalMillis: interval,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao consultar YouTube" },
      { status: 500 },
    );
  }
}
