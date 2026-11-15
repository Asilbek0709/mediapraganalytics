import {
  ChartNoAxesCombined,
  ClipboardCheck,
  FileChartColumn,
  FlaskConical,
  LayoutDashboard,
  Newspaper,
  Quote,
  UserCog,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { Kalit } from "@/lib/i18n";
import { ruxsatmi, type Rol } from "@/lib/ruxsat";

export interface Bolim {
  href: string;
  kalit: Kalit;
  belgi: LucideIcon;
}

/** Platforma bo‘limlari — yon menyu va tezkor qidiruv uchun umumiy ro‘yxat. */
export const BOLIMLAR: Bolim[] = [
  { href: "/", kalit: "nav.bosh", belgi: LayoutDashboard },
  { href: "/mediabaza", kalit: "nav.mediabaza", belgi: Newspaper },
  { href: "/analitika", kalit: "nav.analitika", belgi: ChartNoAxesCombined },
  { href: "/misollar", kalit: "nav.misollar", belgi: Quote },
  { href: "/metodika", kalit: "nav.metodika", belgi: FlaskConical },
  { href: "/ekspertlar", kalit: "nav.ekspertlar", belgi: UsersRound },
  { href: "/hisobot", kalit: "nav.hisobot", belgi: FileChartColumn },
  { href: "/vazifalar", kalit: "nav.vazifalar", belgi: ClipboardCheck },
  { href: "/foydalanuvchilar", kalit: "nav.foydalanuvchilar", belgi: UserCog },
];

/** Faqat shu rolga ochiq bo‘limlar; «Vazifalarim» — faqat ekspertga. */
export function korinadiganBolimlar(rol: Rol): Bolim[] {
  return BOLIMLAR.filter((b) => ruxsatmi(rol, b.href) && (b.href !== "/vazifalar" || rol === "ekspert"));
}

export function faolmi(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/mediabaza") return pathname.startsWith("/mediabaza") || pathname.startsWith("/tahlil");
  if (href === "/ekspertlar") return pathname.startsWith("/ekspertlar") || pathname.startsWith("/kelishuv");
  return pathname.startsWith(href);
}

/** Ism-familiyadan avatar uchun bosh harflar: «Asilbek Karimov» → «AK». */
export function boshHarflar(ism: string): string {
  // faqat harf va raqamlar: «[DEMO] Ekspert A» → «DA», qavslar avatarga tushmaydi
  const s = ism
    .trim()
    .split(/\s+/)
    .map((soz) => soz.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  const h = (s.length > 1 ? s[0][0] + s[s.length - 1][0] : (s[0] ?? "?").slice(0, 2)).toUpperCase();
  return h || "?";
}
