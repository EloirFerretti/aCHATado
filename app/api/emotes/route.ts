import { NextRequest, NextResponse } from "next/server";
import { getThirdPartyEmotes } from "@/lib/emotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId")?.trim();
  if (!channelId) {
    return NextResponse.json({ error: "channelId obrigatório." }, { status: 400 });
  }

  try {
    const catalog = await getThirdPartyEmotes(channelId);
    return NextResponse.json(catalog, {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao carregar emotes.",
      },
      { status: 500 },
    );
  }
}
