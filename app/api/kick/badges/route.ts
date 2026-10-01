import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KickSubscriberBadge = {
  id: number;
  months: number;
  imageUrl: string;
};

type CacheEntry = {
  expiresAt: number;
  badges: KickSubscriberBadge[];
};

const cache = new Map<string, CacheEntry>();
const TTL = 60 * 60 * 1000;

function cleanSlug(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?kick\.com\//i, "")
    .split(/[/?#]/)[0]
    .replace(/^@/, "")
    .toLowerCase();
}

export async function GET(req: NextRequest) {
  const slug = cleanSlug(req.nextUrl.searchParams.get("slug") || "");
  if (!slug) {
    return NextResponse.json({ error: "slug obrigatório." }, { status: 400 });
  }

  const cached = cache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(
      { badges: cached.badges, cached: true },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    );
  }

  try {
    const res = await fetch(
      `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": "aCHATado/1.0 (+https://achatado.onrender.com)",
        },
      },
    );

    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      throw new Error(
        json?.message || `Kick respondeu ${res.status} ao consultar badges.`,
      );
    }

    const badges: KickSubscriberBadge[] = (
      Array.isArray(json.subscriber_badges) ? json.subscriber_badges : []
    )
      .map((badge: any) => ({
        id: Number(badge?.id || 0),
        months: Number(badge?.months || 0),
        imageUrl: String(
          badge?.badge_image?.src ||
            (badge?.id
              ? `https://files.kick.com/channel_subscriber_badges/${badge.id}/original`
              : ""),
        ),
      }))
      .filter(
        (badge: KickSubscriberBadge) =>
          badge.id > 0 && badge.months > 0 && Boolean(badge.imageUrl),
      )
      .sort((a: KickSubscriberBadge, b: KickSubscriberBadge) => a.months - b.months);

    cache.set(slug, {
      badges,
      expiresAt: Date.now() + TTL,
    });

    return NextResponse.json(
      { badges, cached: false },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        badges: cached?.badges || [],
        error:
          error instanceof Error
            ? error.message
            : "Falha ao carregar subscriber badges da Kick.",
      },
      {
        status: cached?.badges?.length ? 200 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
