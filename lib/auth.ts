/**
 * Kirish: parollar (scrypt), sessiyalar (bazada), joriy foydalanuvchi, foydalanuvchilarni boshqarish.
 *
 *  - Parol faqat scrypt xeshi sifatida saqlanadi (tasodifiy tuz bilan), solishtirish — doimiy vaqtda.
 *  - Sessiya tokeni (32 bayt) faqat cookie’da (HttpOnly, SameSite=Lax); bazada uning SHA-256 xeshi.
 *    Muddat — 14 kun, foydalanishda uzaytiriladi.
 *  - Parol tanlash: 15 daqiqada 5 ta muvaffaqiyatsiz urinishdan keyin email vaqtincha bloklanadi.
 *  - Hisoblar: administrator yaratadi (vaqtinchalik parol, birinchi kirishda almashtiriladi) yoki oddiy
 *    foydalanuvchi o‘zi ro‘yxatdan o‘tadi (kuzatuvchi). Birinchi administrator — «sozlash» orqali.
 *  - Demo rejimi: bosh sahifadagi «Demo ko‘rish» parolsiz umumiy xizmat hisobiga (kuzatuvchi, demo=true)
 *    qisqa sessiya ochadi. Bu hisob ro‘yxatlarda ko‘rinmaydi, parol bilan kirib bo‘lmaydi.
 */
import { createHash, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

import { all, hozir, one, run, transaction } from "./db.ts";
import { MIN_PAROL_UZUNLIGI } from "./parolQoidasi.ts";
import { ApiError } from "./queries.ts";
import { ROLLAR, type Rol } from "./ruxsat.ts";

export const SESSIYA_COOKIE = "mp_sessiya";
const SESSIYA_KUN = 14;
const URINISH_OYNA_DAQIQA = 15;
const URINISH_CHEGARA = 5;
export const MIN_PAROL = MIN_PAROL_UZUNLIGI;

export interface Foydalanuvchi {
  id: number;
  email: string;
  ism: string;
  rol: Rol;
  ekspert_id: number | null;
  parol_almashtirilsin: boolean;
  /** umumiy demo hisobi (faqat ko‘rish, parolsiz) */
  demo: boolean;
}

// ------------------------------------------------------------------ parollar

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function scrypt(parol: string, tuz: Buffer, o: typeof SCRYPT): Promise<Buffer> {
  return new Promise((ok, xato) =>
    scryptCb(parol.normalize("NFKC"), tuz, o.keylen, { N: o.N, r: o.r, p: o.p, maxmem: 64 * 1024 * 1024 } as ScryptOptions, (e, k) =>
      e ? xato(e) : ok(k),
    ),
  );
}

export async function parolXeshi(parol: string): Promise<string> {
  const tuz = randomBytes(16);
  const k = await scrypt(parol, tuz, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${tuz.toString("base64")}$${k.toString("base64")}`;
}

export async function parolTogri(parol: string, xesh: string): Promise<boolean> {
  const q = xesh.split("$");
  if (q.length !== 6 || q[0] !== "scrypt") return false;
  const [N, r, p] = [Number(q[1]), Number(q[2]), Number(q[3])];
  const kutilgan = Buffer.from(q[5], "base64");
  const k = await scrypt(parol, Buffer.from(q[4], "base64"), { N, r, p, keylen: kutilgan.length });
  return k.length === kutilgan.length && timingSafeEqual(k, kutilgan);
}

/** O‘qishga qulay vaqtinchalik parol (o/0, l/1 kabi chalkash belgilarsiz) */
export function vaqtinchalikParol(uzunlik = 12): string {
  const alifbo = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: uzunlik }, () => alifbo[randomInt(alifbo.length)]).join("");
}

export function parolniTekshir(parol: unknown): string {
  if (typeof parol !== "string" || parol.length < MIN_PAROL) throw new ApiError(422, "au.x.parolQisqa", { n: MIN_PAROL });
  if (parol.length > 200) throw new ApiError(422, "au.x.parolUzun");
  return parol;
}

const emailNormal = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : "");
const emailTogri = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
/** Xizmat hisoblari domeni (demo) — oddiy hisob uchun band */
const XIZMAT_DOMENI = "@mediaprag.local";
const xizmatEmaili = (e: string) => e.endsWith(XIZMAT_DOMENI);

// ------------------------------------------------------------------ sessiyalar

const tokenXeshi = (token: string) => createHash("sha256").update(token).digest("hex");
const muddat = (kun = SESSIYA_KUN) => hozir(new Date(Date.now() + kun * 86400_000));
/** Demo sessiyasi qisqa: bir kun (umumiy hisob, ochiq kompyuterda qolib ketsa ham) */
export const DEMO_SESSIYA_KUN = 1;

/** Cookie parametrlari: HTTPS’da (Vercel) Secure, kompyuterdagi http://127.0.0.1 da — Secure’siz. */
export function cookieParametrlari(kun = SESSIYA_KUN) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.VERCEL === "1" || process.env.MEDIAPRAG_HTTPS === "1",
    path: "/",
    maxAge: kun * 86400,
  };
}

/** Token bo‘yicha faol sessiya va foydalanuvchi; muddatining yarmi o‘tgan bo‘lsa — uzaytiriladi. */
export async function sessiyaFoydalanuvchisi(token: string | undefined | null): Promise<Foydalanuvchi | null> {
  if (!token || token.length > 200) return null;
  const id = tokenXeshi(token);
  const r = await one<Foydalanuvchi & { muddat: string }>(
    `SELECT f.id, f.email, f.ism, f.rol, f.ekspert_id, f.parol_almashtirilsin, f.demo, s.muddat
     FROM sessiyalar s JOIN foydalanuvchilar f ON f.id = s.foydalanuvchi_id
     WHERE s.id = ? AND f.faol`,
    [id],
  );
  if (!r || r.muddat < hozir()) return null;
  // demo sessiyasi uzaytirilmaydi — bir kundan keyin «Demo ko‘rish» qayta bosiladi
  const yarim = hozir(new Date(Date.now() + (SESSIYA_KUN / 2) * 86400_000));
  if (!r.demo && r.muddat < yarim) await run("UPDATE sessiyalar SET muddat = ? WHERE id = ?", [muddat(), id]);
  const { muddat: _m, ...f } = r;
  return f;
}

async function sessiyaYaratish(foydalanuvchiId: number, kun = SESSIYA_KUN): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await run("INSERT INTO sessiyalar (id, foydalanuvchi_id, yaratilgan, muddat) VALUES (?, ?, ?, ?)", [
    tokenXeshi(token),
    foydalanuvchiId,
    hozir(),
    muddat(kun),
  ]);
  // Eskirgan sessiyalar vaqti-vaqti bilan tozalanadi
  await run("DELETE FROM sessiyalar WHERE muddat < ?", [hozir()]);
  return token;
}

export async function sessiyaniTugatish(token: string | undefined | null) {
  if (token) await run("DELETE FROM sessiyalar WHERE id = ?", [tokenXeshi(token)]);
}

// ------------------------------------------------------------------ kirish

/** Email va parol to‘g‘ri bo‘lsa — yangi sessiya tokeni. Noto‘g‘ri bo‘lsa — umumiy xato (qaysisi noto‘g‘riligi aytilmaydi). */
export async function kirish(data: unknown): Promise<{ token: string; foydalanuvchi: Foydalanuvchi }> {
  const d = (data ?? {}) as Record<string, unknown>;
  const email = emailNormal(d.email);
  const parol = typeof d.parol === "string" ? d.parol : "";
  if (!email || !parol) throw new ApiError(422, "au.x.maydonlar");

  const oyna = hozir(new Date(Date.now() - URINISH_OYNA_DAQIQA * 60_000));
  const xatolar = (await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM kirish_urinishlari WHERE email = ? AND vaqt >= ? AND NOT muvaffaqiyat",
    [email, oyna],
  ))!.n;
  if (xatolar >= URINISH_CHEGARA) throw new ApiError(429, "au.x.kopUrinish", { n: URINISH_OYNA_DAQIQA });

  const f = await one<Foydalanuvchi & { parol_hash: string; faol: boolean }>(
    "SELECT id, email, ism, rol, ekspert_id, parol_almashtirilsin, demo, parol_hash, faol FROM foydalanuvchilar WHERE email = ? AND NOT demo",
    [email],
  );
  // Hisob bo‘lmasa ham xesh hisoblanadi — javob vaqti bo‘yicha emailni aniqlab bo‘lmasin
  const togri = f ? await parolTogri(parol, f.parol_hash) : (await parolXeshi(parol), false);
  await run("INSERT INTO kirish_urinishlari (email, vaqt, muvaffaqiyat) VALUES (?, ?, ?)", [email, hozir(), togri && !!f?.faol]);
  await run("DELETE FROM kirish_urinishlari WHERE vaqt < ?", [hozir(new Date(Date.now() - 86400_000))]);
  if (!f || !togri || !f.faol) throw new ApiError(401, "au.x.notogri");

  await run("UPDATE foydalanuvchilar SET oxirgi_kirish = ? WHERE id = ?", [hozir(), f.id]);
  const { parol_hash: _p, faol: _f, ...foydalanuvchi } = f;
  return { token: await sessiyaYaratish(f.id), foydalanuvchi };
}

/** Joriy foydalanuvchi o‘z parolini almashtiradi; boshqa qurilmalardagi sessiyalar tugatiladi. */
export async function parolniAlmashtirish(f: Foydalanuvchi, token: string, data: unknown) {
  if (f.demo) throw new ApiError(403, "au.x.demo");
  const d = (data ?? {}) as Record<string, unknown>;
  const yangi = parolniTekshir(d.yangi);
  const r = await one<{ parol_hash: string }>("SELECT parol_hash FROM foydalanuvchilar WHERE id = ?", [f.id]);
  if (!r || typeof d.eski !== "string" || !(await parolTogri(d.eski, r.parol_hash))) throw new ApiError(422, "au.x.eskiNotogri");
  if (d.eski === yangi) throw new ApiError(422, "au.x.parolBirXil");
  await transaction(async () => {
    await run("UPDATE foydalanuvchilar SET parol_hash = ?, parol_almashtirilsin = false WHERE id = ?", [await parolXeshi(yangi), f.id]);
    await run("DELETE FROM sessiyalar WHERE foydalanuvchi_id = ? AND id <> ?", [f.id, tokenXeshi(token)]);
  });
  return { ok: true };
}

// ------------------------------------------------------------------ birinchi administrator

/** Sozlash kaliti talab qilinadimi: tashqi bazada (Supabase/Vercel) — ha, kompyuterdagi PGlite’da — yo‘q. */
export const sozlashKalitiKerak = () => !!process.env.DATABASE_URL || process.env.VERCEL === "1";

export async function sozlashKerakmi(): Promise<boolean> {
  return !(await one("SELECT 1 FROM foydalanuvchilar WHERE rol = 'admin' LIMIT 1"));
}

/** Hali administrator bo‘lmasa — birinchisini yaratadi (tashqi bazada MEDIAPRAG_SOZLASH_KALITI bilan). */
export async function birinchiAdmin(data: unknown): Promise<{ token: string; foydalanuvchi: Foydalanuvchi }> {
  const d = (data ?? {}) as Record<string, unknown>;
  if (sozlashKalitiKerak()) {
    const kalit = process.env.MEDIAPRAG_SOZLASH_KALITI ?? "";
    const berilgan = typeof d.kalit === "string" ? d.kalit : "";
    if (kalit.length < 12) throw new ApiError(503, "au.x.kalitOrnatilmagan");
    const a = Buffer.from(kalit);
    const b = Buffer.from(berilgan);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(403, "au.x.kalitNotogri");
  }
  const email = emailNormal(d.email);
  const ism = typeof d.ism === "string" ? d.ism.trim() : "";
  if (!emailTogri(email) || !ism) throw new ApiError(422, "au.x.maydonlar");
  const parol = parolniTekshir(d.parol);
  return transaction(async () => {
    await one("SELECT pg_advisory_xact_lock(4207119)");
    if (!(await sozlashKerakmi())) throw new ApiError(409, "au.x.sozlanganu");
    const f = await one<{ id: number }>(
      `INSERT INTO foydalanuvchilar (email, ism, rol, parol_hash, parol_almashtirilsin, yaratilgan, oxirgi_kirish)
       VALUES (?, ?, 'admin', ?, false, ?, ?) RETURNING id`,
      [email, ism, await parolXeshi(parol), hozir(), hozir()],
    );
    return {
      token: await sessiyaYaratish(f!.id),
      foydalanuvchi: { id: f!.id, email, ism, rol: "admin" as const, ekspert_id: null, parol_almashtirilsin: false, demo: false },
    };
  });
}

// ------------------------------------------------------------------ demo rejimi

const DEMO_EMAIL = "demo" + XIZMAT_DOMENI;
/** Bir vaqtda saqlanadigan demo sessiyalari chegarasi (eng yangilari qoladi) */
const DEMO_SESSIYA_CHEGARA = 500;

/** Demo ochiqmi: administrator o‘chirmagan (standart — yoqilgan) va platforma sozlangan */
export async function demoOchiqmi(): Promise<boolean> {
  const s = await one<{ qiymat: string }>("SELECT qiymat FROM sozlamalar WHERE kalit = 'demo_ochiq'");
  return s?.qiymat !== "0" && !(await sozlashKerakmi());
}

/**
 * «Demo ko‘rish»: umumiy demo hisobi (birinchi marta — yaratiladi) uchun qisqa sessiya.
 * Hisob kuzatuvchi roli bilan — o‘zgartiruvchi API’lar proxy’da yopiq, tugmalar interfeysda yashirin.
 */
export async function demoKirish(): Promise<{ token: string; foydalanuvchi: Foydalanuvchi }> {
  if (!(await demoOchiqmi())) throw new ApiError(403, "au.x.demoYopiq");
  const f = await transaction(async () => {
    await one("SELECT pg_advisory_xact_lock(4207120)");
    const bor = await one<{ id: number }>("SELECT id FROM foydalanuvchilar WHERE demo ORDER BY id LIMIT 1");
    if (bor) {
      // hisob ro‘yxatlarda yo‘q, lekin rol va holat har ehtimolga qayta qo‘yiladi
      await run("UPDATE foydalanuvchilar SET rol = 'kuzatuvchi', ekspert_id = NULL, faol = true, oxirgi_kirish = ? WHERE id = ?", [
        hozir(),
        bor.id,
      ]);
      return bor;
    }
    // parol xeshi ataylab yaroqsiz («scrypt$…» shakli emas) — parol bilan kirib bo‘lmaydi
    return (await one<{ id: number }>(
      `INSERT INTO foydalanuvchilar (email, ism, rol, parol_hash, parol_almashtirilsin, yaratilgan, oxirgi_kirish, demo)
       VALUES (?, 'Demo', 'kuzatuvchi', '!demo', false, ?, ?, true) RETURNING id`,
      [DEMO_EMAIL, hozir(), hozir()],
    ))!;
  });
  const token = await sessiyaYaratish(f.id, DEMO_SESSIYA_KUN);
  await run(
    `DELETE FROM sessiyalar WHERE foydalanuvchi_id = ? AND id NOT IN
       (SELECT id FROM sessiyalar WHERE foydalanuvchi_id = ? ORDER BY yaratilgan DESC LIMIT ${DEMO_SESSIYA_CHEGARA})`,
    [f.id, f.id],
  );
  return {
    token,
    foydalanuvchi: { id: f.id, email: DEMO_EMAIL, ism: "Demo", rol: "kuzatuvchi", ekspert_id: null, parol_almashtirilsin: false, demo: true },
  };
}

/** Administrator: demo rejimini yoqish/o‘chirish — o‘chirilganda ochiq demo sessiyalari darhol tugaydi */
export async function demoniSozlash(data: unknown): Promise<{ ochiq: boolean }> {
  const d = (data ?? {}) as Record<string, unknown>;
  if (typeof d.ochiq !== "boolean") throw new ApiError(422, "x.notogriSorov");
  await transaction(async () => {
    await run(
      "INSERT INTO sozlamalar (kalit, qiymat) VALUES ('demo_ochiq', ?) ON CONFLICT (kalit) DO UPDATE SET qiymat = excluded.qiymat",
      [d.ochiq ? "1" : "0"],
    );
    if (!d.ochiq) await run("DELETE FROM sessiyalar WHERE foydalanuvchi_id IN (SELECT id FROM foydalanuvchilar WHERE demo)");
  });
  return { ochiq: d.ochiq };
}

// ------------------------------------------------------------------ ochiq ro‘yxatdan o‘tish

/** Butun sayt bo‘yicha soatiga ko‘pi bilan shuncha yangi hisob (botlarga qarshi) */
const ROYXAT_SOAT_CHEGARA = 30;

/** Ro‘yxatdan o‘tish ochiqmi: administrator o‘chirmagan va platforma sozlangan (birinchi administrator bor) */
export async function royxatOchiqmi(): Promise<boolean> {
  const s = await one<{ qiymat: string }>("SELECT qiymat FROM sozlamalar WHERE kalit = 'royxat_ochiq'");
  return s?.qiymat !== "0" && !(await sozlashKerakmi());
}

export async function royxatniSozlash(data: unknown): Promise<{ ochiq: boolean }> {
  const d = (data ?? {}) as Record<string, unknown>;
  if (typeof d.ochiq !== "boolean") throw new ApiError(422, "x.notogriSorov");
  await run(
    "INSERT INTO sozlamalar (kalit, qiymat) VALUES ('royxat_ochiq', ?) ON CONFLICT (kalit) DO UPDATE SET qiymat = excluded.qiymat",
    [d.ochiq ? "1" : "0"],
  );
  return { ochiq: d.ochiq };
}

/**
 * Oddiy foydalanuvchi o‘zi ro‘yxatdan o‘tadi — kuzatuvchi roli (faqat ko‘rish). Ekspert qilishni administrator
 * «Foydalanuvchilar» sahifasida rolni o‘zgartirib bajaradi. «veb_sayt» — botlar uchun yashirin tuzoq maydoni.
 */
export async function royxatdanOtish(data: unknown): Promise<{ token: string; foydalanuvchi: Foydalanuvchi }> {
  const d = (data ?? {}) as Record<string, unknown>;
  if (!(await royxatOchiqmi())) throw new ApiError(403, "au.x.royxatYopiq");
  if (typeof d.veb_sayt === "string" && d.veb_sayt.trim()) throw new ApiError(422, "au.x.maydonlar");
  const email = emailNormal(d.email);
  const ism = typeof d.ism === "string" ? d.ism.trim() : "";
  if (!emailTogri(email) || xizmatEmaili(email)) throw new ApiError(422, "au.x.email");
  if (!ism || ism.length > 200) throw new ApiError(422, "au.x.maydonlar");
  const parol = parolniTekshir(d.parol);
  if (typeof d.takror === "string" && d.takror !== parol) throw new ApiError(422, "au.parolMos");
  const soatOldin = hozir(new Date(Date.now() - 3600_000));
  const songgi = (await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM foydalanuvchilar WHERE ozi_royxatdan AND yaratilgan >= ?",
    [soatOldin],
  ))!.n;
  if (songgi >= ROYXAT_SOAT_CHEGARA) throw new ApiError(429, "au.x.royxatKop");
  if (await one("SELECT 1 FROM foydalanuvchilar WHERE email = ?", [email])) throw new ApiError(409, "au.x.emailBand");
  const vaqt = hozir();
  const f = await one<{ id: number }>(
    `INSERT INTO foydalanuvchilar (email, ism, rol, parol_hash, parol_almashtirilsin, yaratilgan, oxirgi_kirish, ozi_royxatdan)
     VALUES (?, ?, 'kuzatuvchi', ?, false, ?, ?, true) RETURNING id`,
    [email, ism, await parolXeshi(parol), vaqt, vaqt],
  );
  return {
    token: await sessiyaYaratish(f!.id),
    foydalanuvchi: { id: f!.id, email, ism, rol: "kuzatuvchi", ekspert_id: null, parol_almashtirilsin: false, demo: false },
  };
}

// ------------------------------------------------------------------ foydalanuvchilarni boshqarish (admin)

export interface FoydalanuvchiQatori extends Foydalanuvchi {
  faol: boolean;
  yaratilgan: string;
  oxirgi_kirish: string | null;
  ekspert_ism: string | null;
  /** kirish sahifasida o‘zi ro‘yxatdan o‘tgan (administrator yaratmagan) */
  ozi_royxatdan: boolean;
}

export function foydalanuvchilar(): Promise<FoydalanuvchiQatori[]> {
  return all<FoydalanuvchiQatori>(
    `SELECT f.id, f.email, f.ism, f.rol, f.ekspert_id, f.parol_almashtirilsin, f.faol, f.yaratilgan, f.oxirgi_kirish,
            f.ozi_royxatdan, f.demo, e.ism AS ekspert_ism
     FROM foydalanuvchilar f LEFT JOIN ekspertlar e ON e.id = f.ekspert_id
     WHERE NOT f.demo
     ORDER BY CASE f.rol WHEN 'admin' THEN 0 WHEN 'ekspert' THEN 1 ELSE 2 END, f.ism`,
  );
}

const rolTekshir = (r: unknown): Rol => {
  if (!ROLLAR.includes(r as Rol)) throw new ApiError(422, "au.x.rol");
  return r as Rol;
};

/** Ekspert roli uchun: mavjud ekspert yozuvi (bog‘lanmagan) yoki shu ism bilan yangisi. */
async function ekspertYozuvi(rol: Rol, ekspertId: unknown, ism: string, foydalanuvchiId?: number): Promise<number | null> {
  if (rol !== "ekspert") return null;
  if (ekspertId != null && ekspertId !== "") {
    const id = Number(ekspertId);
    if (!(await one("SELECT 1 FROM ekspertlar WHERE id = ?", [id]))) throw new ApiError(422, "x.ekspertTopilmadi");
    const band = await one<{ id: number }>("SELECT id FROM foydalanuvchilar WHERE ekspert_id = ?", [id]);
    if (band && band.id !== foydalanuvchiId) throw new ApiError(409, "au.x.ekspertBand");
    return id;
  }
  const bor = await one<{ id: number }>("SELECT id FROM ekspertlar WHERE ism = ?", [ism]);
  if (bor) {
    const band = await one<{ id: number }>("SELECT id FROM foydalanuvchilar WHERE ekspert_id = ?", [bor.id]);
    if (band && band.id !== foydalanuvchiId) throw new ApiError(409, "au.x.ekspertBand");
    return bor.id;
  }
  return (await one<{ id: number }>("INSERT INTO ekspertlar (ism, yaratilgan) VALUES (?, ?) RETURNING id", [ism, hozir()]))!.id;
}

/** Yangi hisob: vaqtinchalik parol qaytariladi (bir marta ko‘rsatiladi), birinchi kirishda almashtiriladi. */
export async function foydalanuvchiQoshish(data: unknown): Promise<{ id: number; parol: string }> {
  const d = (data ?? {}) as Record<string, unknown>;
  const email = emailNormal(d.email);
  const ism = typeof d.ism === "string" ? d.ism.trim() : "";
  if (!emailTogri(email) || xizmatEmaili(email)) throw new ApiError(422, "au.x.email");
  if (!ism || ism.length > 200) throw new ApiError(422, "x.ekspertIsmi");
  const rol = rolTekshir(d.rol);
  if (await one("SELECT 1 FROM foydalanuvchilar WHERE email = ?", [email])) throw new ApiError(409, "au.x.emailBand");
  const parol = vaqtinchalikParol();
  return transaction(async () => {
    const ekspertId = await ekspertYozuvi(rol, d.ekspert_id, ism);
    const r = await one<{ id: number }>(
      `INSERT INTO foydalanuvchilar (email, ism, rol, parol_hash, ekspert_id, parol_almashtirilsin, yaratilgan)
       VALUES (?, ?, ?, ?, ?, true, ?) RETURNING id`,
      [email, ism, rol, await parolXeshi(parol), ekspertId, hozir()],
    );
    return { id: r!.id, parol };
  });
}

/** Faol administratorlar qolishini ta’minlaydi (o‘zini o‘chirib qo‘yib, tizimni egasiz qoldirmaslik uchun). */
async function adminQoladimi(istisno: number) {
  const n = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM foydalanuvchilar WHERE rol = 'admin' AND faol AND id <> ?", [istisno]))!.n;
  if (n < 1) throw new ApiError(409, "au.x.oxirgiAdmin");
}

export async function foydalanuvchiTahrirlash(joriy: Foydalanuvchi, id: number, data: unknown) {
  const f = await one<{ id: number; rol: Rol; ism: string; faol: boolean }>(
    "SELECT id, rol, ism, faol FROM foydalanuvchilar WHERE id = ? AND NOT demo",
    [id],
  );
  if (!f) throw new ApiError(404, "au.x.topilmadi");
  const d = (data ?? {}) as Record<string, unknown>;
  const rol = d.rol === undefined ? f.rol : rolTekshir(d.rol);
  const faol = d.faol === undefined ? f.faol : d.faol === true;
  const ism = typeof d.ism === "string" && d.ism.trim() ? d.ism.trim() : f.ism;
  if (f.rol === "admin" && (rol !== "admin" || !faol)) await adminQoladimi(id);
  if (id === joriy.id && (rol !== "admin" || !faol)) throw new ApiError(409, "au.x.ozingiz");
  await transaction(async () => {
    const ekspertId = await ekspertYozuvi(rol, d.ekspert_id, ism, id);
    await run("UPDATE foydalanuvchilar SET ism = ?, rol = ?, faol = ?, ekspert_id = ? WHERE id = ?", [ism, rol, faol, ekspertId, id]);
    if (!faol) await run("DELETE FROM sessiyalar WHERE foydalanuvchi_id = ?", [id]);
  });
  return { ok: true };
}

/** Administrator parolni tiklaydi: yangi vaqtinchalik parol, barcha sessiyalar tugatiladi. */
export async function parolniTiklash(id: number): Promise<{ parol: string }> {
  if (!(await one("SELECT 1 FROM foydalanuvchilar WHERE id = ? AND NOT demo", [id]))) throw new ApiError(404, "au.x.topilmadi");
  const parol = vaqtinchalikParol();
  await transaction(async () => {
    await run("UPDATE foydalanuvchilar SET parol_hash = ?, parol_almashtirilsin = true WHERE id = ?", [await parolXeshi(parol), id]);
    await run("DELETE FROM sessiyalar WHERE foydalanuvchi_id = ?", [id]);
  });
  return { parol };
}

export async function foydalanuvchiOchirish(joriy: Foydalanuvchi, id: number) {
  if (id === joriy.id) throw new ApiError(409, "au.x.ozingiz");
  const f = await one<{ rol: Rol }>("SELECT rol FROM foydalanuvchilar WHERE id = ? AND NOT demo", [id]);
  if (!f) throw new ApiError(404, "au.x.topilmadi");
  if (f.rol === "admin") await adminQoladimi(id);
  await run("DELETE FROM foydalanuvchilar WHERE id = ?", [id]);
  return { ok: true };
}
