import { getKickAppToken, getTwitchAppToken } from "@/lib/app-tokens";
import { resolveYouTubeChannel } from "@/lib/youtube";
import type { PlatformSession, ResolvedChannel } from "@/lib/types";
import { getState, setState } from "@/lib/store";

function cleanHandle(input: string, platform: "twitch" | "kick") {
  const value = input.trim();
  const pattern = platform === "twitch" ? /twitch\.tv\/([^/?#]+)/i : /kick\.com\/([^/?#]+)/i;
  const match = value.match(pattern);
  return (match?.[1] || value).replace(/^@/, "").trim().toLowerCase();
}

async function responseJson(res: Response) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return { raw: text }; }
}

export async function resolveTwitchChannel(input: string, session?: PlatformSession | null): Promise<ResolvedChannel> {
  const login = cleanHandle(input, "twitch");
  if (!login) throw new Error("Informe o username do canal da Twitch.");
  const token = await getTwitchAppToken();
  const url = new URL("https://api.twitch.tv/helix/users");
  url.searchParams.set("login", login);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID || "",
    },
    cache: "no-store",
  });
  const json = await responseJson(res);
  if (!res.ok) throw new Error(json?.message || `Twitch respondeu ${res.status}.`);
  const user = json?.data?.[0];
  if (!user) throw new Error(`Canal da Twitch “${input}” não encontrado.`);

  const subscriptionReady = Boolean(session?.accessToken && session.userId);
  return {
    platform: "twitch",
    input,
    channelId: String(user.id),
    channelName: user.display_name || user.login || login,
    avatar: user.profile_image_url || null,
    live: undefined,
    subscriptionReady,
    note: subscriptionReady
      ? "Canal identificado. A leitura do chat será conectada com sua conta Twitch."
      : "Canal identificado. Conecte sua conta Twitch para ativar a leitura do chat.",
  };
}

export async function resolveKickChannel(input: string): Promise<ResolvedChannel> {
  const slug = cleanHandle(input, "kick");
  if (!slug) throw new Error("Informe o username do canal da Kick.");
  const token = await getKickAppToken();
  const url = new URL("https://api.kick.com/public/v1/channels");
  url.searchParams.append("slug", slug);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = await responseJson(res);
  if (!res.ok) throw new Error(json?.message || `Kick respondeu ${res.status}.`);
  const channel = json?.data?.[0];
  if (!channel) throw new Error(`Canal da Kick “${input}” não encontrado.`);

  let subscriptionReady = false;
  let note = "Canal identificado.";
  const subscriptionKey = `kick-subscription:${channel.broadcaster_user_id}`;
  const cachedSubscription = await getState<{ ready?: boolean; checkedAt?: number }>(subscriptionKey);
  const cacheFresh = Boolean(
    cachedSubscription?.ready &&
    cachedSubscription?.checkedAt &&
    Date.now() - cachedSubscription.checkedAt < 12 * 60 * 60 * 1000,
  );

  if (cacheFresh) {
    subscriptionReady = true;
    note = "Chat da Kick integrado.";
  } else {
    const sub = await fetch("https://api.kick.com/public/v1/events/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        broadcaster_user_id: Number(channel.broadcaster_user_id),
        events: [{ name: "chat.message.sent", version: 1 }],
        method: "webhook",
      }),
    });
    const subJson = await responseJson(sub);
    const first = subJson?.data?.[0];
    if (sub.ok && !first?.error) {
      subscriptionReady = true;
      note = "Chat da Kick integrado.";
    } else {
      const message = first?.error || subJson?.message || `Não foi possível assinar o chat da Kick (${sub.status}).`;
      if (/already|duplicate|exists/i.test(message)) {
        subscriptionReady = true;
        note = "Chat da Kick já estava integrado.";
      } else {
        note = message;
      }
    }

    if (subscriptionReady) {
      await setState(subscriptionKey, { ready: true, checkedAt: Date.now() });
    }
  }

  return {
    platform: "kick",
    input,
    channelId: String(channel.broadcaster_user_id),
    channelName: channel.slug || slug,
    avatar: channel.thumbnail || null,
    live: Boolean(channel.stream),
    subscriptionReady,
    note,
  };
}

export { resolveYouTubeChannel };
