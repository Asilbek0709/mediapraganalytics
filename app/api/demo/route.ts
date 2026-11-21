import { NextResponse } from "next/server";

import { cookieParametrlari, DEMO_SESSIYA_KUN, demoKirish, SESSIYA_COOKIE, sessiyaniTugatish } from "@/lib/auth";
import { ApiError } from "@/lib/queries";
import { xatoJavobi } from "@/lib/route";
import { sessiyaTokeni } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

/** Brauzer so‘rov boshqa saytdan kelganini aytsa (Sec-Fetch-Site yoki Origin bo‘yicha) — true */
function begonaSaytdan(req: Request): boolean {
  const sayt = req.headers.get("sec-fetch-site");
  if (sayt && sayt !== "same-origin" && sayt !== "none") return true;
  const manba = req.headers.get("origin");
  if (!manba) return false;
  const xost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(manba).host !== xost;
  } catch {
    return true;
  }
}

/**
 * «Demo ko‘rish»: parolsiz, faqat ko‘rish huquqi bilan qisqa sessiya. Boshqa saytdan yuborilgan so‘rov
 * (kimnidir uning hisobidan chiqarib, demo’ga «kiritib qo‘yish») rad etiladi.
 */
export async function POST(req: Request) {
  try {
    if (begonaSaytdan(req)) throw new ApiError(403, "au.x.ruxsatYoq");
    // oldingi sessiya (bo‘lsa) yopiladi — bazada egasiz sessiya qolmasin
    await sessiyaniTugatish(await sessiyaTokeni());
    const { token } = await demoKirish();
    const javob = NextResponse.json({ yonalish: "/" });
    javob.cookies.set(SESSIYA_COOKIE, token, cookieParametrlari(DEMO_SESSIYA_KUN));
    return javob;
  } catch (e) {
    return xatoJavobi(e);
  }
}
