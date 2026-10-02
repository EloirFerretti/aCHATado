import { NextRequest, NextResponse } from "next/server";
import { readPlatformSession, writePlatformSession } from "@/lib/session";
import { refreshPlatformSession } from "@/lib/platform-auth";
import type { Platform } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ModerationRole = "owner" | "moderator" | "none" | "unknown";

function isPlatform(value: unknown): value is Platform {
  return value === "twitch" || value === "kick" || value === "youtube";
}

function responseWithSession(
  body: {
    platform: Platform;
    role: ModerationRole;
    verified: boolean;
    reconnectRequired?: boolean;
  },
  platform: Platform,
  stored: Awaited<ReturnType<typeof readPlatformSession>>,
  refreshed: Awaited<ReturnType<typeof refreshPlatformSession>>,
) {
  const response = NextResponse.json(body);
  if (stored && refreshed.accessToken !== stored.accessToken) {
    writePlatformSession(response, platform, refreshed);
  }
  return response;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const platform = payload.platform;
    const channelId =
      typeof payload.channelId === "string" ? payload.channelId.trim() : "";

    if (!isPlatform(platform) || !channelId) {
      return NextResponse.json(
        { error: "Plataforma ou canal inválido." },
        { status: 400 },
      );
    }

    const stored = await readPlatformSession(platform);
    if (!stored) {
      return NextResponse.json({
        platform,
        role: "none",
        verified: true,
      });
    }

    const session = await refreshPlatformSession(platform, stored);
    const userId = String(session.userId || "").trim();

    if (!userId) {
      return responseWithSession(
        {
          platform,
          role: "unknown",
          verified: false,
        },
        platform,
        stored,
        session,
      );
    }

    if (userId === channelId) {
      return responseWithSession(
        {
          platform,
          role: "owner",
          verified: true,
        },
        platform,
        stored,
        session,
      );
    }

    if (platform !== "twitch") {
      return responseWithSession(
        {
          platform,
          role: "unknown",
          verified: false,
        },
        platform,
        stored,
        session,
      );
    }

    const requiredScope = "user:read:moderated_channels";
    if (!session.scope?.includes(requiredScope)) {
      return responseWithSession(
        {
          platform,
          role: "unknown",
          verified: false,
          reconnectRequired: true,
        },
        platform,
        stored,
        session,
      );
    }

    let after = "";
    for (let page = 0; page < 10; page += 1) {
      const url = new URL("https://api.twitch.tv/helix/moderation/channels");
      url.searchParams.set("user_id", userId);
      url.searchParams.set("first", "100");
      if (after) url.searchParams.set("after", after);

      const upstream = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID || "",
        },
        cache: "no-store",
      });
      const data = await upstream.json().catch(() => ({}));

      if (!upstream.ok) {
        return responseWithSession(
          {
            platform,
            role: "unknown",
            verified: false,
            reconnectRequired: upstream.status === 401 || upstream.status === 403,
          },
          platform,
          stored,
          session,
        );
      }

      const channels = Array.isArray(data?.data) ? data.data : [];
      if (
        channels.some(
          (channel: any) => String(channel?.broadcaster_id || "") === channelId,
        )
      ) {
        return responseWithSession(
          {
            platform,
            role: "moderator",
            verified: true,
          },
          platform,
          stored,
          session,
        );
      }

      after = String(data?.pagination?.cursor || "");
      if (!after) break;
    }

    return responseWithSession(
      {
        platform,
        role: "none",
        verified: true,
      },
      platform,
      stored,
      session,
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao verificar permissão de moderação.",
      },
      { status: 500 },
    );
  }
}
