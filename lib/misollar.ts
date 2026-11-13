/**
 * Misollar korpusi: belgilangan fragmentlar, ular joylashgan gap (kontekst), ekspertlar tasdig‘i,
 * filtrlar va dissertatsiya uchun «Word» formatidagi ro‘yxat.
 *
 * Bu modul toza — bazaga murojaat qilmaydi, shuning uchun mijozda ham, serverda ham ishlaydi
 * (bazadan yig‘ish: lib/misollarBaza.ts).
 */
import type { Guruh, MediaTuri, Qism } from "./types";

export interface Kontekst {
  /** Fragmentdan oldingi qism (gap boshidan) */
  oldin: string;
  /** Matndagi fragmentning o‘zi (bo‘shliqlar asl matndagidek) */
  fragment: string;
  /** Fragmentdan keyingi qism (gap oxirigacha) */
  keyin: string;
}

export interface Misol {
  /** belgilar.id — faqat ro‘yxat kaliti (tahlil qayta saqlanganda o‘zgaradi) */
  id: number;
  material_id: number;
  nashr_id: number;
  nashr: string;
  turi: MediaTuri;
  sana: string | null;
  /** bo‘sh janr — JANR_YOQ */
  janr: string;
  sarlavha: string;
  havola: string | null;
  kategoriya: string;
  kategoriya_nomi: string;
  guruh: Guruh;
  tartib: number;
  qism: Qism;
  fragment: string;
  izoh: string | null;
  /** null — fragment material matnida aynan topilmadi */
  kontekst: Kontekst | null;
  /** material tahlili to‘liq (LPSI hisoblangan) */
  toliq: boolean;
  /** shu materialni mustaqil tahlil qilgan ekspertlar soni */
  ekspertlar: number;
  /** ulardan shu qismda shu kategoriyani ustma-ust tushadigan fragment bilan belgilaganlar */
  tasdiq: number;
  tanlangan: boolean;
}

export type MisolTartibi = "kategoriya" | "sana" | "nashr" | "tasdiq";

export interface MisolFiltr {
  q?: string;
  kategoriya?: string;
  guruh?: Guruh;
  qism?: Qism;
  turi?: MediaTuri;
  nashr_id?: number;
  janr?: string;
  dan?: string;
  gacha?: string;
  /** faqat ★ bilan tanlanganlar */
  tanlangan?: boolean;
  /** kamida bitta ekspert tasdiqlagan */
  tasdiq?: boolean;
  /** faqat to‘liq tahlil qilingan materiallar (Analitika bilan bir xil asos) */
  toliq?: boolean;
  tartib?: MisolTartibi;
}

// ------------------------------------------------------------ matnni solishtirish

/** O‘zbek tutuq belgisining barcha ko‘rinishlari (o‘, o', oʻ, o’, o`) bitta deb hisoblanadi. */
const TUTUQ = /[‘’'ʻʼ`´]/g;

/** Qidiruv uchun: kichik harf, tutuq belgilari bir xil, bo‘shliqlar bitta. */
export function normal(s: string): string {
  return s.toLocaleLowerCase().replace(TUTUQ, "'").replace(/\s+/g, " ").trim();
}

const ekranla = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Fragmentning matndagi o‘rni: avval aynan, so‘ng katta-kichik harf, tutuq belgisi
 * va bo‘shliqlar farqiga e’tibor bermasdan. Topilmasa — null.
 */
export function fragmentOrni(matn: string, fragment: string): { boshi: number; oxiri: number } | null {
  const f = fragment.trim();
  if (!f || !matn) return null;
  const aniq = matn.indexOf(f);
  if (aniq >= 0) return { boshi: aniq, oxiri: aniq + f.length };
  const naqsh = f
    .split(/\s+/)
    .map((soz) => ekranla(soz).replace(TUTUQ, "[‘’'ʻʼ`´]"))
    .join("\\s+");
  const m = new RegExp(naqsh, "iu").exec(matn);
  return m ? { boshi: m.index, oxiri: m.index + m[0].length } : null;
}

/** Gap oxiri: . ! ? … (ketidan yopuvchi qo‘shtirnoq/qavs bo‘lishi mumkin) va bo‘shliq yoki matn oxiri. */
const GAP_OXIRI = /[.!?…]+["»”’)\]]*(?=\s|$)/gu;
/** «Sh. Mirziyoyev», «A. Navoiy» — bosh harfli 1–2 harfdan keyingi nuqta gap oxiri emas. */
const INITSIAL = /(?:^|[\s(«"“])\p{Lu}\p{Ll}?$/u;
const KONTEKST_MAX = 260;

/** Matndagi gap chegaralari (har biri — gapdan keyingi birinchi belgining o‘rni). */
function gapChegaralari(matn: string): number[] {
  const natija: number[] = [];
  for (const m of matn.matchAll(GAP_OXIRI)) {
    if (m[0] === "." && INITSIAL.test(matn.slice(Math.max(0, m.index - 3), m.index))) continue;
    natija.push(m.index + m[0].length);
  }
  return natija;
}

/**
 * Fragment joylashgan gap: fragmentdan oldin oxirgi gap chegarasigacha va keyin birinchi
 * gap chegarasigacha (xatboshi ham chegara). Juda uzun bo‘lsa so‘z chegarasida «…» bilan qisqartiriladi.
 */
export function kontekstAjratish(matn: string | null | undefined, fragment: string): Kontekst | null {
  if (!matn) return null;
  const joy = fragmentOrni(matn, fragment);
  if (!joy) return null;
  const chegaralar = gapChegaralari(matn);

  // Chap chegara: fragmentdan oldingi oxirgi gap tugashi yoki xatboshi
  let boshi = 0;
  for (const c of chegaralar) if (c <= joy.boshi) boshi = c;
  const xatboshi = matn.lastIndexOf("\n", joy.boshi - 1);
  if (xatboshi + 1 > boshi) boshi = xatboshi + 1;

  // O‘ng chegara: fragment ichidagi chegaralar hisobga olinmaydi — undan keyingi birinchisi
  // (fragment o‘zi gap bilan tugasa, chegara aynan uning oxiri bo‘ladi va keyingi gapga o‘tilmaydi)
  let oxiri = chegaralar.find((c) => c >= joy.oxiri) ?? matn.length;
  const nl = matn.indexOf("\n", joy.oxiri);
  if (nl >= 0 && nl < oxiri) oxiri = nl;

  let oldin = matn.slice(boshi, joy.boshi).replace(/^\s+/, "");
  let keyin = matn.slice(joy.oxiri, oxiri).replace(/\s+$/, "");
  if (oldin.length > KONTEKST_MAX) {
    const kesik = oldin.slice(-KONTEKST_MAX);
    oldin = "…" + kesik.slice(Math.max(0, kesik.indexOf(" ") + 1));
  }
  if (keyin.length > KONTEKST_MAX) {
    const kesik = keyin.slice(0, KONTEKST_MAX);
    const s = kesik.lastIndexOf(" ");
    keyin = (s > 0 ? kesik.slice(0, s) : kesik) + "…";
  }
  return { oldin: oldin.replace(/\s+/g, " "), fragment: matn.slice(joy.boshi, joy.oxiri).replace(/\s+/g, " "), keyin: keyin.replace(/\s+/g, " ") };
}

/**
 * Ikki fragment bir xil joyni ko‘rsatadimi: biri ikkinchisini o‘z ichiga oladi
 * yoki matndagi o‘rinlari kesishadi.
 */
export function ustmaUst(a: string | null | undefined, b: string | null | undefined, matn?: string | null): boolean {
  if (!a || !b) return false;
  const na = normal(a).replace(/[.,;:!?…«»"“”()]+$/u, "");
  const nb = normal(b).replace(/[.,;:!?…«»"“”()]+$/u, "");
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  if (!matn) return false;
  const x = fragmentOrni(matn, a);
  const y = fragmentOrni(matn, b);
  return !!x && !!y && x.boshi < y.oxiri && y.boshi < x.oxiri;
}

// ------------------------------------------------------------------- filtrlar

const QISMLAR: Qism[] = ["sarlavha", "lid", "matn"];
const TARTIBLAR: MisolTartibi[] = ["kategoriya", "sana", "nashr", "tasdiq"];

type Parametrlar = Record<string, string | string[] | undefined> | URLSearchParams;

/** URL parametrlaridan filtr (noto‘g‘ri qiymatlar e’tiborsiz qoldiriladi). */
export function misolFiltriniOqish(p: Parametrlar): MisolFiltr {
  const ol = (k: string) => {
    const v = p instanceof URLSearchParams ? p.get(k) : p[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const sanami = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const ha = (k: string) => (ol(k) === "1" ? true : undefined);
  const turi = ol("turi");
  const guruh = ol("guruh");
  const qism = ol("qism") as Qism | undefined;
  const tartib = ol("tartib") as MisolTartibi | undefined;
  const nashrId = Number(ol("nashr_id"));
  return {
    q: ol("q")?.slice(0, 200),
    kategoriya: ol("kategoriya"),
    guruh: guruh === "muammo" || guruh === "vosita" ? guruh : undefined,
    qism: qism && QISMLAR.includes(qism) ? qism : undefined,
    turi: turi === "bosma" || turi === "raqamli" ? turi : undefined,
    nashr_id: Number.isInteger(nashrId) && nashrId > 0 ? nashrId : undefined,
    janr: ol("janr"),
    dan: sanami(ol("dan")),
    gacha: sanami(ol("gacha")),
    tanlangan: ha("tanlangan"),
    tasdiq: ha("tasdiq"),
    toliq: ha("toliq"),
    tartib: tartib && TARTIBLAR.includes(tartib) && tartib !== "kategoriya" ? tartib : undefined,
  };
}

/** Filtr → URL so‘rov qatori (bo‘sh qiymatlarsiz, doimiy tartibda). */
export function misolFiltriQatori(f: MisolFiltr): string {
  const p = new URLSearchParams();
  for (const k of ["q", "kategoriya", "guruh", "qism", "turi", "nashr_id", "janr", "dan", "gacha"] as const) {
    const v = f[k];
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  for (const k of ["tanlangan", "tasdiq", "toliq"] as const) if (f[k]) p.set(k, "1");
  if (f.tartib && f.tartib !== "kategoriya") p.set("tartib", f.tartib);
  return p.toString();
}

export const faolFiltrmi = (f: MisolFiltr) =>
  Object.entries(f).some(([k, v]) => k !== "tartib" && v !== undefined && v !== "" && v !== false);

/** Qidiruv matni: fragment, uning gapi, izoh va material sarlavhasi bo‘yicha. */
function qidiruvMatni(m: Misol): string {
  const k = m.kontekst;
  return normal([k ? `${k.oldin} ${k.fragment} ${k.keyin}` : m.fragment, m.izoh ?? "", m.sarlavha].join(" \u0001 "));
}

/**
 * Filtrlash va saralash. `istisno` — shu maydonni hisobga olmaslik
 * (masalan, kategoriya bo‘yicha sanoqlar boshqa filtrlar ostida hisoblanadi).
 */
export function misollarniFiltrlash(misollar: Misol[], f: MisolFiltr, istisno?: keyof MisolFiltr): Misol[] {
  const q = f.q ? normal(f.q) : "";
  const mos = misollar.filter((m) => {
    if (istisno !== "kategoriya" && f.kategoriya && m.kategoriya !== f.kategoriya) return false;
    if (istisno !== "guruh" && f.guruh && m.guruh !== f.guruh) return false;
    if (istisno !== "qism" && f.qism && m.qism !== f.qism) return false;
    if (f.turi && m.turi !== f.turi) return false;
    if (f.nashr_id && m.nashr_id !== f.nashr_id) return false;
    if (f.janr && m.janr !== f.janr) return false;
    if (f.dan && (!m.sana || m.sana < f.dan)) return false;
    if (f.gacha && (!m.sana || m.sana > f.gacha)) return false;
    if (f.tanlangan && !m.tanlangan) return false;
    if (f.tasdiq && m.tasdiq < 1) return false;
    if (f.toliq && !m.toliq) return false;
    if (q && !qidiruvMatni(m).includes(q)) return false;
    return true;
  });
  return misollarniSaralash(mos, f.tartib ?? "kategoriya");
}

const QISM_TARTIB: Record<Qism, number> = { sarlavha: 0, lid: 1, matn: 2 };

export function misollarniSaralash(misollar: Misol[], tartib: MisolTartibi): Misol[] {
  const sanaKamayish = (a: Misol, b: Misol) => (b.sana ?? "").localeCompare(a.sana ?? "");
  const asosiy = (a: Misol, b: Misol) =>
    a.tartib - b.tartib || QISM_TARTIB[a.qism] - QISM_TARTIB[b.qism] || a.nashr.localeCompare(b.nashr) || sanaKamayish(a, b) || a.id - b.id;
  const ulush = (m: Misol) => (m.ekspertlar ? m.tasdiq / m.ekspertlar : -1);
  const solishtir: Record<MisolTartibi, (a: Misol, b: Misol) => number> = {
    kategoriya: asosiy,
    sana: (a, b) => sanaKamayish(a, b) || asosiy(a, b),
    nashr: (a, b) => a.nashr.localeCompare(b.nashr) || sanaKamayish(a, b) || asosiy(a, b),
    tasdiq: (a, b) => ulush(b) - ulush(a) || b.tasdiq - a.tasdiq || asosiy(a, b),
  };
  return [...misollar].sort(solishtir[tartib]);
}

// ------------------------------------------------------- dissertatsiya formati

export type Raqamlash = "qavs" | "nuqta" | "yoq";
export type Ajratish = "qalin" | "kursiv" | "tagiChiziq";

export interface WordSozlama {
  /** true — butun gap (fragment ajratilgan), false — faqat fragment */
  gap: boolean;
  ajratish: Ajratish;
  raqamlash: Raqamlash;
  boshlangich: number;
  /** kategoriya bo‘yicha guruhlab, har guruh oldidan uning nomi */
  guruhlash: boolean;
  sarlavhaBilan: boolean;
  izohBilan: boolean;
  olchamPt: number;
}

export interface WordMatnlari {
  kategoriya: (m: Misol) => string;
  sana: (iso: string) => string;
  /** qo‘shtirnoqlar: uz/ru — « », en — “ ” */
  qoshtirnoq: [string, string];
  /** ichki qo‘shtirnoqlar (iqtibos ichidagi «…» → „…“): uz/ru — „ “, en — ‘ ’ */
  ichki: [string, string];
}

const html = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const AJRATISH_TEGI: Record<Ajratish, [string, string]> = {
  qalin: ["<b>", "</b>"],
  kursiv: ["<i>", "</i>"],
  tagiChiziq: ["<u>", "</u>"],
};

/**
 * Misollar ro‘yxati Word’ga qo‘yish uchun: HTML (formatlash bilan) va oddiy matn.
 * Namuna: (1) «Gapning boshi **fragment** davomi.» (Kun.uz, 12.03.2025).
 */
export function wordRoyxati(
  misollar: Misol[],
  s: WordSozlama,
  mt: WordMatnlari,
  /** ko‘rinish uchun: faqat dastlabki shuncha misol */
  cheklov = Infinity,
): { html: string; tana: string; matn: string } {
  const [och, yop] = mt.qoshtirnoq;
  // Iqtibos ichidagi shu turdagi qo‘shtirnoqlar ichki juftga almashtiriladi: «… „Kun.uz“ …»
  const ichki = (x: string) => x.split(och).join(mt.ichki[0]).split(yop).join(mt.ichki[1]);
  const [ta, tb] = AJRATISH_TEGI[s.ajratish];
  const htmlQatorlar: string[] = [];
  const matnQatorlar: string[] = [];
  const shrift = `font-family:'Times New Roman',serif;font-size:${s.olchamPt}pt;line-height:1.5`;
  const xatboshi = (ichki: string, qoshimcha = "") => `<p style="margin:0 0 6pt;${shrift};text-align:justify${qoshimcha}">${ichki}</p>`;

  let n = Math.max(1, Math.floor(s.boshlangich) || 1);
  let oldingiKat: string | null = null;
  const tartibda = s.guruhlash ? misollarniSaralash(misollar, "kategoriya") : misollar;

  let soni = 0;
  for (const m of tartibda) {
    if (soni++ >= cheklov) break;
    if (s.guruhlash && m.kategoriya !== oldingiKat) {
      const nom = mt.kategoriya(m);
      htmlQatorlar.push(xatboshi(`<b>${html(nom)}</b>`, ";margin-top:6pt"));
      matnQatorlar.push((matnQatorlar.length ? "\n" : "") + nom);
      oldingiKat = m.kategoriya;
    }
    const raqam = s.raqamlash === "qavs" ? `(${n}) ` : s.raqamlash === "nuqta" ? `${n}. ` : "";
    n++;

    const k = s.gap ? m.kontekst : null;
    const fragment = ichki(k?.fragment ?? m.fragment);
    const oldin = ichki(k?.oldin ?? "");
    const keyin = ichki(k?.keyin ?? "");
    const tanaHtml = k ? `${html(oldin)}${ta}${html(fragment)}${tb}${html(keyin)}` : html(fragment);
    const tanaMatn = `${oldin}${fragment}${keyin}`;

    const manbaQismlari = [m.nashr, m.sana ? mt.sana(m.sana) : null].filter(Boolean) as string[];
    if (s.sarlavhaBilan) manbaQismlari.push(`${och}${ichki(m.sarlavha)}${yop}`);
    const manba = manbaQismlari.length ? ` (${manbaQismlari.join(", ")})` : "";
    const izoh = s.izohBilan && m.izoh ? ` — ${m.izoh}` : "";

    htmlQatorlar.push(
      xatboshi(`${html(raqam)}${och}${tanaHtml}${yop}${html(manba)}${izoh ? `<i>${html(izoh)}</i>` : ""}`),
    );
    matnQatorlar.push(`${raqam}${och}${tanaMatn}${yop}${manba}${izoh}`);
  }

  const tana = htmlQatorlar.join("");
  return {
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${tana}</body></html>`,
    tana,
    matn: matnQatorlar.join("\n"),
  };
}
