/** Mijoz va serverda bir xil ishlaydigan formatlash funksiyalari. */

export const MEDIA_TURLARI: Record<string, string> = { bosma: "Bosma", raqamli: "Raqamli" };
/** Janri ko‘rsatilmagan materiallar kesimining nomi (bazadagi qiymat emas, faqat guruhlash kaliti). */
export const JANR_YOQ = "ko‘rsatilmagan";

export const QISMLAR: Record<string, string> = { sarlavha: "Sarlavha", lid: "Lid", matn: "Asosiy matn" };

/** 83.33 -> «83,3»; 100 -> «100»; null -> «—» */
export function son(x: number | null | undefined, kasr = 1): string {
  if (x == null || Number.isNaN(Number(x))) return "—";
  return Number(x)
    .toFixed(kasr)
    .replace(/\.0+$/, "")
    .replace(/^-0$/, "0")
    .replace(".", ",");
}

export const idRaqami = (id: number | string) => String(id).padStart(5, "0");

export function sana(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function sanaVaqt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${sana(iso)} ${iso.slice(11, 16)}`;
}

/** Shkaladagi daraja o‘rni -> rang sinfi (0 — eng past, 3 — eng yuqori) */
export function darajaIndeks(nomi: string | null, shkala: { nomi: string }[]): number | null {
  if (!nomi) return null;
  const i = shkala.findIndex((s) => s.nomi === nomi);
  if (i < 0) return null;
  return shkala.length === 1 ? 3 : Math.round((i * 3) / (shkala.length - 1));
}

export function hozirgiVaqt(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
