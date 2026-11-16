import { NextResponse } from "next/server";

import { cookieParametrlari, royxatdanOtish, SESSIYA_COOKIE } from "@/lib/auth";
import { xatoJavobi } from "@/lib/route";
import { boshSahifa } from "@/lib/ruxsat";

export const dynamic = "force-dynamic";

/** Ochiq ro‘yxatdan o‘tish: { ism, email, parol, takror } → kuzatuvchi hisobi va sessiya */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, foydalanuvchi } = await royxatdanOtish(body);
    const javob = NextResponse.json({ yonalish: boshSahifa(foydalanuvchi.rol) }, { status: 201 });
    javob.cookies.set(SESSIYA_COOKIE, token, cookieParametrlari());
    return javob;
  } catch (e) {
    return xatoJavobi(e);
  }
}
