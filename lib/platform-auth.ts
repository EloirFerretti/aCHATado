import type { Platform, PlatformSession } from "@/lib/types";

export async function refreshPlatformSession(platform: Platform, session: PlatformSession) {
  if (!session.refreshToken) return session;
  if (Date.now() < session.expiresAt - 60_000) return session;

  let endpoint = "";
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
  });

  if (platform === "twitch") {
    endpoint = "https://id.twitch.tv/oauth2/token";
    body.set("client_id", process.env.TWITCH_CLIENT_ID || "");
    body.set("client_secret", process.env.TWITCH_CLIENT_SECRET || "");
  } else if (platform === "kick") {
    endpoint = "https://id.kick.com/oauth/token";
    body.set("client_id", process.env.KICK_CLIENT_ID || "");
    body.set("client_secret", process.env.KICK_CLIENT_SECRET || "");
  } else {
    endpoint = "https://oauth2.googleapis.com/token";
    body.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
    body.set("client_secret", process.env.GOOGLE_CLIENT_SECRET || "");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error_description || json?.error || "Falha ao renovar token.");

  return {
    ...session,
    accessToken: json.access_token,
    refreshToken: json.refresh_token || session.refreshToken,
    expiresAt: Date.now() + Number(json.expires_in || 3600) * 1000,
    scope: typeof json.scope === "string" ? json.scope.split(/\s+/).filter(Boolean) : session.scope,
  } satisfies PlatformSession;
}
