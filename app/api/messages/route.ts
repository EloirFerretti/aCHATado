import { NextRequest, NextResponse } from "next/server";
import { dbConfigured, dbProvider, listMessages } from "@/lib/store";
import { enrichTwitchAvatars } from "@/lib/twitch-users";
import type { ChannelFilters } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const after = Math.max(0, Number(req.nextUrl.searchParams.get("after") || 0));
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 100)));
  const filters: ChannelFilters = {};
  const twitch = req.nextUrl.searchParams.get("twitch");
  const kick = req.nextUrl.searchParams.get("kick");
  const youtube = req.nextUrl.searchParams.get("youtube");
  if (twitch) filters.twitch = twitch;
  if (kick) filters.kick = kick;
  if (youtube) filters.youtube = youtube;

  const storedMessages = await listMessages(after, limit, filters);
  const messages = await enrichTwitchAvatars(storedMessages);

  return NextResponse.json({ messages, dbConfigured, dbProvider });
}
