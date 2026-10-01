import { NextResponse } from "next/server";
import { getState, insertMessage, setState } from "@/lib/store";
import { getYouTubeLiveChatId } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return NextResponse.json({ skipped: true, reason: "YOUTUBE_API_KEY não configurada" });
    const liveChatId = await getYouTubeLiveChatId();
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
    if (!res.ok) throw new Error(json?.error?.message || `YouTube respondeu ${res.status}`);

    let inserted = 0;
    for (const item of json.items || []) {
      const text = item?.snippet?.displayMessage || item?.snippet?.textMessageDetails?.messageText;
      if (!text) continue;
      await insertMessage({
        platform: "youtube",
        platform_message_id: String(item.id),
        channel_id: liveChatId,
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
    return NextResponse.json({ ok: true, fetched: json.items?.length || 0, inserted, pollingIntervalMillis: interval });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao consultar YouTube" }, { status: 500 });
  }
}
