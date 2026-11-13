/** Tillar va ko‘rinish (mavzu) sozlamalari — server va mijoz uchun umumiy. */

export type Til = "uz" | "ru" | "en";
export type Mavzu = "light" | "dark" | "system";

export const TILLAR: { kod: Til; qisqa: string; nomi: string }[] = [
  { kod: "uz", qisqa: "UZ", nomi: "O‘zbekcha" },
  { kod: "ru", qisqa: "RU", nomi: "Русский" },
  { kod: "en", qisqa: "EN", nomi: "English" },
];

export const ASOSIY_TIL: Til = "uz";
export const TIL_COOKIE = "mp_til";
export const MAVZU_COOKIE = "mp_mavzu";

export const tilmi = (v: unknown): v is Til => v === "uz" || v === "ru" || v === "en";
export const tilniOlish = (v?: string | null): Til => (tilmi(v) ? v : ASOSIY_TIL);
export const mavzuniOlish = (v?: string | null): Mavzu => (v === "light" || v === "dark" ? v : "system");

/** Uch tilning har biri uchun matnlar; ru va en kalitlari uz bilan to‘liq mos bo‘lishi kompilyatorda tekshiriladi. */
export function lugat<K extends string>(
  uz: Record<K, string>,
  ru: Record<NoInfer<K>, string>,
  en: Record<NoInfer<K>, string>,
) {
  return { uz, ru, en };
}
