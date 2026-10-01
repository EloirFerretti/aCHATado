import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { insertMessage } from "@/lib/store";
import { getTwitchUserProfiles } from "@/lib/twitch-users";

export const runtime = "nodejs";

function validSignature(req: NextRequest, raw: string) {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  if (!secret) throw new Error("TWITCH_EVENTSUB_SECRET não configurado.");
  const id = req.headers.get("twitch-eventsub-message-id") || "";
  const timestamp = req.headers.get("twitch-eventsub-message-timestamp") || "";
  const signature = req.headers.get("twitch-eventsub-message-signature") || "";
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(id + timestamp + raw).digest("hex")}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (!validSignature(req, raw)) return new NextResponse("invalid signature", { status: 403 });
    const payload = JSON.parse(raw);
    const type = req.headers.get("twitch-eventsub-message-type");

    if (type === "webhook_callback_verification") {
      return new NextResponse(payload.challenge || "", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    if (type === "revocation") return NextResponse.json({ ok: true });
    if (payload?.subscription?.type !== "channel.chat.message") return NextResponse.json({ ok: true });

    const e = payload.event;
    const chatterId = e.chatter_user_id ? String(e.chatter_user_id) : "";
    const profile = chatterId
      ? (await getTwitchUserProfiles([chatterId])).get(chatterId)
      : null;

    await insertMessage({
      platform: "twitch",
      platform_message_id: String(e.message_id),
      channel_id: e.broadcaster_user_id ? String(e.broadcaster_user_id) : null,
      author_id: chatterId || null,
      author_name: e.chatter_user_name || e.chatter_user_login || profile?.displayName || "Twitch user",
      author_avatar: profile?.avatar || null,
      author_color: e.color || null,
      message: e.message?.text || "",
      message_type: "text",
      badges: Array.isArray(e.badges) ? e.badges : [],
      created_at: req.headers.get("twitch-eventsub-message-timestamp") || new Date().toISOString(),
      raw: e,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook error" }, { status: 500 });
  }
}
