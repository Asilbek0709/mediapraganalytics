/** Zaxira nusxalar: ro‘yxat, yaratish, yuklash, tiklash va o‘chirish (route handler’lar uchun). */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { bazaYoli, getDb } from "./db";
import { ApiError } from "./queries";
import {
  bazagaKochirish,
  bazaStatistikasi,
  faylniOchirish,
  faylniTekshirish,
  nomniOqish,
  nusxaYaratish,
  papka,
  SAQLANADI,
  yangiNom,
  zaxiraFayllari,
  type Statistika,
  type ZaxiraTuri,
} from "./zaxiraFayl";

export interface Zaxira {
  nom: string;
  tur: ZaxiraTuri;
  sana: string;
  hajm: number;
  statistika: Statistika | null;
}

export interface ZaxiraHolati {
  baza: string;
  hajm: number;
  statistika: Statistika;
  papka: string;
  saqlanadi: Partial<Record<ZaxiraTuri, number>>;
  zaxiralar: Zaxira[];
}

/** Yuklanadigan fayl chegarasi (MediaPrag bazasi odatda bir necha MB). */
export const MAX_HAJM = 300 * 1024 * 1024;

// Ro‘yxat har safar barcha nusxalarni ochmasligi uchun: nom + hajm + o‘zgarish vaqti bo‘yicha kesh
const kesh = (globalThis as unknown as { zaxiraKesh?: Map<string, Statistika | null> }).zaxiraKesh ??= new Map();

function nusxaStatistikasi(yol: string, st: fs.Stats): Statistika | null {
  const kalit = `${yol}|${st.size}|${st.mtimeMs}`;
  if (kesh.has(kalit)) return kesh.get(kalit)!;
  let natija: Statistika | null = null;
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(yol, { readOnly: true });
    natija = bazaStatistikasi(db);
  } catch {
    natija = null;
  } finally {
    db?.close();
  }
  kesh.set(kalit, natija);
  return natija;
}

const faylHajmi = (yol: string) => {
  try {
    return fs.statSync(yol).size;
  } catch {
    return 0;
  }
};

export function zaxiraHolati(): ZaxiraHolati {
  const yol = bazaYoli();
  const dir = papka(yol);
  // Loyiha ichida — qisqa yo‘l (data\zaxira), tashqarida — to‘liq yo‘l
  const nisbiy = path.relative(process.cwd(), dir);
  return {
    baza: path.basename(yol),
    // WAL rejimida so‘nggi o‘zgarishlar alohida faylda turadi — hajmga qo‘shiladi
    hajm: faylHajmi(yol) + faylHajmi(`${yol}-wal`),
    statistika: bazaStatistikasi(getDb()),
    papka: nisbiy && !nisbiy.startsWith("..") && !path.isAbsolute(nisbiy) ? nisbiy : dir,
    saqlanadi: SAQLANADI,
    zaxiralar: zaxiraFayllari(yol).map((z) => {
      const fayl = path.join(dir, z.nom);
      const st = fs.statSync(fayl);
      return { ...z, hajm: st.size, statistika: nusxaStatistikasi(fayl, st) };
    }),
  };
}

/** Faqat shu bazaning zaxira papkasidagi mavjud fayl (yo‘l bilan aldashning oldi olinadi). */
export function zaxiraYoli(nom: string): string {
  const yol = bazaYoli();
  const n = nomniOqish(nom);
  if (path.basename(nom) !== nom || !n || !zaxiraFayllari(yol).some((z) => z.nom === nom)) {
    throw new ApiError(404, "x.zaxiraTopilmadi");
  }
  return path.join(papka(yol), nom);
}

export function zaxiraYaratish(): { nom: string } {
  return { nom: nusxaYaratish(getDb(), bazaYoli(), "qolda") };
}

function tekshirishXatosi(n: ReturnType<typeof faylniTekshirish>): Statistika {
  if ("statistika" in n) return n.statistika;
  if (n.xato === "sqlite") throw new ApiError(422, "x.zaxiraSqliteEmas");
  if (n.xato === "jadval") throw new ApiError(422, "x.zaxiraJadvalYoq", { v: n.jadval });
  throw new ApiError(422, "x.zaxiraButunEmas");
}

/** Kompyuterdan tanlangan faylni tekshiradi va ro‘yxatga «yuklangan» nusxa sifatida qo‘shadi. */
export async function zaxiraniYuklash(fayl: File | null): Promise<{ nom: string; statistika: Statistika }> {
  if (!fayl || typeof fayl.arrayBuffer !== "function" || fayl.size === 0) throw new ApiError(422, "x.zaxiraFaylYoq");
  if (fayl.size > MAX_HAJM) throw new ApiError(413, "x.zaxiraKatta", { v: Math.round(MAX_HAJM / 1024 / 1024) });
  const yol = bazaYoli();
  const dir = papka(yol);
  fs.mkdirSync(dir, { recursive: true });
  const nom = yangiNom(yol, "yuklangan");
  const vaqtincha = path.join(dir, `${nom}.tmp`);
  fs.writeFileSync(vaqtincha, Buffer.from(await fayl.arrayBuffer()));
  try {
    const statistika = tekshirishXatosi(faylniTekshirish(vaqtincha));
    fs.renameSync(vaqtincha, path.join(dir, nom));
    return { nom, statistika };
  } finally {
    faylniOchirish(vaqtincha);
  }
}

/**
 * Bazani tanlangan nusxadan tiklaydi. Oldin joriy holatdan «tiklashdan oldin» nusxasi olinadi —
 * xato tanlov bo‘lsa, undan qaytish mumkin.
 */
export function tiklash(nom: string): { oldingi: string; statistika: Statistika } {
  const fayl = zaxiraYoli(nom);
  tekshirishXatosi(faylniTekshirish(fayl));
  const db = getDb();
  const oldingi = nusxaYaratish(db, bazaYoli(), "tiklashdan_oldin");
  try {
    bazagaKochirish(db, fayl);
  } catch (e) {
    console.error("tiklash:", e);
    throw new ApiError(500, "x.tiklashXato");
  }
  return { oldingi, statistika: bazaStatistikasi(db) };
}

export function zaxiraniOchirish(nom: string) {
  faylniOchirish(zaxiraYoli(nom));
  return { ok: true };
}
