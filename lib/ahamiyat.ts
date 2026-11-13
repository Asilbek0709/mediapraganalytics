/**
 * Guruhlar orasidagi farqlarning statistik ahamiyati (Analitika va Excel uchun).
 *
 * - Bosma va raqamli media: K1–K5 va LPSI bo‘yicha Mann–Whitney U, muammolar ulushi bo‘yicha Fisher testi.
 * - Nashrlar va janrlar: Kruskal–Wallis H, ahamiyatli bo‘lsa — Dunn post-hoc (Holm tuzatishi bilan).
 *
 * Faqat to‘liq tahlil qilingan materiallar. Nomlar (nashr, janr, kategoriya) bazadagidek qaytariladi —
 * tarjima mijozda.
 */
import type { MaterialQator } from "./analytics";
import { JANR_YOQ } from "./format";
import {
  dunn,
  epsilonEffekti,
  fisherAniq,
  holm,
  kruskalWallis,
  mannWhitney,
  mediana,
  rEffekti,
  type EffektKuchi,
  type KruskalNatija,
  type MannWhitneyNatija,
} from "./statistika";
import type { Metodika } from "./types";

export const ALFA = 0.05;
/** Kruskal–Wallis’ga kiradigan guruhning eng kichik hajmi */
export const MIN_GURUH = 3;

export const KORSATKICHLAR = ["k1", "k2", "k3", "k4", "k5", "lpsi"] as const;
export type Korsatkich = (typeof KORSATKICHLAR)[number];

/** Bo‘lim hisoblanmagan sabab: filtr bitta guruhni tanlagan yoki ma’lumot yetarli emas */
export type BolimHolati = "ok" | "filtr" | "kam";

const qiymatlar = (qs: MaterialQator[], k: Korsatkich) => qs.map((q) => q[k]).filter((v): v is number => v != null);
const yaxlit = (v: number | null, kasr = 1) => (v == null ? null : Math.round(v * 10 ** kasr) / 10 ** kasr);

export interface IkkiGuruhQatori {
  korsatkich: Korsatkich;
  bosma: { n: number; mediana: number | null };
  raqamli: { n: number; mediana: number | null };
  test: MannWhitneyNatija | null;
  effekt: EffektKuchi | null;
}

export interface MuammoTestQatori {
  kod: string;
  nomi: string;
  bosma: { bor: number; n: number; ulush: number };
  raqamli: { bor: number; n: number; ulush: number };
  p: number;
  pHolm: number;
}

export interface JuftFarq {
  /** o‘rtacha rangi yuqori guruh */
  yuqori: string;
  past: string;
  z: number;
  pHolm: number;
}

export interface KopGuruhQatori {
  korsatkich: Korsatkich;
  test: KruskalNatija | null;
  effekt: EffektKuchi | null;
  /** Holm bo‘yicha ahamiyatli juftlar (faqat H ahamiyatli bo‘lsa) */
  juftlar: JuftFarq[];
}

export interface KopGuruhBolimi {
  holat: BolimHolati;
  guruhlar: { nomi: string; n: number }[];
  /** MIN_GURUH dan kichik bo‘lgani uchun chiqarilgan guruhlar */
  chiqarilgan: { nomi: string; n: number }[];
  qatorlar: KopGuruhQatori[];
}

export interface Ahamiyat {
  alfa: number;
  minGuruh: number;
  media: { holat: BolimHolati; qatorlar: IkkiGuruhQatori[]; muammolar: MuammoTestQatori[] };
  nashr: KopGuruhBolimi;
  janr: KopGuruhBolimi;
}

function ikkiGuruh(bosma: MaterialQator[], raqamli: MaterialQator[]): IkkiGuruhQatori[] {
  return KORSATKICHLAR.map((k) => {
    const a = qiymatlar(bosma, k);
    const b = qiymatlar(raqamli, k);
    const test = mannWhitney(a, b);
    return {
      korsatkich: k,
      bosma: { n: a.length, mediana: yaxlit(mediana(a)) },
      raqamli: { n: b.length, mediana: yaxlit(mediana(b)) },
      test,
      effekt: test ? rEffekti(test.r) : null,
    };
  });
}

function muammoTestlari(bosma: MaterialQator[], raqamli: MaterialQator[], m: Metodika): MuammoTestQatori[] {
  const muammolar = Object.values(m.kategoriyalar).filter((k) => k.guruh === "muammo");
  const sanash = (qs: MaterialQator[], kod: string) => {
    const bor = qs.filter((q) => (q.sanoq[kod] ?? 0) > 0).length;
    return { bor, n: qs.length, ulush: qs.length ? Math.round((bor / qs.length) * 1000) / 10 : 0 };
  };
  const qatorlar = muammolar.map((k) => {
    const b = sanash(bosma, k.kod);
    const r = sanash(raqamli, k.kod);
    return { kod: k.kod, nomi: k.nomi, bosma: b, raqamli: r, p: fisherAniq(b.bor, b.n - b.bor, r.bor, r.n - r.bor) };
  });
  // Kategoriyalar soni ko‘p — tasodifiy «ahamiyatli» natijalardan saqlanish uchun Holm tuzatishi
  const tuzatilgan = holm(qatorlar.map((q) => q.p));
  return qatorlar.map((q, i) => ({ ...q, pHolm: tuzatilgan[i] }));
}

function kopGuruh(t: MaterialQator[], kalit: (q: MaterialQator) => string | null): KopGuruhBolimi {
  const guruhlar = new Map<string, MaterialQator[]>();
  for (const q of t) {
    const k = kalit(q);
    if (k == null) continue;
    guruhlar.set(k, [...(guruhlar.get(k) ?? []), q]);
  }
  const hammasi = [...guruhlar.entries()].map(([nomi, qs]) => ({ nomi, qs })).sort((a, b) => b.qs.length - a.qs.length);
  const kirgan = hammasi.filter((g) => g.qs.length >= MIN_GURUH);
  const chiqarilgan = hammasi.filter((g) => g.qs.length < MIN_GURUH).map((g) => ({ nomi: g.nomi, n: g.qs.length }));
  const tavsif = kirgan.map((g) => ({ nomi: g.nomi, n: g.qs.length }));
  if (kirgan.length < 2) return { holat: "kam", guruhlar: tavsif, chiqarilgan, qatorlar: [] };

  const qatorlar = KORSATKICHLAR.map((k) => {
    const g = kirgan.map((x) => qiymatlar(x.qs, k));
    const test = kruskalWallis(g);
    const juftlar =
      test && test.p < ALFA
        ? dunn(g)
            .filter((j) => j.pHolm < ALFA)
            .map((j) => {
              const [yuqori, past] = j.z >= 0 ? [j.i, j.j] : [j.j, j.i];
              return { yuqori: kirgan[yuqori].nomi, past: kirgan[past].nomi, z: Math.abs(j.z), pHolm: j.pHolm };
            })
            .sort((a, b) => a.pHolm - b.pHolm)
        : [];
    return { korsatkich: k, test, effekt: test ? epsilonEffekti(test.epsilon2) : null, juftlar };
  });
  return { holat: "ok", guruhlar: tavsif, chiqarilgan, qatorlar };
}

/** @param t to‘liq tahlil qilingan (LPSI bor) materiallar — filtr allaqachon qo‘llangan */
export function ahamiyatTestlari(
  t: MaterialQator[],
  m: Metodika,
  filtr: { turi?: string; nashr_id?: number; janr?: string } = {},
): Ahamiyat {
  const bosma = t.filter((q) => q.media_turi === "bosma");
  const raqamli = t.filter((q) => q.media_turi === "raqamli");
  const mediaHolati: BolimHolati = filtr.turi ? "filtr" : bosma.length < 2 || raqamli.length < 2 ? "kam" : "ok";

  const bosh: KopGuruhBolimi = { holat: "filtr", guruhlar: [], chiqarilgan: [], qatorlar: [] };
  return {
    alfa: ALFA,
    minGuruh: MIN_GURUH,
    media: {
      holat: mediaHolati,
      qatorlar: mediaHolati === "ok" ? ikkiGuruh(bosma, raqamli) : [],
      muammolar: mediaHolati === "ok" ? muammoTestlari(bosma, raqamli, m) : [],
    },
    nashr: filtr.nashr_id ? bosh : kopGuruh(t, (q) => q.nashr),
    // Janri ko‘rsatilmagan materiallar alohida janr emas — testga kirmaydi
    janr: filtr.janr ? bosh : kopGuruh(t, (q) => (q.janr && q.janr !== JANR_YOQ ? q.janr : null)),
  };
}
