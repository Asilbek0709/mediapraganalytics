/**
 * Zaxira nusxa formati (toza modul — bazaga murojaat qilmaydi): JSON tuzilishi, tekshiruv va sanoqlar.
 *
 * Nusxa — barcha ma’lumot jadvallari JSON’da, gzip bilan siqilgan. Foydalanuvchilar va sessiyalar
 * nusxaga kirmaydi: tiklash hisoblarni o‘zgartirmaydi.
 */
export type ZaxiraTuri = "qolda" | "avto" | "tiklashdan_oldin" | "yuklangan";
export const ZAXIRA_TURLARI: ZaxiraTuri[] = ["qolda", "avto", "tiklashdan_oldin", "yuklangan"];

/** Avtomatik o‘chiriladigan turlar uchun saqlanadigan nusxalar soni (qo‘lda va yuklanganlar o‘chirilmaydi). */
export const SAQLANADI: Partial<Record<ZaxiraTuri, number>> = { avto: 14, tiklashdan_oldin: 10 };

/** MediaPrag bazasi ekanini bildiruvchi jadvallar (eski versiyalarda ham bor). */
export const ZARUR_JADVALLAR = [
  "nashrlar",
  "materiallar",
  "tahlillar",
  "belgilar",
  "kategoriyalar",
  "lugat",
  "mezonlar",
  "sozlamalar",
  "metodika_tarixi",
];

export type Qator = Record<string, unknown>;

export interface ZaxiraMalumoti {
  format: "mediaprag-zaxira";
  versiya: 1;
  sxema: number;
  yaratilgan: string;
  jadvallar: Record<string, Qator[]>;
}

export interface Statistika {
  nashrlar: number;
  materiallar: number;
  /** to‘liq tahlil qilingan (LPSI hisoblangan) */
  tahlillar: number;
  belgilar: number;
  ekspertlar: number;
  ekspert_tahlillari: number;
  metodika_versiya: number | null;
  /** material, tahlil yoki ekspert tahlilining eng so‘nggi o‘zgarish vaqti */
  oxirgi_ozgarish: string | null;
}

export function zaxiraStatistikasi(z: ZaxiraMalumoti): Statistika {
  const j = (nom: string) => z.jadvallar[nom] ?? [];
  let oxirgi: string | null = null;
  for (const nom of ["materiallar", "tahlillar", "ekspert_tahlillari"]) {
    for (const q of j(nom)) {
      const v = typeof q.yangilangan === "string" ? q.yangilangan : null;
      if (v && (!oxirgi || v > oxirgi)) oxirgi = v;
    }
  }
  const versiya = j("sozlamalar").find((q) => q.kalit === "metodika_versiya")?.qiymat;
  return {
    nashrlar: j("nashrlar").length,
    materiallar: j("materiallar").length,
    tahlillar: j("tahlillar").filter((q) => q.lpsi != null).length,
    belgilar: j("belgilar").length,
    ekspertlar: j("ekspertlar").length,
    ekspert_tahlillari: j("ekspert_tahlillari").length,
    metodika_versiya: versiya == null ? null : Number(versiya),
    oxirgi_ozgarish: oxirgi,
  };
}

export type TekshiruvXatosi = { xato: "format" } | { xato: "jadval"; jadval: string };

/** JSON nusxani tekshiradi: format belgisi, jadvallar massivlar, zarur jadvallar mavjud. */
export function zaxiraniTekshirish(x: unknown): { zaxira: ZaxiraMalumoti } | TekshiruvXatosi {
  const z = x as Partial<ZaxiraMalumoti> | null;
  if (!z || typeof z !== "object" || z.format !== "mediaprag-zaxira" || !z.jadvallar || typeof z.jadvallar !== "object") {
    return { xato: "format" };
  }
  for (const [nom, qatorlar] of Object.entries(z.jadvallar)) {
    if (!Array.isArray(qatorlar) || qatorlar.some((q) => !q || typeof q !== "object" || Array.isArray(q))) return { xato: "format" };
    if (!/^[a-z_]+$/.test(nom)) return { xato: "format" };
  }
  const yoq = ZARUR_JADVALLAR.find((j) => !Array.isArray(z.jadvallar![j]));
  if (yoq) return { xato: "jadval", jadval: yoq };
  return { zaxira: z as ZaxiraMalumoti };
}

export function vaqtBelgisi(iso: string): string {
  return iso.slice(0, 19).replace("T", "_").replace(/:/g, "-");
}

/** «mediaprag_2026-11-06_14-30-05_qolda.json.gz» */
export const zaxiraNomi = (vaqt: string, tur: ZaxiraTuri) => `mediaprag_${vaqtBelgisi(vaqt)}_${tur}.json.gz`;
