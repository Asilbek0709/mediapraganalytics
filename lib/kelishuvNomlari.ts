/** Kelishuv ko‘rsatkichlari va qiymatlarining foydalanuvchi tilidagi nomlari (server va mijoz uchun). */
import type { Tarjimon } from "./i18n/index.ts";
import type { KelishuvGuruh, QiymatFormati } from "./kelishuv.ts";

export function korsatkichNomi(kalit: string, tr: Tarjimon): string {
  const { t, atama } = tr;
  if (kalit === "sar_lid" || kalit === "lid_matn" || kalit === "sar_matn") return t(`iz.${kalit}`);
  if (kalit === "kompozitsiya") return t("iz.kompozitsiya");
  if (kalit === "auditoriya") return t("kel.auditoriya");
  if (kalit === "sarlavha_turlari") return t("kel.sarlavhaTurlari");
  if (kalit === "muammo_jami") return t("kel.muammoJami");
  if (kalit === "vosita_jami") return t("kel.vositaJami");
  if (kalit === "lpsi") return "LPSI";
  if (/^k[1-5]$/.test(kalit)) return kalit.toUpperCase();
  if (kalit.startsWith("kat_")) return atama.kategoriya(kalit.slice(4));
  if (kalit.startsWith("tur_")) return t("kel.sarlavhaTur", { v: atama.lugat("sarlavha_turi", kalit.slice(4)).toLowerCase() });
  return kalit;
}

export function guruhNomi(guruh: KelishuvGuruh, tr: Tarjimon): string {
  return tr.t(`kel.g.${guruh}`);
}

export function qiymatKorinishi(v: string | number | null, format: QiymatFormati, tr: Tarjimon): string | null {
  if (v == null) return null;
  if (format === "muvofiqlik") return tr.atama.lugat("muvofiqlik", String(v));
  if (format === "kompozitsiya") return tr.atama.lugat("kompozitsiya", String(v));
  if (format === "bor") return v ? "✓" : "—";
  if (format === "ball") return tr.son(Number(v));
  return String(v);
}

export function baholovchiNomi(kalit: string, nomi: string, tr: Tarjimon): string {
  return kalit === "asosiy" ? tr.t("kel.asosiy") : nomi;
}
