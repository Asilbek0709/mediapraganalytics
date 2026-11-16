import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { avtoZaxira } from "@/lib/zaxira";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Kunlik avtomatik zaxira (ТЗ v2, 1-bosqich, 5-band) — Vercel Cron chaqiradi (vercel.json).
 * Vercel so‘rovga «Authorization: Bearer <CRON_SECRET>» qo‘shadi; kalitsiz so‘rov rad etiladi.
 * Platformadan foydalanilmagan kunlarda ham nusxa yaratiladi.
 */
export async function GET(req: Request) {
  const kalit = process.env.CRON_SECRET;
  const kelgan = req.headers.get("authorization") ?? "";
  const kutilgan = `Bearer ${kalit ?? ""}`;
  if (!kalit || kelgan.length !== kutilgan.length || !timingSafeEqual(Buffer.from(kelgan), Buffer.from(kutilgan))) {
    return NextResponse.json({ detail: "Ruxsat yo‘q" }, { status: 401 });
  }
  try {
    const nom = await avtoZaxira();
    return NextResponse.json({ ok: true, yaratildi: nom });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
