/**
 * Material manbasi (toza modul — serverda ham, brauzerda ham ishlaydi).
 *
 * ТЗ v2, 6–7-bo‘limlar: har bir material qayerdan olingani va tadqiqotchi tekshirganmi — saqlanadi.
 * Sun’iy (namuna) va tekshirilmagan materiallar statistikaga kirmaydi.
 */

export const MANBA_TURLARI = ["qolda", "havola", "pdf", "ocr", "import", "suniy"] as const;
export type ManbaTuri = (typeof MANBA_TURLARI)[number];
export const manbaTurimi = (v: unknown): v is ManbaTuri => MANBA_TURLARI.includes(v as ManbaTuri);

/** Kuzatish parametrlari — havola taqqoslanganda e’tiborga olinmaydi */
const KUZATISH = /^(utm_[a-z]+|fbclid|gclid|yclid|mc_cid|mc_eid|ref|from)$/i;

/**
 * Havolani taqqoslash uchun yagona ko‘rinishga keltiradi: kichik harfli host, «www.» siz, #… siz,
 * kuzatish parametrlarisiz, oxirgi «/» siz. Takroriy materialni topishda ishlatiladi.
 */
export function havolaKaliti(havola: string | null | undefined): string | null {
  const s = havola?.trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    const qolgan = [...u.searchParams.entries()].filter(([k]) => !KUZATISH.test(k)).sort(([a], [b]) => a.localeCompare(b));
    const q = new URLSearchParams(qolgan).toString();
    let yol = decodeURI(u.pathname).replace(/\/+$/, "");
    if (!yol) yol = "";
    return `${host}${yol}${q ? `?${q}` : ""}`;
  } catch {
    return null;
  }
}

/** Xesh uchun matnni bir xil ko‘rinishga keltirish: katta-kichik harf, bo‘shliqlar, tutuq belgilari farq qilmaydi. */
export function heshUchunMatn(m: { sarlavha?: string | null; lid?: string | null; matn?: string | null }): string | null {
  const norm = (s?: string | null) =>
    (s ?? "")
      .normalize("NFC")
      .toLocaleLowerCase()
      .replace(/[‘’ʻʼ`´']/g, "'")
      .replace(/[«»“”„"]/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  const matn = norm(m.matn);
  // Asosiy matn yetarlicha uzun bo‘lsa — faqat u (sarlavha tahrirlansa ham takror aniqlanadi)
  if (matn.length >= 80) return matn;
  const hammasi = [norm(m.sarlavha), norm(m.lid), matn].filter(Boolean).join("\n");
  return hammasi || null;
}

/** Statistikaga kiradimi: sun’iy emas va tekshirilgan (namoyish rejimida sun’iylar ham kiradi). */
export function statistikagaKiradimi(m: { manba_turi?: string | null; tekshirilgan?: boolean | null }, namoyish = false): boolean {
  if (m.tekshirilgan === false) return false;
  return namoyish || m.manba_turi !== "suniy";
}
