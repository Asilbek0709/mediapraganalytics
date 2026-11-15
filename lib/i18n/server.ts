/** Serverda joriy til va ko‘rinishni cookie’dan o‘qish (faqat server komponentlari va route handler’lar uchun). */
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { tarjimon, type Kalit } from "./index.ts";
import { MAVZU_COOKIE, TIL_COOKIE, mavzuniOlish, tilniOlish, type Mavzu, type Til } from "./til.ts";

export async function joriyTil(): Promise<Til> {
  return tilniOlish((await cookies()).get(TIL_COOKIE)?.value);
}

export async function joriyMavzu(): Promise<Mavzu> {
  return mavzuniOlish((await cookies()).get(MAVZU_COOKIE)?.value);
}

export async function serverTarjimon() {
  return tarjimon(await joriyTil());
}

/** Sahifa sarlavhasi joriy tilda: «Analitika — MediaPrag-Analytics». */
export async function sahifaSarlavhasi(kalit: Kalit, qoshimcha?: string): Promise<Metadata> {
  const { t } = await serverTarjimon();
  return { title: `${t(kalit)}${qoshimcha ? ` ${qoshimcha}` : ""} — MediaPrag-Analytics` };
}
