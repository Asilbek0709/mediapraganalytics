/**
 * Reytinglar: nashrlar va materiallar o‘rni (toza modul — mijozda ham, Excel’da ham).
 *
 * O‘rinlar «musobaqa» usulida: teng qiymatlar bir xil o‘rinni oladi, keyingisi
 * o‘tkazib yuboriladi (1, 2, 2, 4). Qiymatlar ekrandagidek 0,1 gacha yaxlitlanib solishtiriladi —
 * ekranda teng ko‘ringan nashrlar har xil o‘rinda turmaydi.
 */
import type { AnalitikaMateriali, Korsatkich } from "./davrlar.ts";
import type { Kesim } from "./types.ts";

/** Reytingdagi o‘rin ishonchli bo‘lishi uchun nashrda kerakli eng kam material */
export const MIN_REYTING = 3;

const yaxlit = (v: number) => Math.round(v * 10) / 10;

/** Kamayish tartibida o‘rinlar; null qiymat — o‘rinsiz (null). */
export function orinlar(qiymatlar: (number | null)[]): (number | null)[] {
  const bor = qiymatlar.filter((v): v is number => v != null).map(yaxlit);
  return qiymatlar.map((v) => (v == null ? null : 1 + bor.filter((x) => x > yaxlit(v)).length));
}

export interface NashrOrni {
  orin: number;
  /** teng o‘rindagilar bilan bo‘lishilgan («2–3» o‘rniga «=2») */
  teng: boolean;
  nomi: string;
  media_turi?: Kesim["media_turi"];
  soni: number;
  qiymat: number;
  daraja: string | null;
  /** MIN_REYTING dan kam material — o‘rin shartli */
  kam: boolean;
}

export function nashrReytingi(nashrlar: Kesim[], k: Korsatkich): NashrOrni[] {
  const bor = nashrlar.filter((n) => n[k] != null);
  const o = orinlar(bor.map((n) => n[k]));
  return bor
    .map((n, i) => ({
      orin: o[i]!,
      teng: o.filter((x) => x === o[i]).length > 1,
      nomi: n.nomi,
      media_turi: n.media_turi,
      soni: n.soni,
      qiymat: n[k]!,
      daraja: k === "lpsi" ? n.daraja : null,
      kam: n.soni < MIN_REYTING,
    }))
    .sort((a, b) => a.orin - b.orin || b.soni - a.soni || a.nomi.localeCompare(b.nomi));
}

export interface MaterialOrni {
  orin: number;
  m: AnalitikaMateriali;
  qiymat: number;
}

/**
 * Materiallar reytingi. Ro‘yxat 2·soni dan uzun bo‘lsa — eng yuqori va eng past `soni` tadan,
 * aks holda bitta to‘liq ro‘yxat (yuqori va past bir-birini takrorlamasligi uchun).
 */
export function materialReytingi(
  materiallar: AnalitikaMateriali[],
  k: Korsatkich,
  soni = 10,
): { toliq: boolean; yuqori: MaterialOrni[]; past: MaterialOrni[] } {
  const bor = materiallar.filter((m) => m[k] != null);
  const o = orinlar(bor.map((m) => m[k]));
  const royxat = bor
    .map((m, i) => ({ orin: o[i]!, m, qiymat: m[k]! }))
    .sort((a, b) => a.orin - b.orin || (b.m.sana ?? "").localeCompare(a.m.sana ?? "") || a.m.id - b.m.id);
  if (royxat.length <= soni * 2) return { toliq: true, yuqori: royxat, past: [] };
  return { toliq: false, yuqori: royxat.slice(0, soni), past: royxat.slice(-soni).reverse() };
}
