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
      author_avatar: e.sender?.profile_picture || null,
      author_color: e.sender?.identity?.username_color || null,
      message: cleanKickContent(String(e.content || "")),
      message_type: "text",
      badges: Array.isArray(e.sender?.identity?.badges) ? e.sender.identity.badges : [],
      created_at: e.created_at || new Date().toISOString(),
      raw: e,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook error" }, { status: 500 });
  }
}
