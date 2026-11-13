/**
 * SQLite bazasi (Node’ning o‘z `node:sqlite` moduli — qo‘shimcha kutubxona kerak emas).
 *
 * Baza fayli: data/mediaprag.db (loyiha ildizida). Boshqa faylni ishlatish uchun
 * MEDIAPRAG_DB muhit o‘zgaruvchisiga yo‘l beriladi (masalan, demo baza uchun).
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

import { KATEGORIYALAR, LUGAT, MEZONLAR, NASHRLAR, SHKALA } from "./seed";
import { avtoZaxira } from "./zaxiraFayl";

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS nashrlar (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    nomi  TEXT NOT NULL UNIQUE,
    turi  TEXT NOT NULL CHECK (turi IN ('bosma', 'raqamli'))
);

CREATE TABLE IF NOT EXISTS materiallar (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nashr_id    INTEGER NOT NULL REFERENCES nashrlar(id),
    sana        TEXT,
    janr        TEXT,
    mavzu       TEXT,
    havola      TEXT,
    sarlavha    TEXT NOT NULL,
    lid         TEXT,
    matn        TEXT,
    yaratilgan  TEXT NOT NULL,
    yangilangan TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tahlillar (
    material_id      INTEGER PRIMARY KEY REFERENCES materiallar(id) ON DELETE CASCADE,
    sarlavha_turlari TEXT NOT NULL DEFAULT '[]',
    kompozitsiya     TEXT,
    sar_lid          TEXT,
    lid_matn         TEXT,
    sar_matn         TEXT,
    auditoriya       INTEGER CHECK (auditoriya BETWEEN 1 AND 5),
    izoh             TEXT,
    k1 REAL, k2 REAL, k3 REAL, k4 REAL, k5 REAL,
    lpsi             REAL,
    daraja           TEXT,
    metodika_versiya INTEGER,
    yangilangan      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS belgilar (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL REFERENCES materiallar(id) ON DELETE CASCADE,
    kategoriya  TEXT NOT NULL REFERENCES kategoriyalar(kod),
    qism        TEXT NOT NULL CHECK (qism IN ('sarlavha', 'lid', 'matn')),
    fragment    TEXT,
    izoh        TEXT
);

CREATE TABLE IF NOT EXISTS kategoriyalar (
    kod    TEXT PRIMARY KEY,
    nomi   TEXT NOT NULL,
    guruh  TEXT NOT NULL CHECK (guruh IN ('muammo', 'vosita')),
    mezon  TEXT,
    jarima REAL NOT NULL DEFAULT 0,
    tartib INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lugat (
    turkum TEXT NOT NULL,
    kod    TEXT NOT NULL,
    nomi   TEXT NOT NULL,
    qiymat REAL,
    tartib INTEGER NOT NULL,
    PRIMARY KEY (turkum, kod)
);

CREATE TABLE IF NOT EXISTS mezonlar (
    kod    TEXT PRIMARY KEY,
    nomi   TEXT NOT NULL,
    vazn   REAL NOT NULL,
    tavsif TEXT
);

CREATE TABLE IF NOT EXISTS sozlamalar (
    kalit  TEXT PRIMARY KEY,
    qiymat TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metodika_tarixi (
    versiya  INTEGER PRIMARY KEY,
    sana     TEXT NOT NULL,
    izoh     TEXT,
    snapshot TEXT NOT NULL
);

-- v3: ekspertlar, ularning mustaqil tahlillari va vaznlar bo‘yicha so‘rov
CREATE TABLE IF NOT EXISTS ekspertlar (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ism        TEXT NOT NULL UNIQUE,
    izoh       TEXT,
    yaratilgan TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ekspert_tahlillari (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id      INTEGER NOT NULL REFERENCES materiallar(id) ON DELETE CASCADE,
    ekspert_id       INTEGER NOT NULL REFERENCES ekspertlar(id) ON DELETE CASCADE,
    sarlavha_turlari TEXT NOT NULL DEFAULT '[]',
    kompozitsiya     TEXT,
    sar_lid          TEXT,
    lid_matn         TEXT,
    sar_matn         TEXT,
    auditoriya       INTEGER CHECK (auditoriya BETWEEN 1 AND 5),
    izoh             TEXT,
    k1 REAL, k2 REAL, k3 REAL, k4 REAL, k5 REAL,
    lpsi             REAL,
    daraja           TEXT,
    metodika_versiya INTEGER,
    yangilangan      TEXT NOT NULL,
    UNIQUE (material_id, ekspert_id)
);

CREATE TABLE IF NOT EXISTS ekspert_belgilari (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    ekspert_tahlil_id INTEGER NOT NULL REFERENCES ekspert_tahlillari(id) ON DELETE CASCADE,
    kategoriya        TEXT NOT NULL REFERENCES kategoriyalar(kod),
    qism              TEXT NOT NULL CHECK (qism IN ('sarlavha', 'lid', 'matn')),
    fragment          TEXT,
    izoh              TEXT
);

CREATE TABLE IF NOT EXISTS ekspert_vaznlari (
    ekspert_id  INTEGER PRIMARY KEY REFERENCES ekspertlar(id) ON DELETE CASCADE,
    k1 REAL NOT NULL, k2 REAL NOT NULL, k3 REAL NOT NULL, k4 REAL NOT NULL, k5 REAL NOT NULL,
    izoh        TEXT,
    yangilangan TEXT NOT NULL
);

-- v4: misollar korpusidagi ★ tanlovlar (belgi id’siga emas, fragmentga bog‘lanadi)
CREATE TABLE IF NOT EXISTS tanlangan_misollar (
    material_id INTEGER NOT NULL REFERENCES materiallar(id) ON DELETE CASCADE,
    kategoriya  TEXT NOT NULL,
    qism        TEXT NOT NULL,
    fragment    TEXT NOT NULL,
    yaratilgan  TEXT NOT NULL,
    PRIMARY KEY (material_id, kategoriya, qism, fragment)
);

CREATE INDEX IF NOT EXISTS idx_ekspert_tahlil_material ON ekspert_tahlillari(material_id);
CREATE INDEX IF NOT EXISTS idx_ekspert_belgi_tahlil ON ekspert_belgilari(ekspert_tahlil_id);
CREATE INDEX IF NOT EXISTS idx_materiallar_nashr ON materiallar(nashr_id);
CREATE INDEX IF NOT EXISTS idx_belgilar_material ON belgilar(material_id);
`;

export function hozir(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function bazaYoli(): string {
  const fromEnv = process.env.MEDIAPRAG_DB;
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(process.cwd(), "data", "mediaprag.db");
}

function ochish(): DatabaseSync {
  const file = bazaYoli();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);
  if (!db.prepare("SELECT 1 FROM sozlamalar WHERE kalit = 'metodika_versiya'").get()) {
    boshlangichMalumotlar(db);
  }
  return db;
}

function boshlangichMalumotlar(db: DatabaseSync): void {
  const mezon = db.prepare("INSERT INTO mezonlar (kod, nomi, vazn, tavsif) VALUES (?, ?, ?, ?)");
  for (const [kod, nomi, vazn, tavsif] of MEZONLAR) mezon.run(kod, nomi, vazn, tavsif);

  const kat = db.prepare(
    "INSERT INTO kategoriyalar (kod, nomi, guruh, mezon, jarima, tartib) VALUES (?, ?, ?, ?, ?, ?)",
  );
  KATEGORIYALAR.forEach(([kod, nomi, guruh, m, jarima], i) => kat.run(kod, nomi, guruh, m, jarima, i));

  const lug = db.prepare("INSERT INTO lugat (turkum, kod, nomi, qiymat, tartib) VALUES (?, ?, ?, ?, ?)");
  for (const [turkum, qatorlar] of Object.entries(LUGAT)) {
    qatorlar.forEach(([kod, nomi, qiymat], i) => lug.run(turkum, kod, nomi, qiymat, i));
  }

  const nashr = db.prepare("INSERT INTO nashrlar (nomi, turi) VALUES (?, ?)");
  for (const [nomi, turi] of NASHRLAR) nashr.run(nomi, turi);

  const sozlama = db.prepare("INSERT INTO sozlamalar (kalit, qiymat) VALUES (?, ?)");
  sozlama.run("metodika_versiya", "1");
  sozlama.run("shkala", JSON.stringify(SHKALA));

  const snapshot = {
    versiya: 1,
    vaznlar: Object.fromEntries(MEZONLAR.map(([kod, , vazn]) => [kod, vazn])),
    muvofiqlik: Object.fromEntries(LUGAT.muvofiqlik.map(([kod, , qiymat]) => [kod, qiymat])),
    kompozitsiya: Object.fromEntries(LUGAT.kompozitsiya.map(([kod, , qiymat]) => [kod, qiymat])),
    kategoriyalar: Object.fromEntries(
      KATEGORIYALAR.map(([kod, nomi, guruh, mezon, jarima], tartib) => [kod, { kod, nomi, guruh, mezon, jarima, tartib }]),
    ),
    shkala: SHKALA,
  };
  db.prepare("INSERT INTO metodika_tarixi (versiya, sana, izoh, snapshot) VALUES (?, ?, ?, ?)").run(
    1,
    hozir(),
    "Boshlang‘ich metodika (III bob)",
    JSON.stringify(snapshot),
  );
}

// Dev rejimida hot reload ulanishni takrorlamasligi uchun global keshlanadi
const globalForDb = globalThis as unknown as { mediapragDb?: DatabaseSync; avtoTekshiruv?: number };

/** Avtomatik zaxira ehtiyoji soatiga bir marta tekshiriladi (nusxa kuniga bittadan ko‘p olinmaydi). */
const AVTO_ORALIQ = 60 * 60 * 1000;

export function getDb(): DatabaseSync {
  if (!globalForDb.mediapragDb) globalForDb.mediapragDb = ochish();
  const db = globalForDb.mediapragDb;
  if (process.env.MEDIAPRAG_AVTO_ZAXIRA !== "0" && Date.now() - (globalForDb.avtoTekshiruv ?? 0) > AVTO_ORALIQ) {
    globalForDb.avtoTekshiruv = Date.now();
    // Joriy so‘rov tugagach: VACUUM INTO tranzaksiya ichida ishlamaydi, barcha so‘rovlar esa sinxron
    setTimeout(() => {
      try {
        avtoZaxira(db, bazaYoli());
      } catch (e) {
        console.error("Avtomatik zaxira olinmadi:", e);
      }
    }, 0);
  }
  return db;
}

type Row = Record<string, unknown>;

/**
 * node:sqlide qatorlarni prototipsiz obyekt sifatida qaytaradi — bunday obyektni
 * React server komponentidan mijoz komponentiga uzatib bo‘lmaydi, shuning uchun
 * har bir qator oddiy obyektga ko‘chiriladi.
 */
const oddiy = <T>(row: unknown): T => ({ ...(row as object) }) as T;

export function all<T = Row>(sql: string, params: unknown[] = []): T[] {
  return (getDb().prepare(sql).all(...(params as never[])) as unknown[]).map((r) => oddiy<T>(r));
}

export function one<T = Row>(sql: string, params: unknown[] = []): T | undefined {
  const row = getDb().prepare(sql).get(...(params as never[]));
  return row == null ? undefined : oddiy<T>(row);
}

export function run(sql: string, params: unknown[] = []) {
  return getDb().prepare(sql).run(...(params as never[]));
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const natija = fn();
    db.exec("COMMIT");
    return natija;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
