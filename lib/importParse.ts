/**
 * Import uchun sof funksiyalar (tashqi bog‘liqliksiz — Node’da test qilinadi):
 * CSV tahlili, kodirovkani aniqlash, ustunlarni tanish, sanalarni normallash.
 */

export type Maydon = "nashr" | "turi" | "sana" | "janr" | "mavzu" | "havola" | "sarlavha" | "lid" | "matn";

export const MAYDONLAR: Maydon[] = ["nashr", "turi", "sana", "janr", "mavzu", "havola", "sarlavha", "lid", "matn"];

/** Har bir maydon uchun tanilgan ustun nomlari: o‘zbek (lotin va kirill), rus, ingliz. */
export const USTUN_SINONIMLARI: Record<Maydon, string[]> = {
  nashr: ["nashr", "nashr nomi", "nashriyot", "oav", "нашр", "издание", "сми", "источник", "source", "media", "outlet", "publication"],
  turi: ["turi", "media turi", "nashr turi", "тури", "медиа тури", "тип", "тип сми", "type", "media type"],
  sana: ["sana", "chop etilgan sana", "сана", "дата", "дата публикации", "date"],
  janr: ["janr", "жанр", "genre"],
  mavzu: ["mavzu", "мавзу", "тема", "topic", "subject"],
  havola: ["havola", "manba", "ҳавола", "хавола", "ссылка", "url", "link"],
  sarlavha: ["sarlavha", "сарлавҳа", "сарлавха", "заголовок", "title", "headline"],
  lid: ["lid", "лид", "lead"],
  matn: ["matn", "asosiy matn", "матн", "асосий матн", "текст", "основной текст", "text", "body", "body text", "main text"],
};

/** Ustun nomini solishtirish uchun: kichik harf, tutuq belgilarisiz, faqat harf va raqam. */
export function kalitNormallash(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʻʼ`'´]/g, "")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function ustunlarniAniqlash(sarlavhalar: string[]): {
  xarita: Partial<Record<Maydon, number>>;
  tanilmagan: string[];
} {
  const xarita: Partial<Record<Maydon, number>> = {};
  const tanilmagan: string[] = [];
  const sinonimlar = Object.entries(USTUN_SINONIMLARI).map(
    ([maydon, royxat]) => [maydon as Maydon, new Set(royxat.map(kalitNormallash))] as const,
  );
  sarlavhalar.forEach((s, i) => {
    const k = kalitNormallash(s ?? "");
    if (!k) return;
    const topilgan = sinonimlar.find(([m, royxat]) => royxat.has(k) && xarita[m] === undefined);
    if (topilgan) xarita[topilgan[0]] = i;
    else tanilmagan.push(String(s).trim());
  });
  return { xarita, tanilmagan };
}

// ------------------------------------------------------------------ kodirovka va CSV

/** UTF-8 ni tekshiradi; mos kelmasa — Windows-1251 (Excel’ning «CSV» saqlashi) deb o‘qiydi. BOM olib tashlanadi. */
export function matnniDekodlash(bayt: Uint8Array): { matn: string; kodirovka: "utf-8" | "windows-1251" } {
  try {
    const matn = new TextDecoder("utf-8", { fatal: true }).decode(bayt);
    return { matn: matn.replace(/^﻿/, ""), kodirovka: "utf-8" };
  } catch {
    return { matn: new TextDecoder("windows-1251").decode(bayt), kodirovka: "windows-1251" };
  }
}

/** Birinchi qatordagi (qo‘shtirnoqdan tashqaridagi) belgilar soniga qarab ajratgichni aniqlaydi. */
export function ajratgichniAniqlash(matn: string): string {
  const sanoq: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let qoshtirnoq = false;
  for (const ch of matn) {
    if (ch === '"') qoshtirnoq = !qoshtirnoq;
    else if (!qoshtirnoq && (ch === "\n" || ch === "\r")) break;
    else if (!qoshtirnoq && ch in sanoq) sanoq[ch]++;
  }
  return Object.entries(sanoq).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(sanoq).sort((a, b) => b[1] - a[1])[0][0]
    : ",";
}

/** RFC 4180 bo‘yicha CSV: qo‘shtirnoq ichidagi ajratgich va qator ko‘chishi, "" — qo‘shtirnoq belgisi. */
export function csvTahlil(matn: string, ajratgich = ajratgichniAniqlash(matn)): string[][] {
  const qatorlar: string[][] = [];
  let qator: string[] = [];
  let katak = "";
  let qoshtirnoq = false;
  for (let i = 0; i < matn.length; i++) {
    const ch = matn[i];
    if (qoshtirnoq) {
      if (ch === '"') {
        if (matn[i + 1] === '"') {
          katak += '"';
          i++;
        } else qoshtirnoq = false;
      } else katak += ch;
    } else if (ch === '"' && katak === "") {
      qoshtirnoq = true;
    } else if (ch === ajratgich) {
      qator.push(katak);
      katak = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && matn[i + 1] === "\n") i++;
      qator.push(katak);
      qatorlar.push(qator);
      qator = [];
      katak = "";
    } else katak += ch;
  }
  if (katak !== "" || qator.length) {
    qator.push(katak);
    qatorlar.push(qator);
  }
  return qatorlar.filter((q) => q.some((k) => k.trim() !== ""));
}

// ------------------------------------------------------------------ sana

const pad = (n: number) => String(n).padStart(2, "0");

function haqiqiySana(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Sanani YYYY-MM-DD ko‘rinishiga keltiradi. Qabul qilinadi: Date obyekti, Excel seriya raqami,
 * «2025-03-15», «15.03.2025», «15/03/2025», «15-03-2025», «2025.03.15».
 */
export function sananiNormallash(v: unknown): { sana: string | null; xato: boolean } {
  if (v == null || v === "") return { sana: null, xato: false };
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return { sana: null, xato: true };
    const s = haqiqiySana(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
    return { sana: s, xato: !s };
  }
  if (typeof v === "number") {
    // Excel: 1 = 1900-01-01; 1899-12-30 bazasi 1900 yilgi kabisa xatosini hisobga oladi
    if (v < 1 || v > 80000) return { sana: null, xato: true };
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    const s = haqiqiySana(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    return { sana: s, xato: !s };
  }
  const t = String(v).trim();
  if (!t) return { sana: null, xato: false };
  let m = t.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T].*)?$/);
  if (m) {
    const s = haqiqiySana(+m[1], +m[2], +m[3]);
    return { sana: s, xato: !s };
  }
  m = t.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})(?:[ T].*)?$/);
  if (m) {
    const s = haqiqiySana(+m[3], +m[2], +m[1]);
    return { sana: s, xato: !s };
  }
  if (/^\d+(\.\d+)?$/.test(t)) return sananiNormallash(Number(t));
  return { sana: null, xato: true };
}

// ------------------------------------------------------------------ solishtirish kalitlari

/** Nashr nomini solishtirish uchun: kichik harf, bitta bo‘shliq, tutuq belgilari birxillashtirilgan. */
export function nashrKaliti(s: string): string {
  return s.toLowerCase().replace(/[‘’ʻʼ`´]/g, "'").replace(/\s+/g, " ").trim();
}

/** Takroriylikni aniqlash uchun sarlavha kaliti: kichik harf, tinish belgilarisiz. */
export function sarlavhaKaliti(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʻʼ`´']/g, "")
    .replace(/[«»"“”„]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Yangi nashr uchun media turini taxmin qilish: domen ko‘rinishidagi nom — raqamli. */
export function turTaxmini(nomi: string): "bosma" | "raqamli" {
  return /\.(uz|com|ru|org|net|info|tv)\b|^https?:|www\./i.test(nomi) ? "raqamli" : "bosma";
}

/** Media turi katagi: «bosma», «raqamli» va ularning sinonimlari. */
export function turniTanish(v: string): "bosma" | "raqamli" | null {
  const k = kalitNormallash(v);
  if (!k) return null;
  if (["bosma", "босма", "печатное", "печатные", "печать", "gazeta", "jurnal", "газета", "журнал", "print"].includes(k)) {
    return "bosma";
  }
  if (["raqamli", "рақамли", "цифровое", "цифровые", "онлайн", "online", "sayt", "сайт", "internet", "интернет", "digital", "web"].includes(k)) {
    return "raqamli";
  }
  return null;
}
