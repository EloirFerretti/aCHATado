import { NextRequest, NextResponse } from "next/server";
import { getYouTubeLiveEmotes } from "@/lib/youtube-emotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("videoId")?.trim();
  if (!videoId) {
    return NextResponse.json({ error: "videoId obrigatório." }, { status: 400 });
  }

  try {
    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
    const emotes = await getYouTubeLiveEmotes(videoId, forceRefresh);
    return NextResponse.json(
      {
        emotes,
        aliases: Object.keys(emotes).length,
        unique: new Set(Object.values(emotes).map((emote) => emote.id || emote.url)).size,
      },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao carregar emotes do YouTube.",
      },
      { status: 502 },
    );
  }
}
