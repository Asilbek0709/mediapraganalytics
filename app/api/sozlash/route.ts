import { NextResponse } from "next/server";

import { birinchiAdmin, cookieParametrlari, SESSIYA_COOKIE } from "@/lib/auth";
import { xatoJavobi } from "@/lib/route";

export const dynamic = "force-dynamic";

/** Birinchi administrator: { email, ism, parol, kalit? } — faqat hali administrator bo‘lmasa */
export async function POST(req: Request) {
  try {
    const { token } = await birinchiAdmin(await req.json().catch(() => ({})));
    const javob = NextResponse.json({ yonalish: "/" });
    javob.cookies.set(SESSIYA_COOKIE, token, cookieParametrlari());
    return javob;
  } catch (e) {
    return xatoJavobi(e);
  }
}
