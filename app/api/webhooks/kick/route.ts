import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { insertMessage } from "@/lib/store";

export const runtime = "nodejs";

let cachedKey: { value: string; expires: number } | null = null;

async function getPublicKey() {
  if (process.env.KICK_PUBLIC_KEY) return process.env.KICK_PUBLIC_KEY.replace(/\\n/g, "\n");
  if (cachedKey && cachedKey.expires > Date.now()) return cachedKey.value;
  const res = await fetch("https://api.kick.com/public/v1/public-key", { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json?.data?.public_key) throw new Error("Não foi possível obter a chave pública da Kick.");
  cachedKey = { value: json.data.public_key, expires: Date.now() + 6 * 60 * 60 * 1000 };
  return cachedKey.value;
}

async function validSignature(req: NextRequest, raw: string) {
  const id = req.headers.get("kick-event-message-id") || "";
  const timestamp = req.headers.get("kick-event-message-timestamp") || "";
  const signature = req.headers.get("kick-event-signature") || "";
  if (!id || !timestamp || !signature) return false;
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${id}.${timestamp}.${raw}`);
  verifier.end();
  return verifier.verify(await getPublicKey(), Buffer.from(signature, "base64"));
}

function cleanKickContent(content: string) {
  return content.replace(/\[emote:\d+:([^\]]+)\]/g, "$1");
}

function normalizeKickAvatar(value: unknown) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `https://kick.com${raw}`;
  return /^https?:\/\//i.test(raw) ? raw : null;
}

function kickSenderAvatar(sender: any) {
  for (const candidate of [
    sender?.profile_picture,
    sender?.profile_pic,
    sender?.profile_pic_v2,
    sender?.profilePicV2,
    sender?.profilePicture,
    sender?.profile_image,
    sender?.profileimage,
    sender?.avatar,
    sender?.avatar_url,
  ]) {
    const normalized = normalizeKickAvatar(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function kickBadges(event: any) {
  const badges = Array.isArray(event?.sender?.identity?.badges)
    ? [...event.sender.identity.badges]
    : [];

  const types = new Set(
    badges
      .map((badge: any) =>
        String(badge?.name || badge?.type || "")
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, ""),
      )
      .filter(Boolean),
  );

  // A interface atual da Kick usa badges_v2 para badges globais, incluindo
  // "level". Para level, o número exibido vem de metadata.level.
  const badgesV2 = Array.isArray(event?.sender?.identity?.badges_v2)
    ? event.sender.identity.badges_v2
    : [];

  for (const badge of badgesV2) {
    const name = String(badge?.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    if (!name || types.has(name)) continue;

    if (name === "level") {
      const level = Number(badge?.metadata?.level);
      if (Number.isInteger(level) && level >= 1 && level <= 99) {
        badges.push({
          type: "level",
          name: "level",
          text: `Level ${level}`,
          count: level,
          metadata: badge?.metadata || { level },
          image_url:
            typeof badge?.image_url === "string" ? badge.image_url : undefined,
        });
        types.add("level");
      }
      continue;
    }

    badges.push({
      type: name,
      name,
      text: String(badge?.text || badge?.name || name),
      metadata: badge?.metadata,
      image_url:
        typeof badge?.image_url === "string" ? badge.image_url : undefined,
    });
    types.add(name);
  }

  if (
    event?.sender?.user_id &&
    event?.broadcaster?.user_id &&
    String(event.sender.user_id) === String(event.broadcaster.user_id) &&
    !types.has("broadcaster")
  ) {
    badges.unshift({ text: "Broadcaster", type: "broadcaster" });
    types.add("broadcaster");
  }

  if (event?.sender?.is_verified && !types.has("verified")) {
    badges.push({ text: "Verified", type: "verified" });
  }

  return badges;
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (!(await validSignature(req, raw))) return new NextResponse("invalid signature", { status: 403 });
    if (req.headers.get("kick-event-type") !== "chat.message.sent") return NextResponse.json({ ok: true });

    const e = JSON.parse(raw);
    await insertMessage({
      platform: "kick",
      platform_message_id: String(e.message_id),
      channel_id: e.broadcaster?.user_id ? String(e.broadcaster.user_id) : null,
      author_id: e.sender?.user_id ? String(e.sender.user_id) : null,
      author_name: e.sender?.username || "Kick user",
      author_avatar: kickSenderAvatar(e.sender),
      author_color: e.sender?.identity?.username_color || null,
      message: cleanKickContent(String(e.content || "")),
      message_type: "text",
      badges: kickBadges(e),
      created_at: e.created_at || new Date().toISOString(),
      raw: e,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook error" }, { status: 500 });
  }
}
