/**
 * Ikki davrni taqqoslash (A va B): o‘rtacha K1–K5 va LPSI, muammolar ulushi,
 * farqning statistik ahamiyati (Mann–Whitney U, Fisher + Holm).
 *
 * Toza modul (faqat statistika va tiplar) — Analitika sahifasida mijozda darhol qayta hisoblanadi,
 * Excel eksportida esa serverda xuddi shu funksiya ishlatiladi.
 */
// «.ts» kengaytmasi bilan — Node testlari ham shu modulni to‘g‘ridan-to‘g‘ri yuklay oladi
import { sana } from "./format.ts";
import { fisherAniq, holm, mannWhitney, mediana, rEffekti, type EffektKuchi, type MannWhitneyNatija } from "./statistika.ts";
import type { MediaTuri } from "./types";

export const KORSATKICHLAR = ["k1", "k2", "k3", "k4", "k5", "lpsi"] as const;
export type Korsatkich = (typeof KORSATKICHLAR)[number];

/** Analitikadagi to‘liq tahlil qilingan material (mijozga uzatiladigan qisqa ko‘rinish). */
export interface AnalitikaMateriali {
  id: number;
  nashr_id: number;
  nashr: string;
  media_turi: MediaTuri;
  sana: string | null;
  janr: string;
  sarlavha: string;
  k1: number | null;
  k2: number | null;
  k3: number | null;
  k4: number | null;
  k5: number | null;
  lpsi: number | null;
  daraja: string | null;
  /** muammo kategoriyalari bo‘yicha belgilar soni */
  sanoq: Record<string, number>;
}

/** Sanalar oralig‘i (ikkala chegara ham kiradi), YYYY-MM-DD */
export interface Oraliq {
  dan: string;
  gacha: string;
}

export type TaklifTuri = "yillar" | "teng";
export interface DavrTaklifi {
  tur: TaklifTuri;
  a: Oraliq;
  b: Oraliq;
}

const SANA = /^\d{4}-\d{2}-\d{2}$/;
export const sanami = (s: string | null | undefined): s is string => !!s && SANA.test(s.slice(0, 10));
export const oraliqmi = (o: Partial<Oraliq> | null | undefined): o is Oraliq =>
  !!o && sanami(o.dan) && sanami(o.gacha) && o.dan <= o.gacha;
const ichida = (sana: string, o: Oraliq) => sana >= o.dan && sana <= o.gacha;
export const kesishadi = (a: Oraliq, b: Oraliq) => a.dan <= b.gacha && b.dan <= a.gacha;

/**
 * Tayyor davr juftlari: ketma-ket yillar (eng yangisi birinchi, ko‘pi bilan 3 ta)
 * va «teng ikkiga» — sana bo‘yicha mediana: ikki guruh deyarli teng bo‘ladi.
 */
export function davrTakliflari(sanalar: (string | null)[]): DavrTaklifi[] {
  const s = sanalar.filter(sanami).map((x) => x.slice(0, 10)).sort();
  if (s.length < 2) return [];
  const natija: DavrTaklifi[] = [];

  const yillar = [...new Set(s.map((x) => x.slice(0, 4)))].sort();
  for (let i = yillar.length - 1; i > 0 && natija.length < 3; i--) {
    const [y1, y2] = [yillar[i - 1], yillar[i]];
    natija.push({ tur: "yillar", a: { dan: `${y1}-01-01`, gacha: `${y1}-12-31` }, b: { dan: `${y2}-01-01`, gacha: `${y2}-12-31` } });
  }

  // Bir kunga to‘g‘ri kelgan materiallar bo‘linmasligi uchun chegara sanalar o‘zgargan joyda, o‘rtaga eng yaqin
  const orta = s.length / 2;
  let eng: number | null = null;
  for (let i = 1; i < s.length; i++) {
    if (s[i - 1] < s[i] && (eng == null || Math.abs(i - orta) < Math.abs(eng - orta))) eng = i;
  }
  if (eng != null) natija.push({ tur: "teng", a: { dan: s[0], gacha: s[eng - 1] }, b: { dan: s[eng], gacha: s[s.length - 1] } });
  return natija;
}

export interface DavrQatori {
  korsatkich: Korsatkich;
  a: { n: number; ortacha: number | null; mediana: number | null };
  b: { n: number; ortacha: number | null; mediana: number | null };
  /** B − A (o‘rtachalar) */
  farq: number | null;
  test: MannWhitneyNatija | null;
  effekt: EffektKuchi | null;
}

export interface DavrMuammoQatori {
  kod: string;
  nomi: string;
  a: { bor: number; n: number; ulush: number };
  b: { bor: number; n: number; ulush: number };
  /** B − A, foiz punkti */
  farq: number;
  p: number;
  pHolm: number;
}

export interface DavrTaqqos {
  a: { oraliq: Oraliq; n: number };
  b: { oraliq: Oraliq; n: number };
  /** davrlar kesishsa, bir material ikkala guruhga tushishi mumkin — testlar o‘tkazilmaydi */
  kesishadi: boolean;
  /** sanasi ko‘rsatilmagan (taqqoslashga kirmagan) materiallar */
  sanasiz: number;
  qatorlar: DavrQatori[];
  muammolar: DavrMuammoQatori[];
}

const yaxlit = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
const ortacha = (xs: number[]) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : null);

export function davrTaqqoslash(
  materiallar: AnalitikaMateriali[],
  a: Oraliq,
  b: Oraliq,
  muammolar: { kod: string; nomi: string }[],
): DavrTaqqos {
  const sanali = materiallar.filter((m) => sanami(m.sana));
  const ga = sanali.filter((m) => ichida(m.sana!.slice(0, 10), a));
  const gb = sanali.filter((m) => ichida(m.sana!.slice(0, 10), b));
  const kes = kesishadi(a, b);
  const testlar = !kes && ga.length >= 2 && gb.length >= 2;

  const qatorlar: DavrQatori[] = KORSATKICHLAR.map((k) => {
    const xa = ga.map((m) => m[k]).filter((v): v is number => v != null);
    const xb = gb.map((m) => m[k]).filter((v): v is number => v != null);
    const oa = ortacha(xa);
    const ob = ortacha(xb);
    // B birinchi guruh: r > 0 — B davrda yuqori, «Farq (B − A)» ishorasi bilan bir xil
    const test = testlar ? mannWhitney(xb, xa) : null;
    return {
      korsatkich: k,
      a: { n: xa.length, ortacha: yaxlit(oa), mediana: yaxlit(mediana(xa)) },
      b: { n: xb.length, ortacha: yaxlit(ob), mediana: yaxlit(mediana(xb)) },
      farq: oa != null && ob != null ? yaxlit(ob - oa) : null,
      test,
      effekt: test ? rEffekti(test.r) : null,
    };
  });

  const sanash = (g: AnalitikaMateriali[], kod: string) => {
    const bor = g.filter((m) => (m.sanoq[kod] ?? 0) > 0).length;
    return { bor, n: g.length, ulush: g.length ? Math.round((bor / g.length) * 1000) / 10 : 0 };
  };
  const xom = muammolar.map((k) => {
    const sa = sanash(ga, k.kod);
    const sb = sanash(gb, k.kod);
    return {
      kod: k.kod,
      nomi: k.nomi,
      a: sa,
      b: sb,
      farq: Math.round((sb.ulush - sa.ulush) * 10) / 10,
      p: testlar ? fisherAniq(sa.bor, sa.n - sa.bor, sb.bor, sb.n - sb.bor) : 1,
    };
  });
  const tuzatilgan = holm(xom.map((q) => q.p));

  return {
    a: { oraliq: a, n: ga.length },
    b: { oraliq: b, n: gb.length },
    kesishadi: kes,
    sanasiz: materiallar.length - sanali.length,
    qatorlar,
    muammolar: xom.map((q, i) => ({ ...q, pHolm: testlar ? tuzatilgan[i] : 1 })),
  };
}

/** Davr nomi: «2025», «Mart 2025» yoki «01.03.2025–15.04.2025» (davr — tarjimondagi oy/chorak nomlari). */
export function davrNomi(o: Oraliq, davr: (kalit: string) => string): string {
  const k = davrKaliti(o);
  return k ? davr(k) : `${sana(o.dan)}–${sana(o.gacha)}`;
}

/** Davr qisqa nomi: butun yil → «2025», butun oy → «2025-03», aks holda null (sanalar bilan yoziladi). */
export function davrKaliti(o: Oraliq): string | null {
  const [y1, m1, d1] = o.dan.split("-");
  const [y2, m2, d2] = o.gacha.split("-");
  if (y1 === y2 && m1 === "01" && d1 === "01" && m2 === "12" && d2 === "31") return y1;
  if (y1 === y2 && m1 === m2 && d1 === "01") {
    const oxirgiKun = new Date(Date.UTC(Number(y1), Number(m1), 0)).getUTCDate();
    if (Number(d2) === oxirgiKun) return `${y1}-${m1}`;
  }
  return null;
}
