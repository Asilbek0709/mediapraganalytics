/**
 * Tarjima: matn kalitlari, parametrlar, ko‘plik shakllari, son formati, atamalar.
 * Server va mijozda bir xil ishlaydi (next/headers bu yerda ishlatilmaydi).
 */
import type { MezonIzohi, Qism } from "../types.ts";
import { atamalar, type Atamalar } from "./atamalar.ts";
import { ahamiyatMatnlari } from "./matnlar/ahamiyat.ts";
import { analitikaMatnlari } from "./matnlar/analitika.ts";
import { authMatnlari } from "./matnlar/auth.ts";
import { buyruqMatnlari } from "./matnlar/buyruq.ts";
import { dashboardMatnlari } from "./matnlar/dashboard.ts";
import { davrMatnlari } from "./matnlar/davr.ts";
import { ekspertMatnlari } from "./matnlar/ekspert.ts";
import { excelMatnlari } from "./matnlar/excel.ts";
import { hisobotMatnlari } from "./matnlar/hisobot.ts";
import { importMatnlari } from "./matnlar/import.ts";
import { izoh } from "./matnlar/izoh.ts";
import { mediabazaMatnlari } from "./matnlar/mediabaza.ts";
import { metodikaMatnlari } from "./matnlar/metodika.ts";
import { misollarMatnlari } from "./matnlar/misollar.ts";
import { nashrHisobotMatnlari } from "./matnlar/nashrHisobot.ts";
import { nav } from "./matnlar/nav.ts";
import { rasmMatnlari } from "./matnlar/rasm.ts";
import { tahlilMatnlari } from "./matnlar/tahlil.ts";
import { umumiy } from "./matnlar/umumiy.ts";
import { vaqt } from "./matnlar/vaqt.ts";
import { xato } from "./matnlar/xato.ts";
import { zaxiraMatnlari } from "./matnlar/zaxira.ts";
import type { Til } from "./til.ts";

const BOLIMLAR = [
  umumiy, nav, xato, izoh, vaqt, dashboardMatnlari, mediabazaMatnlari, importMatnlari, tahlilMatnlari,
  analitikaMatnlari, ahamiyatMatnlari, metodikaMatnlari, ekspertMatnlari, hisobotMatnlari, excelMatnlari, rasmMatnlari,
  misollarMatnlari, zaxiraMatnlari, davrMatnlari, nashrHisobotMatnlari, authMatnlari, buyruqMatnlari,
] as const;

type Bolim = (typeof BOLIMLAR)[number];
type KalitlarOf<B> = B extends { uz: Record<infer K extends string, string> } ? K : never;
export type Kalit = KalitlarOf<Bolim>;
export type Param = Record<string, string | number | null | undefined>;

/** Server xabari: kalit va parametrlar (tarjima mijozda yoki javob paytida qilinadi). */
export interface Xabar {
  k: Kalit;
  p?: Param;
}

const MATNLAR: Record<Til, Record<string, string>> = {
  uz: Object.assign({}, ...BOLIMLAR.map((b) => b.uz)),
  ru: Object.assign({}, ...BOLIMLAR.map((b) => b.ru)),
  en: Object.assign({}, ...BOLIMLAR.map((b) => b.en)),
};

const RIM = ["I", "II", "III", "IV"];

export interface Tarjimon {
  til: Til;
  /** Matn: {nom} — parametr; {a|b|c} — p.n bo‘yicha ko‘plik shakli */
  t: (k: Kalit, p?: Param) => string;
  x: (x: Xabar) => string;
  /** 83.33 → «83,3» (uz, ru) yoki «83.3» (en); null → «—» */
  son: (x: number | null | undefined, kasr?: number) => string;
  atama: Atamalar;
  media: (turi: string | null | undefined) => string;
  mediaQ: (turi: string | null | undefined) => string;
  qism: (q: Qism | string) => string;
  davr: (kalit: string) => string;
  izohMatni: (iz: MezonIzohi | null | undefined) => string;
}

function korinishTanlash(til: Til, n: number, shakllar: string[]): string {
  let tur = "other";
  try {
    tur = new Intl.PluralRules(til).select(n);
  } catch {
    tur = n === 1 ? "one" : "other";
  }
  const i = til === "ru" ? (tur === "one" ? 0 : tur === "few" ? 1 : 2) : tur === "one" ? 0 : 1;
  return shakllar[Math.min(i, shakllar.length - 1)];
}

const keshlar = new Map<Til, Tarjimon>();

export function tarjimon(til: Til): Tarjimon {
  const bor = keshlar.get(til);
  if (bor) return bor;

  const lug = MATNLAR[til];
  const t = (k: Kalit, p?: Param): string => {
    let s = lug[k] ?? MATNLAR.uz[k] ?? k;
    if (p) {
      s = s.replace(/\{(\w+)\}/g, (m, nom: string) => (p[nom] == null ? m : String(p[nom])));
      s = s.replace(/\{([^{}]*\|[^{}]*)\}/g, (_, shakl: string) => korinishTanlash(til, Number(p.n ?? 0), shakl.split("|")));
    }
    return s;
  };
  const son = (x: number | null | undefined, kasr = 1): string => {
    if (x == null || Number.isNaN(Number(x))) return "—";
    // −0,004 → «0», «-0» emas
    const s = Number(x).toFixed(kasr).replace(/\.0+$/, "").replace(/^-0$/, "0");
    return til === "en" ? s : s.replace(".", ",");
  };
  const atama = atamalar(til);
  const oylar = t("v.oylar").split("|");

  const tr: Tarjimon = {
    til,
    t,
    x: (x) => t(x.k, x.p),
    son,
    atama,
    media: (turi) => (turi === "raqamli" ? t("u.raqamli") : turi === "bosma" ? t("u.bosma") : turi ?? ""),
    mediaQ: (turi) => (turi === "raqamli" ? t("u.raqamliQ") : turi === "bosma" ? t("u.bosmaQ") : turi ?? ""),
    qism: (q) => (q === "sarlavha" ? t("u.sarlavha") : q === "lid" ? t("u.lid") : q === "matn" ? t("u.matn") : q),
    davr: (kalit) => {
      if (/^\d{4}$/.test(kalit)) return kalit;
      const ch = kalit.match(/^(\d{4})-Q(\d)$/);
      if (ch) return t("v.chorak", { r: RIM[Number(ch[2]) - 1], q: ch[2], y: ch[1] });
      const oy = kalit.match(/^(\d{4})-(\d{2})$/);
      if (oy) return `${oylar[Number(oy[2]) - 1]} ${oy[1]}`;
      return kalit;
    },
    izohMatni: (iz) => {
      if (!iz) return "";
      let asos: string;
      if (iz.tur === "k1") asos = `(${iz.qiymatlar.map((q) => son(q)).join(" + ")}) / ${iz.qiymatlar.length} × 100`;
      else if (iz.tur === "k4") asos = son(iz.asos);
      else if (iz.tur === "k5") asos = `(${iz.auditoriya} − 1) / 4 × 100`;
      else asos = "100";
      const jarimalar = iz.jarimalar
        .map((j) => ` − ${j.soni}×${son(j.jarima)} (${atama.kategoriya(j.kategoriya).toLowerCase()})`)
        .join("");
      return asos + jarimalar + (iz.ball !== iz.xom ? ` → ${son(iz.ball)}` : "");
    },
  };
  keshlar.set(til, tr);
  return tr;
}
