/** Yon menyu holati (yoyiq / yig‘iq) — cookie’da saqlanadi, server sahifani darhol to‘g‘ri kenglikda chizadi. */
export const MENYU_COOKIE = "mp_menyu";
export type MenyuHolati = "yoyiq" | "yigiq";
export const menyuniOlish = (v?: string | null): MenyuHolati => (v === "yigiq" ? "yigiq" : "yoyiq");
