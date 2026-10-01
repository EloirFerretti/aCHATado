import { NextRequest, NextResponse } from "next/server";
import { writePlatformSession } from "@/lib/session";
import type { Platform, PlatformSession } from "@/lib/types";

export const runtime = "nodejs";

function isPlatform(value: string): value is Platform {
  return value === "twitch" || value === "kick" || value === "youtube";
}

function fail(origin: string, platform: string, message: string) {
  const u = new URL("/chat", origin);
  u.searchParams.set("auth_error", `${platform}: ${message}`);
  return NextResponse.redirect(u);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform: rawPlatform } = await params;
  if (!isPlatform(rawPlatform)) return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
  const platform = rawPlatform;
  const origin = process.env.APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get(`usc_oauth_state_${platform}`)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return fail(origin, platform, "estado OAuth inválido");
  }

  try {
    const redirectUri = `${origin}/api/auth/${platform}/callback`;
    let tokenEndpoint = "";
    const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri });

    if (platform === "twitch") {
      tokenEndpoint = "https://id.twitch.tv/oauth2/token";
      body.set("client_id", process.env.TWITCH_CLIENT_ID || "");
      body.set("client_secret", process.env.TWITCH_CLIENT_SECRET || "");
    } else if (platform === "kick") {
      tokenEndpoint = "https://id.kick.com/oauth/token";
      body.set("client_id", process.env.KICK_CLIENT_ID || "");
      body.set("client_secret", process.env.KICK_CLIENT_SECRET || "");
      body.set("code_verifier", req.cookies.get("usc_pkce_kick")?.value || "");
    } else {
      tokenEndpoint = "https://oauth2.googleapis.com/token";
      body.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
      body.set("client_secret", process.env.GOOGLE_CLIENT_SECRET || "");
    }

    const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(token?.error_description || token?.message || token?.error || "falha ao obter token");

    const session: PlatformSession = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
    };

    if (platform === "twitch") {
      const me = await fetch("https://api.twitch.tv/helix/users", {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID || "",
        },
        cache: "no-store",
      });
      const json = await me.json();
      if (!me.ok || !json?.data?.[0]) throw new Error("não foi possível identificar o usuário da Twitch");
      session.userId = String(json.data[0].id);
      session.userName = json.data[0].display_name || json.data[0].login;
      session.avatar = json.data[0].profile_image_url;
    } else if (platform === "kick") {
      const me = await fetch("https://api.kick.com/public/v1/users", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      });
      const json = await me.json();
      if (!me.ok || !json?.data?.[0]) throw new Error("não foi possível identificar o usuário da Kick");
      session.userId = String(json.data[0].user_id);
      session.userName = json.data[0].name;
      session.avatar = json.data[0].profile_picture;
    } else {
      const me = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store",
      });
      const json = await me.json();
      if (!me.ok || !json?.items?.[0]) throw new Error("não foi possível identificar o canal do YouTube");
      session.userId = String(json.items[0].id);
      session.userName = json.items[0].snippet?.title || "YouTube";
      session.avatar = json.items[0].snippet?.thumbnails?.default?.url;
    }

    const redirect = new URL("/chat", origin);
    redirect.searchParams.set("connected", platform);
    const response = NextResponse.redirect(redirect);
    writePlatformSession(response, platform, session);
    response.cookies.delete(`usc_oauth_state_${platform}`);
    response.cookies.delete(`usc_pkce_${platform}`);
    return response;
  } catch (error) {
    return fail(origin, platform, error instanceof Error ? error.message : "erro de autenticação");
  }
}
