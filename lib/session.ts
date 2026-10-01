import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { Platform, PlatformSession } from "@/lib/types";

const COOKIE_PREFIX = "usc_auth_";

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("SESSION_SECRET precisa ter pelo menos 24 caracteres.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(value: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decrypt<T>(value: string): T | null {
  try {
    const buf = Buffer.from(value, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const payload = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(payload), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function readPlatformSession(platform: Platform) {
  const jar = await cookies();
  const value = jar.get(`${COOKIE_PREFIX}${platform}`)?.value;
  return value ? decrypt<PlatformSession>(value) : null;
}

export function writePlatformSession(
  response: NextResponse,
  platform: Platform,
  session: PlatformSession,
) {
  response.cookies.set(`${COOKIE_PREFIX}${platform}`, encrypt(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearPlatformSession(response: NextResponse, platform: Platform) {
  response.cookies.set(`${COOKIE_PREFIX}${platform}`, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function writeOauthCookie(
  response: NextResponse,
  name: string,
  value: string,
  maxAge = 600,
) {
  response.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}
