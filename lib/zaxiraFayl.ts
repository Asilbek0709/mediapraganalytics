/**
 * Zaxira nusxalar: fayl darajasidagi amallar (ulanish parametr sifatida beriladi —
 * shuning uchun db.ts bu moduldan foydalana oladi va testlarda alohida baza bilan sinash mumkin).
 *
 * - Nusxa `VACUUM INTO` bilan olinadi: platforma ishlab turganda ham izchil holat, bitta fayl
 *   (WAL rejimidagi -wal/-shm fayllarisiz), ixcham.
 * - Tiklash bitta tranzaksiyada: zaxira ATTACH qilinadi, har bir jadval tozalanib zaxiradan
 *   to‘ldiriladi, tashqi kalitlar tekshiriladi; xato bo‘lsa — ROLLBACK, joriy baza o‘zgarmaydi.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type ZaxiraTuri = "qolda" | "avto" | "tiklashdan_oldin" | "yuklangan";
export const ZAXIRA_TURLARI: ZaxiraTuri[] = ["qolda", "avto", "tiklashdan_oldin", "yuklangan"];

/** Avtomatik o‘chiriladigan turlar uchun saqlanadigan nusxalar soni (qo‘lda va yuklanganlar o‘chirilmaydi). */
export const SAQLANADI: Partial<Record<ZaxiraTuri, number>> = { avto: 14, tiklashdan_oldin: 10 };

/** MediaPrag bazasi ekanini bildiruvchi jadvallar (eski versiyalarda ham bor). */
export const ZARUR_JADVALLAR = [
  "nashrlar",
  "materiallar",
  "tahlillar",
  "belgilar",
  "kategoriyalar",
  "lugat",
  "mezonlar",
  "sozlamalar",
  "metodika_tarixi",
];

export interface Statistika {
  nashrlar: number;
  materiallar: number;
  /** to‘liq tahlil qilingan (LPSI hisoblangan) */
  tahlillar: number;
  belgilar: number;
  ekspertlar: number;
  ekspert_tahlillari: number;
  metodika_versiya: number | null;
  /** material, tahlil yoki ekspert tahlilining eng so‘nggi o‘zgarish vaqti */
  oxirgi_ozgarish: string | null;
}

export const papka = (bazaYoli: string) => path.join(path.dirname(bazaYoli), "zaxira");
/** Fayl nomi boshidagi baza nomi: demo va asosiy baza zaxiralari aralashmaydi. */
export const prefiks = (bazaYoli: string) => path.basename(bazaYoli).replace(/\.[^.]+$/, "");

const NOM = /^(.+)_(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})(?:-(\d+))?_(qolda|avto|tiklashdan_oldin|yuklangan)\.db$/;

/** «mediaprag_2026-11-06_14-30-05_qolda.db» → { baza, sana: "2026-11-06T14:30:05", tur } */
export function nomniOqish(nom: string): { baza: string; sana: string; tur: ZaxiraTuri } | null {
  const m = NOM.exec(nom);
  if (!m) return null;
  return { baza: m[1], sana: `${m[2]}T${m[3]}:${m[4]}:${m[5]}`, tur: m[7] as ZaxiraTuri };
}

export function vaqtBelgisi(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

/** Shu bazaga tegishli zaxira fayllari, yangisi birinchi. */
export function zaxiraFayllari(bazaYoli: string): { nom: string; sana: string; tur: ZaxiraTuri }[] {
  const dir = papka(bazaYoli);
  if (!fs.existsSync(dir)) return [];
  const baza = prefiks(bazaYoli);
  return fs
    .readdirSync(dir)
    .map((nom) => ({ nom, n: nomniOqish(nom) }))
    .filter((x): x is { nom: string; n: NonNullable<ReturnType<typeof nomniOqish>> } => !!x.n && x.n.baza === baza)
    .map(({ nom, n }) => ({ nom, sana: n.sana, tur: n.tur }))
    .sort((a, b) => b.sana.localeCompare(a.sana) || b.nom.localeCompare(a.nom));
}

/** Bir soniyada ikki nusxa bo‘lsa ham nom takrorlanmaydi. */
export function yangiNom(bazaYoli: string, tur: ZaxiraTuri, d = new Date()): string {
  const dir = papka(bazaYoli);
  const asos = `${prefiks(bazaYoli)}_${vaqtBelgisi(d)}`;
  let nom = `${asos}_${tur}.db`;
  for (let i = 2; fs.existsSync(path.join(dir, nom)); i++) nom = `${asos}-${i}_${tur}.db`;
  return nom;
}

/** Joriy bazaning to‘liq nusxasi. Tranzaksiya ichida chaqirib bo‘lmaydi (SQLite cheklovi). */
export function nusxaYaratish(db: DatabaseSync, bazaYoli: string, tur: ZaxiraTuri, d = new Date()): string {
  const dir = papka(bazaYoli);
  fs.mkdirSync(dir, { recursive: true });
  const nom = yangiNom(bazaYoli, tur, d);
  db.prepare("VACUUM INTO ?").run(path.join(dir, nom));
  const chegara = SAQLANADI[tur];
  if (chegara) eskilarniOchirish(bazaYoli, tur, chegara);
  return nom;
}

/** Faylni va SQLite yordamchi fayllarini (-wal, -shm, -journal) o‘chiradi. */
export function faylniOchirish(yol: string) {
  for (const q of ["", "-wal", "-shm", "-journal"]) {
    try {
      fs.unlinkSync(yol + q);
    } catch {
      // bo‘lmasa — e’tiborsiz
    }
  }
}

export function eskilarniOchirish(bazaYoli: string, tur: ZaxiraTuri, qoldirish: number) {
  zaxiraFayllari(bazaYoli)
    .filter((z) => z.tur === tur)
    .slice(qoldirish)
    .forEach((z) => faylniOchirish(path.join(papka(bazaYoli), z.nom)));
}

/** Bugun avtomatik nusxa olinmagan bo‘lsa — oladi. Natija: yangi fayl nomi yoki null. */
export function avtoZaxira(db: DatabaseSync, bazaYoli: string, d = new Date()): string | null {
  if (db.isTransaction) return null;
  const bugun = vaqtBelgisi(d).slice(0, 10);
  if (zaxiraFayllari(bazaYoli).some((z) => z.tur === "avto" && z.sana.startsWith(bugun))) return null;
  // Bo‘sh, hali ma’lumot kiritilmagan bazadan nusxa olish shart emas
  const bor = db.prepare("SELECT EXISTS (SELECT 1 FROM materiallar) AS bor").get() as { bor: number } | undefined;
  if (!bor?.bor) return null;
  return nusxaYaratish(db, bazaYoli, "avto", d);
}

const son = (db: DatabaseSync, sql: string): number => {
  try {
    return Number((db.prepare(sql).get() as { n: number } | undefined)?.n ?? 0);
  } catch {
    return 0; // eski versiyada jadval bo‘lmasligi mumkin
  }
};

/** Bazadagi asosiy sanoqlar (s — sxema nomi: main yoki ATTACH qilingan). */
export function bazaStatistikasi(db: DatabaseSync, s = "main"): Statistika {
  let versiya: number | null = null;
  try {
    const r = db.prepare(`SELECT qiymat FROM ${s}.sozlamalar WHERE kalit = 'metodika_versiya'`).get() as { qiymat: string } | undefined;
    versiya = r ? Number(r.qiymat) : null;
  } catch {
    versiya = null;
  }
  let oxirgi: string | null = null;
  for (const sql of [
    `SELECT MAX(yangilangan) AS v FROM ${s}.materiallar`,
    `SELECT MAX(yangilangan) AS v FROM ${s}.tahlillar`,
    `SELECT MAX(yangilangan) AS v FROM ${s}.ekspert_tahlillari`,
  ]) {
    try {
      const v = (db.prepare(sql).get() as { v: string | null } | undefined)?.v ?? null;
      if (v && (!oxirgi || v > oxirgi)) oxirgi = v;
    } catch {
      // jadval yo‘q
    }
  }
  return {
    nashrlar: son(db, `SELECT COUNT(*) AS n FROM ${s}.nashrlar`),
    materiallar: son(db, `SELECT COUNT(*) AS n FROM ${s}.materiallar`),
    tahlillar: son(db, `SELECT COUNT(*) AS n FROM ${s}.tahlillar WHERE lpsi IS NOT NULL`),
    belgilar: son(db, `SELECT COUNT(*) AS n FROM ${s}.belgilar`),
    ekspertlar: son(db, `SELECT COUNT(*) AS n FROM ${s}.ekspertlar`),
    ekspert_tahlillari: son(db, `SELECT COUNT(*) AS n FROM ${s}.ekspert_tahlillari`),
    metodika_versiya: versiya,
    oxirgi_ozgarish: oxirgi,
  };
}

export type TekshiruvXatosi = { xato: "sqlite" } | { xato: "butun" } | { xato: "jadval"; jadval: string };

const SARLAVHA = "SQLite format 3\0";

/**
 * Faylni MediaPrag zaxirasi sifatida tekshiradi: SQLite sarlavhasi, butunlik (quick_check)
 * va zarur jadvallar. Yuklangan fayl WAL rejimida bo‘lsa, oddiy rejimga o‘tkaziladi.
 */
export function faylniTekshirish(yol: string): { statistika: Statistika } | TekshiruvXatosi {
  let sarlavha = "";
  try {
    const fd = fs.openSync(yol, "r");
    const b = Buffer.alloc(16);
    fs.readSync(fd, b, 0, 16, 0);
    fs.closeSync(fd);
    sarlavha = b.toString("latin1");
  } catch {
    return { xato: "sqlite" };
  }
  if (sarlavha !== SARLAVHA) return { xato: "sqlite" };

  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(yol);
    db.exec("PRAGMA journal_mode = DELETE");
    const tekshiruv = db.prepare("PRAGMA quick_check").all() as { quick_check: string }[];
    if (tekshiruv.length !== 1 || tekshiruv[0].quick_check !== "ok") return { xato: "butun" };
    const jadvallar = new Set(
      (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name),
    );
    const yoq = ZARUR_JADVALLAR.find((j) => !jadvallar.has(j));
    if (yoq) return { xato: "jadval", jadval: yoq };
    return { statistika: bazaStatistikasi(db) };
  } catch {
    return { xato: "butun" };
  } finally {
    db?.close();
  }
}

const jadvalNomlari = (db: DatabaseSync, s: string) =>
  (db.prepare(`SELECT name FROM ${s}.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all() as { name: string }[]).map(
    (r) => r.name,
  );
const ustunlar = (db: DatabaseSync, s: string, jadval: string) =>
  (db.prepare(`PRAGMA ${s}.table_info("${jadval}")`).all() as { name: string }[]).map((r) => r.name);

/**
 * Joriy bazaning barcha ma’lumotlarini zaxiradagi bilan almashtiradi (bitta tranzaksiya).
 * Sxema joriy versiyaniki qoladi: zaxirada yo‘q yangi jadvallar bo‘sh qoladi, ustunlar kesishmasi ko‘chiriladi.
 */
export function bazagaKochirish(db: DatabaseSync, zaxiraYoli: string): void {
  if (db.isTransaction) throw new Error("tranzaksiya ichida tiklab bo‘lmaydi");
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.prepare("ATTACH DATABASE ? AS zaxira").run(zaxiraYoli);
    try {
      db.exec("BEGIN IMMEDIATE");
      try {
        const asosiy = jadvalNomlari(db, "main");
        const zaxirada = new Set(jadvalNomlari(db, "zaxira"));
        for (const j of asosiy) db.exec(`DELETE FROM main."${j}"`);
        for (const j of asosiy.filter((x) => zaxirada.has(x))) {
          const bor = new Set(ustunlar(db, "zaxira", j));
          const u = ustunlar(db, "main", j)
            .filter((x) => bor.has(x))
            .map((x) => `"${x}"`)
            .join(", ");
          if (u) db.exec(`INSERT INTO main."${j}" (${u}) SELECT ${u} FROM zaxira."${j}"`);
        }
        // AUTOINCREMENT hisoblagichlari — o‘chirilgan yozuvlarning id’lari qayta berilmasligi uchun
        const ketma = (s: string) =>
          !!db.prepare(`SELECT 1 FROM ${s}.sqlite_master WHERE name = 'sqlite_sequence'`).get();
        if (ketma("main")) {
          db.exec("DELETE FROM main.sqlite_sequence");
          if (ketma("zaxira")) db.exec("INSERT INTO main.sqlite_sequence (name, seq) SELECT name, seq FROM zaxira.sqlite_sequence");
        }
        const buzilgan = db.prepare("PRAGMA main.foreign_key_check").all();
        if (buzilgan.length) throw new Error(`foreign_key_check: ${buzilgan.length}`);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    } finally {
      db.exec("DETACH DATABASE zaxira");
    }
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}
