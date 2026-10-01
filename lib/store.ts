import type { ChatMessage } from "@/lib/types";

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const dbConfigured = Boolean(url && key);

async function dbFetch(path: string, init: RequestInit = {}) {
  if (!url || !key) throw new Error("Banco Supabase não configurado.");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
  return res;
}

export async function insertMessage(message: ChatMessage) {
  if (!dbConfigured) return;
  const res = await fetch(
    `${url}/rest/v1/chat_messages?on_conflict=platform_message_id`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(message),
    },
  );
  if (!res.ok && res.status !== 409) {
    throw new Error(`Falha ao gravar mensagem: ${res.status} ${await res.text()}`);
  }
}

export async function listMessages(afterId = 0, limit = 100) {
  if (!dbConfigured) return demoMessages.filter((m) => (m.id || 0) > afterId);
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const query = afterId > 0
    ? `chat_messages?select=*&id=gt.${afterId}&order=id.asc&limit=${safeLimit}`
    : `chat_messages?select=*&order=id.desc&limit=${safeLimit}`;
  const res = await dbFetch(query);
  const data = (await res.json()) as ChatMessage[];
  return afterId > 0 ? data : data.reverse();
}

export async function getState<T>(stateKey: string): Promise<T | null> {
  if (!dbConfigured) return null;
  const res = await dbFetch(
    `platform_state?select=value&key=eq.${encodeURIComponent(stateKey)}&limit=1`,
  );
  const rows = (await res.json()) as Array<{ value: T }>;
  return rows[0]?.value ?? null;
}

export async function setState(stateKey: string, value: unknown) {
  if (!dbConfigured) return;
  const res = await fetch(`${url}/rest/v1/platform_state?on_conflict=key`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: key!,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ key: stateKey, value, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Falha ao salvar estado: ${await res.text()}`);
}

const demoMessages: ChatMessage[] = [
  {
    id: 1,
    platform: "twitch",
    platform_message_id: "demo-twitch-1",
    channel_id: "demo",
    author_id: "1",
    author_name: "pixelrunner",
    author_avatar: null,
    author_color: "#a970ff",
    message: "Esse chat junta mesmo as três plataformas?",
    message_type: "text",
    badges: [],
    created_at: new Date(Date.now() - 72000).toISOString(),
  },
  {
    id: 2,
    platform: "kick",
    platform_message_id: "demo-kick-1",
    channel_id: "demo",
    author_id: "2",
    author_name: "bruno_live",
    author_avatar: null,
    author_color: "#53fc18",
    message: "Sim! E eu posso responder usando minha conta da Kick.",
    message_type: "text",
    badges: [],
    created_at: new Date(Date.now() - 45000).toISOString(),
  },
  {
    id: 3,
    platform: "youtube",
    platform_message_id: "demo-youtube-1",
    channel_id: "demo",
    author_id: "3",
    author_name: "Ana Clips",
    author_avatar: null,
    author_color: "#ff453a",
    message: "Cheguei pelo YouTube 👋",
    message_type: "text",
    badges: [],
    created_at: new Date(Date.now() - 18000).toISOString(),
  }
];
