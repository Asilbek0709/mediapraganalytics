/**
 * Veb-sahifadan material maydonlarini ajratib olish (ТЗ v2, 3.1).
 *
 * Matn yaratilmaydi — faqat sahifada bor narsa olinadi. Tartib:
 *  1) nashrga xos qoida (Kun.uz, Qalampir.uz, Oyina.uz) — sahifa tuzilishi ma’lum;
 *  2) umumiy usul — JSON-LD (NewsArticle), og: meta teglari, Mozilla Readability.
 * Natija formaga chiqadi, tadqiqotchi tuzatib saqlaydi.
 */
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export type Qoida = "kun.uz" | "qalampir.uz" | "oyina.uz" | "umumiy";
export type Ogohlantirish = "lidBirinchiXatboshi" | "lidTopilmadi" | "sanaTopilmadi" | "yilTaxminiy" | "matnQisqa";

export interface AjratilganMaterial {
  sarlavha: string;
  lid: string;
  matn: string;
  /** YYYY-MM-DD */
  sana: string | null;
  /** saytdagi rukn (masalan, «Jamiyat») — mavzu maydoniga taklif */
  rukn: string | null;
  /** nashr nomi taxmini (domen bo‘yicha) */
  nashr: string | null;
  havola: string;
  qoida: Qoida;
  ogohlantirishlar: Ogohlantirish[];
}

const NASHR_DOMENLARI: Record<string, string> = {
  "kun.uz": "Kun.uz",
  "qalampir.uz": "Qalampir.uz",
  "oyina.uz": "Oyina.uz",
  "daryo.uz": "Daryo.uz",
  "gazeta.uz": "Gazeta.uz",
  "uza.uz": "UzA",
  "xabar.uz": "Xabar.uz",
  "podrobno.uz": "Podrobno.uz",
};

// ------------------------------------------------------------------ yordamchilar

type El = { textContent: string | null; querySelector(s: string): El | null; querySelectorAll(s: string): ArrayLike<El>; getAttribute(n: string): string | null; closest(s: string): El | null; tagName: string };
type Hujjat = { querySelector(s: string): El | null; querySelectorAll(s: string): ArrayLike<El>; title?: string };

export const tozala = (s: string | null | undefined): string =>
  (s ?? "")
    .replace(/[   ]/g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

const bir = (s: string) => tozala(s).replace(/\s+/g, " ");
const solishtir = (s: string) => bir(s).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

function meta(d: Hujjat, ...nomlar: string[]): string | null {
  for (const n of nomlar) {
    const el = d.querySelector(`meta[property="${n}"]`) ?? d.querySelector(`meta[name="${n}"]`);
    const v = el?.getAttribute("content");
    if (v && bir(v)) return bir(v);
  }
  return null;
}

/** Sahifadagi JSON-LD obyektlari (@graph ichidagilari ham) */
function jsonLd(d: Hujjat): Record<string, unknown>[] {
  const natija: Record<string, unknown>[] = [];
  for (const s of Array.from(d.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const o = JSON.parse(s.textContent ?? "");
      const yoy = (x: unknown): void => {
        if (Array.isArray(x)) x.forEach(yoy);
        else if (x && typeof x === "object") {
          natija.push(x as Record<string, unknown>);
          if ("@graph" in x) yoy((x as { "@graph": unknown })["@graph"]);
        }
      };
      yoy(o);
    } catch {
      /* buzilgan JSON-LD — e’tiborsiz */
    }
  }
  return natija;
}

function maqolaLd(d: Hujjat): Record<string, unknown> | null {
  return jsonLd(d).find((o) => /(News)?Article|BlogPosting|Report/.test(String(o["@type"] ?? ""))) ?? null;
}

const SKIP_SATR = /^(foto|фото|photo|video|видео|manba|манба|source)\s*[:：]/i;

/**
 * Konteynerdagi xatboshilar (hujjat tartibida). Ichma-ich <p> (Word’dan ko‘chirilgan HTML) — faqat ichkisi;
 * rasm izohlari, reklama bloklari va bo‘sh qatorlar tashlanadi.
 */
function xatboshilar(konteyner: El | null): string[] {
  if (!konteyner) return [];
  const natija: string[] = [];
  for (const el of Array.from(konteyner.querySelectorAll("p, h2, h3, h4, blockquote, li"))) {
    if (el.closest("figure, figcaption, script, style, noscript, aside, [class*='adfox'], [id*='adfox'], [class*='banner']")) continue;
    // ichida boshqa xatboshi bo‘lsa — u alohida olinadi
    if (el.querySelector("p, h2, h3, h4, blockquote, li")) continue;
    const t = bir(el.textContent ?? "");
    if (!t || SKIP_SATR.test(t)) continue;
    if (natija[natija.length - 1] === t) continue;
    natija.push(t);
  }
  return natija;
}

// ------------------------------------------------------------------ sana

const OYLAR: [RegExp, number][] = [
  [/^(yan|янв)/i, 1],
  [/^(fev|фев)/i, 2],
  [/^(mar|мар)/i, 3],
  [/^(apr|апр)/i, 4],
  [/^(may|май|мая)/i, 5],
  [/^(iyun|июн)/i, 6],
  [/^(iyul|июл)/i, 7],
  [/^(avg|авг)/i, 8],
  [/^(sen|сен)/i, 9],
  [/^(okt|окт)/i, 10],
  [/^(noy|ноя)/i, 11],
  [/^(dek|дек)/i, 12],
];

const ikki = (n: number) => String(n).padStart(2, "0");
const sanaTogri = (y: number, m: number, d: number) => y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

/** ISO yoki «13.11.2026» ko‘rinishidagi sana → YYYY-MM-DD */
export function sananiOqish(s: string | null | undefined): string | null {
  const t = bir(s ?? "");
  if (!t) return null;
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m && sanaTogri(+m[1], +m[2], +m[3])) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m && sanaTogri(+m[3], +m[2], +m[1])) return `${m[3]}-${ikki(+m[2])}-${ikki(+m[1])}`;
  return null;
}

/** «15 Ноябрь» / «15-noyabr, 2026» → sana; yil yozilmagan bo‘lsa — joriy yil (kelajak chiqsa — o‘tgan yil). */
export function oyNomliSana(s: string, bugun = new Date()): { sana: string; yilTaxminiy: boolean } | null {
  const m = bir(s).match(/(\d{1,2})[\s-]+([\p{L}]+)(?:[\s,]+(\d{4}))?/u);
  if (!m) return null;
  const oy = OYLAR.find(([re]) => re.test(m[2]))?.[1];
  if (!oy) return null;
  const kun = +m[1];
  let yil = m[3] ? +m[3] : bugun.getFullYear();
  if (!m[3]) {
    const taxmin = new Date(yil, oy - 1, kun);
    if (taxmin.getTime() - bugun.getTime() > 2 * 86400000) yil -= 1;
  }
  if (!sanaTogri(yil, oy, kun)) return null;
  return { sana: `${yil}-${ikki(oy)}-${ikki(kun)}`, yilTaxminiy: !m[3] };
}

// ------------------------------------------------------------------ nashr qoidalari

interface Xom {
  sarlavha?: string | null;
  lid?: string | null;
  xatboshilar?: string[];
  sana?: string | null;
  rukn?: string | null;
  ogoh?: Ogohlantirish[];
}

function kunUz(d: Hujjat): Xom {
  const ld = maqolaLd(d);
  const lidEl = d.querySelector("header p.font-serif") ?? d.querySelector("p.font-serif.font-bold");
  return {
    sarlavha: d.querySelector("h1")?.textContent ?? (ld?.headline as string) ?? meta(d, "og:title"),
    lid: lidEl?.textContent ?? (ld?.description as string) ?? meta(d, "og:description"),
    xatboshilar: xatboshilar(d.querySelector(".article-body")),
    sana: sananiOqish((ld?.datePublished as string) ?? meta(d, "article:published_time")),
    rukn: (ld?.articleSection as string) ?? null,
  };
}

function qalampirUz(d: Hujjat, bugun: Date): Xom {
  const ogoh: Ogohlantirish[] = [];
  const sanaMatn = d.querySelector("[itemprop='datePublished']")?.textContent ?? "";
  const iso = sananiOqish(meta(d, "article:published_time"));
  let sana = iso;
  if (!sana && sanaMatn) {
    const o = oyNomliSana(sanaMatn, bugun);
    if (o) {
      sana = o.sana;
      if (o.yilTaxminiy) ogoh.push("yilTaxminiy");
    }
  }
  return {
    sarlavha: d.querySelector(".content-main-hero h1")?.textContent ?? meta(d, "og:title"),
    xatboshilar: xatboshilar(d.querySelector(".content-main-titles")),
    sana,
    rukn: d.querySelector(".content-main-hero-info .left")?.textContent ?? null,
    ogoh,
  };
}

function oyinaUz(d: Hujjat): Xom {
  const statics = d.querySelector(".statics")?.textContent ?? "";
  const yollar = Array.from(d.querySelectorAll(".breadcrumb a"));
  return {
    sarlavha: d.querySelector(".single-news-headtext h1")?.textContent ?? meta(d, "og:title"),
    xatboshilar: xatboshilar(d.querySelector(".single-news-paragraph")),
    sana: sananiOqish(statics),
    // «Asosiy sahifa › Maqolalar › Adabiyot › <sarlavha>» — oxiridan bittasi oldingisi
    rukn: yollar.length >= 3 ? (yollar[yollar.length - 2].textContent ?? null) : null,
  };
}

function umumiy(d: Hujjat, html: string, url: string): Xom {
  const ld = maqolaLd(d);
  let xat: string[] = [];
  const ldMatn = typeof ld?.articleBody === "string" ? ld.articleBody : null;
  if (ldMatn && ldMatn.length > 200) {
    xat = tozala(ldMatn).split(/\n+/).map(bir).filter(Boolean);
  } else {
    try {
      const { document } = parseHTML(html);
      // Readability nisbiy havolalar uchun baseURI ni so‘raydi
      Object.defineProperty(document, "baseURI", { value: url, configurable: true });
      const r = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
      if (r?.content) xat = xatboshilar(parseHTML(`<div id="r">${r.content}</div>`).document.querySelector("#r") as unknown as El);
      if (!xat.length && r?.textContent) xat = tozala(r.textContent).split(/\n+/).map(bir).filter(Boolean);
    } catch {
      /* Readability ishlamasa — bo‘sh matn, tadqiqotchi o‘zi kiritadi */
    }
  }
  return {
    sarlavha: (ld?.headline as string) ?? meta(d, "og:title", "twitter:title") ?? d.querySelector("h1")?.textContent ?? d.title,
    lid: (ld?.description as string) ?? meta(d, "og:description", "description"),
    xatboshilar: xat,
    sana: sananiOqish((ld?.datePublished as string) ?? meta(d, "article:published_time", "pubdate", "date")),
    rukn: (ld?.articleSection as string) ?? meta(d, "article:section"),
  };
}

/** Qisqa va gap tinish belgisisiz satr — ichki sarlavha (masalan, «Jaydari romantika»), lid emas */
const kichikSarlavhami = (s: string) => s.length < 70 && !/[.!?…:;»”"]$/.test(s);

export function domen(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(www|m)\./, "");
  } catch {
    return "";
  }
}

export function qoidaTanlash(url: string): Qoida {
  const h = domen(url);
  if (h === "kun.uz" || h.endsWith(".kun.uz")) return "kun.uz";
  if (h === "qalampir.uz" || h.endsWith(".qalampir.uz")) return "qalampir.uz";
  if (h === "oyina.uz" || h.endsWith(".oyina.uz")) return "oyina.uz";
  return "umumiy";
}

/** HTML va manzildan material maydonlari. bugun — yil yozilmagan sanalar uchun (testlarda beriladi). */
export function ajratish(html: string, url: string, bugun = new Date()): AjratilganMaterial {
  const { document } = parseHTML(html);
  const d = document as unknown as Hujjat;
  const qoida = qoidaTanlash(url);
  let x: Xom = qoida === "kun.uz" ? kunUz(d) : qoida === "qalampir.uz" ? qalampirUz(d, bugun) : qoida === "oyina.uz" ? oyinaUz(d) : {};
  // Nashr qoidasi matn topa olmasa (sahifa tuzilishi o‘zgargan) — umumiy usul
  let amaldagi: Qoida = qoida;
  if (!x.xatboshilar?.length) {
    const u = umumiy(d, html, url);
    x = { ...u, ...Object.fromEntries(Object.entries(x).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length))) };
    if (!x.xatboshilar?.length) x.xatboshilar = u.xatboshilar;
    amaldagi = qoida === "umumiy" ? "umumiy" : qoida;
  }

  const ogoh = new Set<Ogohlantirish>(x.ogoh ?? []);
  const sarlavha = bir(x.sarlavha ?? "").replace(/\s+[—–|-]\s+(Kun\.uz|Qalampir\.uz|Oyina\.uz|Oyina)$/i, "");
  let xat = (x.xatboshilar ?? []).filter((p) => solishtir(p) !== solishtir(sarlavha));
  let lid = bir(x.lid ?? "");

  // lid sarlavhaning o‘zi bo‘lsa (Qalampir’da og:description = sarlavha) — lid yo‘q deb hisoblanadi
  if (lid && solishtir(lid) === solishtir(sarlavha)) lid = "";
  if (lid) {
    // matn lidning o‘zi bilan boshlansa — takrorlanmasin
    if (xat.length && solishtir(xat[0]) === solishtir(lid)) xat = xat.slice(1);
    else if (xat.length && xat[0].startsWith(lid)) xat[0] = xat[0].slice(lid.length).trim();
    xat = xat.filter(Boolean);
  } else if (xat.length > 1 && !kichikSarlavhami(xat[0])) {
    lid = xat[0];
    xat = xat.slice(1);
    ogoh.add("lidBirinchiXatboshi");
  } else {
    ogoh.add("lidTopilmadi");
  }
  const matn = xat.join("\n");
  if (!x.sana) ogoh.add("sanaTopilmadi");
  if (matn.length < 200) ogoh.add("matnQisqa");

  return {
    sarlavha,
    lid,
    matn,
    sana: x.sana ?? null,
    rukn: x.rukn ? bir(x.rukn) : null,
    nashr: NASHR_DOMENLARI[domen(url)] ?? null,
    havola: url,
    qoida: amaldagi,
    ogohlantirishlar: [...ogoh],
  };
}
