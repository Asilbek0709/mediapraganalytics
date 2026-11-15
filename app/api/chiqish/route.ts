import { NextResponse } from "next/server";

import { SESSIYA_COOKIE, sessiyaniTugatish } from "@/lib/auth";
import { xatoJavobi } from "@/lib/route";
import { sessiyaTokeni } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await sessiyaniTugatish(await sessiyaTokeni());
    const javob = NextResponse.json({ ok: true });
    javob.cookies.delete(SESSIYA_COOKIE);
    return javob;
  } catch (e) {
    return xatoJavobi(e);
  }
}
