/**
 * Har so‘rov oldidan: sessiya va rol tekshiruvi (lib/ruxsat.ts jadvali bo‘yicha, yopiq standart).
 * Kirmagan — kirish sahifasiga (API’da 401), roli mos emas — o‘z bosh sahifasiga (API’da 403),
 * vaqtinchalik parol bilan kirgan — avval parolni almashtirishi kerak.
 */
import { NextResponse, type NextRequest } from "next/server";

import { SESSIYA_COOKIE, sessiyaFoydalanuvchisi } from "@/lib/auth";
import { tarjimon, type Kalit } from "@/lib/i18n";
import { TIL_COOKIE, tilniOlish } from "@/lib/i18n/til";
import { boshSahifa, ochiqmi, ruxsatmi } from "@/lib/ruxsat";

const PAROLSIZ_OCHIQ = ["/profil", "/api/parol", "/api/chiqish"];

export async function proxy(req: NextRequest) {
  const yol = req.nextUrl.pathname;
  if (ochiqmi(yol)) return NextResponse.next();

  const api = yol.startsWith("/api/");
  const { t } = tarjimon(tilniOlish(req.cookies.get(TIL_COOKIE)?.value));
  const jsonXato = (status: number, kalit: Kalit) => NextResponse.json({ detail: t(kalit) }, { status });

  const token = req.cookies.get(SESSIYA_COOKIE)?.value;
  let f = null;
  if (token) {
    try {
      f = await sessiyaFoydalanuvchisi(token);
    } catch (e) {
      console.error("Sessiyani tekshirib bo‘lmadi:", e);
      return api ? jsonXato(503, "x.server") : NextResponse.redirect(new URL("/kirish", req.url));
    }
  }

  if (!f) {
    if (api) return jsonXato(401, "au.x.kirilmagan");
    const manzil = new URL("/kirish", req.url);
    if (yol !== "/") manzil.searchParams.set("keyin", yol + req.nextUrl.search);
    const javob = NextResponse.redirect(manzil);
    if (token) javob.cookies.delete(SESSIYA_COOKIE);
    return javob;
  }

  if (f.parol_almashtirilsin && !PAROLSIZ_OCHIQ.includes(yol)) {
    return api ? jsonXato(403, "au.x.parolAlmashtiring") : NextResponse.redirect(new URL("/profil", req.url));
  }

  if (!ruxsatmi(f.rol, yol, req.method)) {
    return api ? jsonXato(403, "au.x.ruxsatYoq") : NextResponse.redirect(new URL(boshSahifa(f.rol), req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Statik fayllar tekshirilmaydi
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
