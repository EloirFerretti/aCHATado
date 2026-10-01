import { NextRequest, NextResponse } from "next/server";
import { getTwitchBadgeCatalog } from "@/lib/twitch-badges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId")?.trim() || "";
  if (!channelId) {
    return NextResponse.json({ error: "channelId obrigatório." }, { status: 400 });
  }

  try {
    const badges = await getTwitchBadgeCatalog(channelId);
    return NextResponse.json(
      { badges },
      { headers: { "Cache-Control": "private, max-age=21600" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao carregar badges da Twitch.",
      },
      { status: 500 },
    );
  }
}
