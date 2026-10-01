import { getTwitchAppToken } from "@/lib/app-tokens";
import type { ChatMessage } from "@/lib/types";

type AvatarCacheEntry = {
  avatar: string | null;
  expiresAt: number;
};

const avatarCache = new Map<string, AvatarCacheEntry>();
const AVATAR_TTL = 6 * 60 * 60 * 1000;
const MISSING_TTL = 15 * 60 * 1000;

async function fetchTwitchUsers(ids: string[]) {
  if (!ids.length) return [] as Array<{ id: string; profile_image_url?: string }>;

  const token = await getTwitchAppToken();
  const url = new URL("https://api.twitch.tv/helix/users");
  for (const id of ids.slice(0, 100)) url.searchParams.append("id", id);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID || "",
    },
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || `Twitch Get Users respondeu ${res.status}.`);
  }

  return Array.isArray(json?.data) ? json.data : [];
}

export async function getTwitchUserAvatars(ids: string[]) {
  const now = Date.now();
  const unique = [...new Set(ids.filter(Boolean))];
  const missing = unique.filter((id) => {
    const cached = avatarCache.get(id);
    return !cached || cached.expiresAt <= now;
  });

  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100);
    try {
      const users = await fetchTwitchUsers(batch);
      const found = new Set<string>();

      for (const user of users) {
        const id = String(user.id);
        found.add(id);
        avatarCache.set(id, {
          avatar: user.profile_image_url ? String(user.profile_image_url) : null,
          expiresAt: now + AVATAR_TTL,
        });
      }

      for (const id of batch) {
        if (!found.has(id)) {
          avatarCache.set(id, {
            avatar: null,
            expiresAt: now + MISSING_TTL,
          });
        }
      }
    } catch {
      // A falha no avatar nunca deve impedir o carregamento do chat.
    }
  }

  return new Map(
    unique.map((id) => [id, avatarCache.get(id)?.avatar || null] as const),
  );
}

export async function enrichTwitchAvatars(messages: ChatMessage[]) {
  const ids = messages
    .filter((m) => m.platform === "twitch" && !m.author_avatar && m.author_id)
    .map((m) => String(m.author_id));

  if (!ids.length) return messages;

  const avatars = await getTwitchUserAvatars(ids);
  return messages.map((message) => {
    if (
      message.platform !== "twitch" ||
      message.author_avatar ||
      !message.author_id
    ) {
      return message;
    }

    return {
      ...message,
      author_avatar: avatars.get(String(message.author_id)) || null,
    };
  });
}
