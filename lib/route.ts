/** Route handler’lar uchun umumiy yordamchi: xatoliklarni foydalanuvchi tilidagi JSON javobga aylantiradi. */
import { NextResponse } from "next/server";

import { tarjimon } from "./i18n/index.ts";
import { joriyTil } from "./i18n/server.ts";
import { ApiError } from "./queries.ts";
import type { Rol } from "./ruxsat.ts";
import { apiTalab } from "./sessiya.ts";

export async function xatoJavobi(e: unknown, zaxira: "x.server" | "x.faylOqishXato" | "x.pdfXato" = "x.server") {
  const { t, x } = tarjimon(await joriyTil());
  if (e instanceof ApiError) {
    return NextResponse.json({ detail: e.xabarlar.map(x).join("; ") }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ detail: t(zaxira) }, { status: 500 });
}

/**
 * Route handler: natija JSON’da, xato — foydalanuvchi tilida.
 * rollar — bu amalga ruxsat berilgan rollar (proxy’dagi tekshiruvdan tashqari, ichki ikkinchi tekshiruv).
 */
export async function handle<T>(fn: () => T | Promise<T>, status = 200, rollar?: Rol[]) {
  try {
    if (rollar) await apiTalab(rollar);
    return NextResponse.json(await fn(), { status });
  } catch (e) {
    return xatoJavobi(e);
  }
}

/** Fayl nomini HTTP sarlavhasi uchun (lotin bo‘lmagan harflar bilan ham) tayyorlaydi. */
export function faylSarlavhasi(tur: "attachment" | "inline", fayl: string): string {
  const ascii = fayl.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `${tur}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fayl)}`;
}

export const raqam = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, "x.notogriId");
  return n;
};
