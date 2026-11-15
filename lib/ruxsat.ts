/**
 * Kirish huquqlari jadvali (toza modul): qaysi sahifa va API qaysi rolga ochiq.
 *
 * Qoida — yopiq standart: jadvalda yo‘q yo‘l faqat administratorga. Proxy har so‘rovda shu jadval bo‘yicha
 * tekshiradi; sahifa va API ichida qo‘shimcha tekshiruvlar (masalan, ekspert faqat o‘z qatlamida) bor.
 */
export type Rol = "admin" | "ekspert" | "kuzatuvchi";
export const ROLLAR: Rol[] = ["admin", "ekspert", "kuzatuvchi"];

const HAMMA: Rol[] = ["admin", "ekspert", "kuzatuvchi"];
/** ko‘rish: hamma rollar (ekspert ham — faqat o‘z qatlamini o‘zgartiradi) */
const OQUVCHI: Rol[] = HAMMA;
/** administrator va ekspert ko‘radigan bo‘limlar (kuzatuvchiga — yo‘q) */
const ISHCHI: Rol[] = ["admin", "ekspert"];

/** Kirishsiz ochiladigan yo‘llar */
const OCHIQ = [/^\/kirish$/, /^\/api\/kirish$/, /^\/api\/sozlash$/];

interface Qoida {
  yol: RegExp;
  /** usul ko‘rsatilmasa — barcha usullar */
  usul?: string[];
  rollar: Rol[];
}

const QOIDALAR: Qoida[] = [
  // hamma kirgan foydalanuvchilar
  { yol: /^\/profil$/, rollar: HAMMA },
  { yol: /^\/api\/(chiqish|parol)$/, rollar: HAMMA },

  // ko‘rish: barcha rollar
  { yol: /^\/$/, rollar: OQUVCHI },
  { yol: /^\/analitika$/, rollar: OQUVCHI },
  { yol: /^\/misollar$/, rollar: OQUVCHI },
  { yol: /^\/hisobot$/, rollar: OQUVCHI },
  { yol: /^\/api\/dashboard$/, usul: ["GET"], rollar: OQUVCHI },
  { yol: /^\/api\/export\/excel$/, usul: ["GET"], rollar: OQUVCHI },
  { yol: /^\/api\/misollar\/excel$/, usul: ["GET"], rollar: OQUVCHI },
  { yol: /^\/api\/davrlar\/excel$/, usul: ["GET"], rollar: OQUVCHI },
  { yol: /^\/api\/nashrlar\/\d+\/hisobot$/, usul: ["GET"], rollar: OQUVCHI },

  // ekspert faqat ko‘radi (tahrirlash tugmalari yashirin, o‘zgartiruvchi API — faqat admin)
  { yol: /^\/mediabaza$/, usul: ["GET"], rollar: ISHCHI },
  { yol: /^\/metodika$/, usul: ["GET"], rollar: ISHCHI },
  { yol: /^\/ekspertlar$/, usul: ["GET"], rollar: ISHCHI },
  { yol: /^\/api\/materiallar$/, usul: ["GET"], rollar: ISHCHI },

  // ekspert ish joyi (o‘z qatlami — sahifa/API ichida qo‘shimcha tekshiriladi)
  { yol: /^\/vazifalar$/, rollar: ["admin", "ekspert"] },
  { yol: /^\/tahlil\/\d+$/, rollar: ["admin", "ekspert"] },
  { yol: /^\/api\/materiallar\/\d+\/ekspertlar\/\d+$/, rollar: ["admin", "ekspert"] },
  { yol: /^\/api\/ekspertlar\/\d+\/vazn$/, usul: ["PUT"], rollar: ["admin", "ekspert"] },
  { yol: /^\/api\/hisoblash$/, usul: ["POST"], rollar: ["admin", "ekspert"] },
];

export const ochiqmi = (yol: string) => OCHIQ.some((r) => r.test(yol));

/** Yo‘l va usul shu rolga ochiqmi (jadvalda yo‘q bo‘lsa — faqat admin). */
export function ruxsatmi(rol: Rol, yol: string, usul = "GET"): boolean {
  if (ochiqmi(yol)) return true;
  const q = QOIDALAR.find((x) => x.yol.test(yol) && (!x.usul || x.usul.includes(usul.toUpperCase())));
  return q ? q.rollar.includes(rol) : rol === "admin";
}

/** Rol uchun bosh sahifa (kirgandan keyin yoki ruxsat bo‘lmagan sahifadan) */
export const boshSahifa = (_rol: Rol) => "/";

/** Kirgandan keyin qaytish manzili: faqat sayt ichidagi va shu rolga ochiq yo‘l */
export function qaytishManzili(keyin: string | null | undefined, rol: Rol): string {
  if (!keyin || !keyin.startsWith("/") || keyin.startsWith("//") || keyin.startsWith("/api/")) return boshSahifa(rol);
  const yol = keyin.split(/[?#]/)[0];
  return ruxsatmi(rol, yol, "GET") && !ochiqmi(yol) ? keyin : boshSahifa(rol);
}
