import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { writeOauthCookie } from "@/lib/session";
import type { Platform } from "@/lib/types";

export const runtime = "nodejs";

function isPlatform(value: string): value is Platform {
  return value === "twitch" || value === "kick" || value === "youtube";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform: rawPlatform } = await params;
  if (!isPlatform(rawPlatform)) return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
  const platform = rawPlatform;
  const origin = process.env.APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/${platform}/callback`;
  const state = crypto.randomBytes(24).toString("base64url");

  let authorizeUrl: URL;
  let codeVerifier: string | undefined;

  if (platform === "twitch") {
    if (!process.env.TWITCH_CLIENT_ID) throw new Error("TWITCH_CLIENT_ID não configurado.");
    authorizeUrl = new URL("https://id.twitch.tv/oauth2/authorize");
    authorizeUrl.searchParams.set("client_id", process.env.TWITCH_CLIENT_ID);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "user:write:chat");
    authorizeUrl.searchParams.set("state", state);
  } else if (platform === "kick") {
    if (!process.env.KICK_CLIENT_ID) throw new Error("KICK_CLIENT_ID não configurado.");
    codeVerifier = crypto.randomBytes(48).toString("base64url");
    const challenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    authorizeUrl = new URL("https://id.kick.com/oauth/authorize");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", process.env.KICK_CLIENT_ID);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", "user:read chat:write");
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("state", state);
  } else {
    if (!process.env.GOOGLE_CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID não configurado.");
    authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizeUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.force-ssl");
    authorizeUrl.searchParams.set("access_type", "offline");
    authorizeUrl.searchParams.set("prompt", "consent");
    authorizeUrl.searchParams.set("state", state);
  }

  const response = NextResponse.redirect(authorizeUrl);
  writeOauthCookie(response, `usc_oauth_state_${platform}`, state);
  if (codeVerifier) writeOauthCookie(response, `usc_pkce_${platform}`, codeVerifier);
  return response;
}
