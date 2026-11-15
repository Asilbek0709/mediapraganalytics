/**
 * Joriy foydalanuvchi — sahifalar va API uchun (Next cookies() orqali). Bir so‘rov davomida bir marta o‘qiladi.
 * Proxy har so‘rovni jadval bo‘yicha tekshiradi; bu yerdagi talab*() — sahifa/API ichidagi ikkinchi tekshiruv.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { cache } from "react";

import { SESSIYA_COOKIE, sessiyaFoydalanuvchisi, type Foydalanuvchi } from "./auth.ts";
import { ApiError } from "./queries.ts";
import { boshSahifa, type Rol } from "./ruxsat.ts";
import { avtoZaxira } from "./zaxira.ts";

export const joriyFoydalanuvchi = cache(async (): Promise<Foydalanuvchi | null> => {
  const token = (await cookies()).get(SESSIYA_COOKIE)?.value;
  return sessiyaFoydalanuvchisi(token);
});

export async function sessiyaTokeni(): Promise<string | undefined> {
  return (await cookies()).get(SESSIYA_COOKIE)?.value;
}

/** Sahifa uchun: kirmagan bo‘lsa — kirish sahifasiga, roli mos kelmasa — o‘z bosh sahifasiga. */
export async function sahifaTalab(rollar?: Rol[]): Promise<Foydalanuvchi> {
  const f = await joriyFoydalanuvchi();
  if (!f) redirect("/kirish");
  if (rollar && !rollar.includes(f.rol)) redirect(boshSahifa(f.rol));
  avtoZaxiraRejalash();
  return f;
}

/** API uchun: 401 / 403 (javob foydalanuvchi tilida — route.ts dagi handle orqali). */
export async function apiTalab(rollar?: Rol[]): Promise<Foydalanuvchi> {
  const f = await joriyFoydalanuvchi();
  if (!f) throw new ApiError(401, "au.x.kirilmagan");
  if (rollar && !rollar.includes(f.rol)) throw new ApiError(403, "au.x.ruxsatYoq");
  return f;
}

// Kunlik avtomatik zaxira: sahifa javobidan keyin, bir server nusxasida soatiga ko‘pi bilan bir tekshiruv
const g = globalThis as unknown as { mediapragAvto?: number };
function avtoZaxiraRejalash() {
  if (process.env.MEDIAPRAG_AVTO_ZAXIRA === "0") return;
  if (Date.now() - (g.mediapragAvto ?? 0) < 3600_000) return;
  g.mediapragAvto = Date.now();
  after(async () => {
    try {
      await avtoZaxira();
    } catch (e) {
      console.error("Avtomatik zaxira olinmadi:", e);
    }
  });
}

/** Ekspert qatlami bo‘yicha amal: administrator — istalgan ekspert, ekspert — faqat o‘zi (aks holda 403). */
export async function ozQatlami(ekspertId: number): Promise<number> {
  const f = await apiTalab(["admin", "ekspert"]);
  if (f.rol === "ekspert" && f.ekspert_id !== ekspertId) throw new ApiError(403, "au.x.ruxsatYoq");
  return ekspertId;
}
