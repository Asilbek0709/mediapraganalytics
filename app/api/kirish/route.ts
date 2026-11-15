import { NextResponse } from "next/server";

import { cookieParametrlari, kirish, SESSIYA_COOKIE } from "@/lib/auth";
import { xatoJavobi } from "@/lib/route";
import { qaytishManzili } from "@/lib/ruxsat";

export const dynamic = "force-dynamic";

/** { email, parol, keyin? } → sessiya cookie’si va qaytish manzili */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, foydalanuvchi } = await kirish(body);
    const javob = NextResponse.json({
      yonalish: foydalanuvchi.parol_almashtirilsin ? "/profil" : qaytishManzili(body?.keyin, foydalanuvchi.rol),
    });
    javob.cookies.set(SESSIYA_COOKIE, token, cookieParametrlari());
    return javob;
  } catch (e) {
    return xatoJavobi(e);
  }
}
