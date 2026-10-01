import { NextResponse } from "next/server";
import { dbConfigured, dbProvider } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "achatado",
    databaseConfigured: dbConfigured,
    databaseProvider: dbProvider,
    apis: {
      twitch: Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET),
      kick: Boolean(process.env.KICK_CLIENT_ID && process.env.KICK_CLIENT_SECRET),
      youtube: Boolean(process.env.YOUTUBE_API_KEY),
      googleOAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
    timestamp: new Date().toISOString(),
  });
}
