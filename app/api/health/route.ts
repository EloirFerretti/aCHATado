import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "achatado",
    databaseConfigured: dbConfigured,
    timestamp: new Date().toISOString(),
  });
}
