type CachedToken = {
  token: string;
  expiresAt: number;
};

let twitchToken: CachedToken | null = null;
let kickToken: CachedToken | null = null;

async function clientCredentialsToken(
  endpoint: string,
  clientId: string | undefined,
  clientSecret: string | undefined,
  platform: string,
) {
  if (!clientId || !clientSecret) {
    throw new Error(`Credenciais da ${platform} ainda não foram configuradas.`);
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || !json?.access_token) {
    throw new Error(json?.message || json?.error_description || json?.error || `Não foi possível autenticar na ${platform}.`);
  }

  return {
    token: String(json.access_token),
    expiresAt: Date.now() + Math.max(60, Number(json.expires_in || 3600) - 120) * 1000,
  } satisfies CachedToken;
}

export async function getTwitchAppToken() {
  if (twitchToken && twitchToken.expiresAt > Date.now()) return twitchToken.token;
  twitchToken = await clientCredentialsToken(
    "https://id.twitch.tv/oauth2/token",
    process.env.TWITCH_CLIENT_ID,
    process.env.TWITCH_CLIENT_SECRET,
    "Twitch",
  );
  return twitchToken.token;
}

export async function getKickAppToken() {
  if (kickToken && kickToken.expiresAt > Date.now()) return kickToken.token;
  kickToken = await clientCredentialsToken(
    "https://id.kick.com/oauth/token",
    process.env.KICK_CLIENT_ID,
    process.env.KICK_CLIENT_SECRET,
    "Kick",
  );
  return kickToken.token;
}
