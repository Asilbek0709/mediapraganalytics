/**
 * Ochiq bosh sahifa (kirishsiz): platforma haqida, dissertatsiya mavzusi va muallifi, LPSI formulasi va shkalasi,
 * umumiy ko‘rsatkichlar — haqiqiy bazadan, statistikaga kiradigan materiallar bo‘yicha (sun’iy va tekshirilmaganlar
 * kirmaydi). Mavzu va muallifni administrator «Foydalanuvchilar» sahifasida o‘zgartiradi.
 */
import { demoOchiqmi, royxatOchiqmi } from "./auth.ts";
import { all, hisobgaShart, one, run } from "./db.ts";
import type { Til } from "./i18n/til.ts";
import { ApiError } from "./queries.ts";
import { daraja, metodikaniYuklash } from "./scoring.ts";
import type { Mezon, ShkalaOraliq } from "./types.ts";

export interface BoshMatnlar {
  /** dissertatsiya mavzusi — uch tilda (bo‘sh tilda o‘zbekchasi ko‘rsatiladi) */
  mavzu: Record<Til, string>;
  muallif: string;
}

export interface OchiqMalumot {
  /** statistikaga kiradigan materiallar */
  materiallar: number;
  /** ulardan LPSI hisoblangani */
  tahlil_qilingan: number;
  /** shu materiallari bor nashrlar */
  nashrlar: number;
  ortacha_lpsi: number | null;
  ortacha_daraja: string | null;
  /** shkala oraliqlari bo‘yicha tahlil qilingan materiallar soni (shkala tartibida) */
  taqsimot: number[];
  mezonlar: Mezon[];
  shkala: ShkalaOraliq[];
  metodika_versiya: number;
  matnlar: BoshMatnlar;
  demo: boolean;
  royxat: boolean;
}

const KALIT = "bosh_sahifa";
const UZUNLIK = { mavzu: 600, muallif: 200 };
const BOSH: BoshMatnlar = { mavzu: { uz: "", ru: "", en: "" }, muallif: "" };

export async function boshMatnlar(): Promise<BoshMatnlar> {
  const r = await one<{ qiymat: string }>("SELECT qiymat FROM sozlamalar WHERE kalit = ?", [KALIT]);
  if (!r) return structuredClone(BOSH);
  try {
    const d = JSON.parse(r.qiymat) as Partial<BoshMatnlar>;
    const satr = (v: unknown) => (typeof v === "string" ? v : "");
    return {
      mavzu: { uz: satr(d.mavzu?.uz), ru: satr(d.mavzu?.ru), en: satr(d.mavzu?.en) },
      muallif: satr(d.muallif),
    };
  } catch {
    return structuredClone(BOSH);
  }
}

/** Administrator: { mavzu: { uz, ru, en }, muallif } */
export async function boshMatnlarniSaqlash(data: unknown): Promise<BoshMatnlar> {
  const d = (data ?? {}) as Record<string, unknown>;
  const mavzu = (d.mavzu ?? {}) as Record<string, unknown>;
  const satr = (v: unknown, chegara: number) => {
    if (v == null) return "";
    if (typeof v !== "string") throw new ApiError(422, "x.notogriSorov");
    const s = v.trim().replace(/\s+/g, " ");
    if (s.length > chegara) throw new ApiError(422, "bh.x.uzun", { n: chegara });
    return s;
  };
  const yangi: BoshMatnlar = {
    mavzu: { uz: satr(mavzu.uz, UZUNLIK.mavzu), ru: satr(mavzu.ru, UZUNLIK.mavzu), en: satr(mavzu.en, UZUNLIK.mavzu) },
    muallif: satr(d.muallif, UZUNLIK.muallif),
  };
  await run(
    "INSERT INTO sozlamalar (kalit, qiymat) VALUES (?, ?) ON CONFLICT (kalit) DO UPDATE SET qiymat = excluded.qiymat",
    [KALIT, JSON.stringify(yangi)],
  );
  return yangi;
}

/** Joriy til uchun mavzu: bo‘lsa — o‘sha tilda, aks holda o‘zbekcha (u ham bo‘lmasa — bo‘sh). */
export const mavzuMatni = (m: BoshMatnlar, til: Til) => m.mavzu[til] || m.mavzu.uz || m.mavzu.ru || m.mavzu.en;

export async function ochiqMalumot(): Promise<OchiqMalumot> {
  const [met, qatorlar, mezonlar, matnlar, demo, royxat] = await Promise.all([
    metodikaniYuklash(),
    all<{ nashr_id: number; lpsi: number | null }>(
      `SELECT m.nashr_id, t.lpsi FROM materiallar m LEFT JOIN tahlillar t ON t.material_id = m.id WHERE ${hisobgaShart("m")}`,
    ),
    all<Mezon>("SELECT kod, nomi, vazn, tavsif FROM mezonlar ORDER BY kod"),
    boshMatnlar(),
    demoOchiqmi(),
    royxatOchiqmi(),
  ]);
  const lpsilar = qatorlar.map((q) => q.lpsi).filter((x): x is number => x != null);
  // Dashboard’dagi bilan bir xil: o‘rtacha bir xona aniqlikda
  const ortacha = lpsilar.length ? Math.round((lpsilar.reduce((a, b) => a + b, 0) / lpsilar.length) * 10) / 10 : null;
  return {
    materiallar: qatorlar.length,
    tahlil_qilingan: lpsilar.length,
    nashrlar: new Set(qatorlar.map((q) => q.nashr_id)).size,
    ortacha_lpsi: ortacha,
    ortacha_daraja: ortacha == null ? null : daraja(ortacha, met.shkala),
    taqsimot: met.shkala.map((s) => lpsilar.filter((x) => daraja(x, met.shkala) === s.nomi).length),
    mezonlar,
    shkala: met.shkala,
    metodika_versiya: met.versiya,
    matnlar,
    demo,
    royxat,
  };
}
