// Zaxira nusxalar testlari (VACUUM INTO, avtomatik nusxa, tekshiruv, tiklash): npm test
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, describe, it } from "node:test";

import {
  avtoZaxira,
  bazagaKochirish,
  bazaStatistikasi,
  eskilarniOchirish,
  faylniTekshirish,
  nomniOqish,
  nusxaYaratish,
  papka,
  vaqtBelgisi,
  yangiNom,
  zaxiraFayllari,
} from "../lib/zaxiraFayl.ts";

const ILDIZ = fs.mkdtempSync(path.join(os.tmpdir(), "mp-zaxira-test-"));
after(() => {
  try {
    fs.rmSync(ILDIZ, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // Windows ochiq faylni o‘chirmaydi (test yiqilganda) — vaqtinchalik papka keyin tozalanadi
  }
});

/** Platforma sxemasining tashqi kalitli qismi (testlar db.ts’ni yuklamaydi). */
const SXEMA = `
CREATE TABLE nashrlar (id INTEGER PRIMARY KEY AUTOINCREMENT, nomi TEXT NOT NULL UNIQUE, turi TEXT NOT NULL);
CREATE TABLE materiallar (id INTEGER PRIMARY KEY AUTOINCREMENT, nashr_id INTEGER NOT NULL REFERENCES nashrlar(id),
  sarlavha TEXT NOT NULL, yaratilgan TEXT NOT NULL, yangilangan TEXT NOT NULL);
CREATE TABLE tahlillar (material_id INTEGER PRIMARY KEY REFERENCES materiallar(id) ON DELETE CASCADE, lpsi REAL, yangilangan TEXT NOT NULL);
CREATE TABLE kategoriyalar (kod TEXT PRIMARY KEY, nomi TEXT NOT NULL);
CREATE TABLE belgilar (id INTEGER PRIMARY KEY AUTOINCREMENT, material_id INTEGER NOT NULL REFERENCES materiallar(id) ON DELETE CASCADE,
  kategoriya TEXT NOT NULL REFERENCES kategoriyalar(kod), fragment TEXT);
CREATE TABLE lugat (turkum TEXT, kod TEXT, nomi TEXT, PRIMARY KEY (turkum, kod));
CREATE TABLE mezonlar (kod TEXT PRIMARY KEY, vazn REAL);
CREATE TABLE sozlamalar (kalit TEXT PRIMARY KEY, qiymat TEXT NOT NULL);
CREATE TABLE metodika_tarixi (versiya INTEGER PRIMARY KEY, sana TEXT NOT NULL);
CREATE TABLE ekspertlar (id INTEGER PRIMARY KEY AUTOINCREMENT, ism TEXT NOT NULL);
CREATE TABLE ekspert_tahlillari (id INTEGER PRIMARY KEY AUTOINCREMENT, material_id INTEGER NOT NULL REFERENCES materiallar(id),
  ekspert_id INTEGER NOT NULL REFERENCES ekspertlar(id), yangilangan TEXT NOT NULL);
`;

let raqam = 0;
/** Yangi papkada WAL rejimidagi to‘ldirilgan baza (platformadagidek). */
function yangiBaza(materiallar = 3): { db: DatabaseSync; yol: string } {
  const dir = path.join(ILDIZ, `b${++raqam}`);
  fs.mkdirSync(dir);
  const yol = path.join(dir, "mediaprag.db");
  const db = new DatabaseSync(yol);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec(SXEMA);
  db.exec(`INSERT INTO nashrlar (nomi, turi) VALUES ('Kun.uz', 'raqamli'), ('Adolat', 'bosma');
           INSERT INTO kategoriyalar VALUES ('abstrakt', 'Abstrakt jumla');
           INSERT INTO sozlamalar VALUES ('metodika_versiya', '2');
           INSERT INTO metodika_tarixi VALUES (1, '2025-01-01'), (2, '2025-02-01');
           INSERT INTO ekspertlar (ism) VALUES ('A');`);
  for (let i = 1; i <= materiallar; i++) {
    db.prepare("INSERT INTO materiallar (nashr_id, sarlavha, yaratilgan, yangilangan) VALUES (1, ?, '2025-03-01', ?)").run(
      `Sarlavha ${i}`,
      `2025-03-0${i}T10:00:00`,
    );
    db.prepare("INSERT INTO tahlillar VALUES (?, ?, '2025-03-05T12:00:00')").run(i, i === 1 ? null : 70 + i);
    db.prepare("INSERT INTO belgilar (material_id, kategoriya, fragment) VALUES (?, 'abstrakt', 'f')").run(i);
  }
  return { db, yol };
}

describe("Zaxira fayl nomlari", () => {
  it("nom: baza, sana va tur; begona fayllar e’tiborsiz", () => {
    assert.deepEqual(nomniOqish("mediaprag_2026-11-06_14-30-05_qolda.db"), {
      baza: "mediaprag",
      sana: "2026-11-06T14:30:05",
      tur: "qolda",
    });
    assert.equal(nomniOqish("demo_2026-11-06_14-30-05-2_tiklashdan_oldin.db")?.tur, "tiklashdan_oldin");
    assert.equal(nomniOqish("mediaprag.db"), null);
    assert.equal(nomniOqish("../mediaprag_2026-11-06_14-30-05_qolda.db.exe"), null);
    assert.equal(vaqtBelgisi(new Date(2026, 0, 2, 3, 4, 5)), "2026-01-02_03-04-05");
  });

  it("bir soniyada ikkinchi nusxa — boshqa nom; demo bazasi zaxiralari aralashmaydi", () => {
    const { db, yol } = yangiBaza();
    const d = new Date(2026, 10, 6, 9, 0, 0);
    const a = nusxaYaratish(db, yol, "qolda", d);
    const b = nusxaYaratish(db, yol, "qolda", d);
    assert.notEqual(a, b);
    assert.equal(b, "mediaprag_2026-11-06_09-00-00-2_qolda.db");
    fs.copyFileSync(path.join(papka(yol), a), path.join(papka(yol), "demo_2026-11-06_09-00-00_qolda.db"));
    assert.deepEqual(zaxiraFayllari(yol).map((z) => z.nom).sort(), [a, b].sort());
    assert.equal(yangiNom(yol, "avto", d), "mediaprag_2026-11-06_09-00-00_avto.db");
    db.close();
  });
});

describe("Nusxa yaratish", () => {
  it("VACUUM INTO: WAL’dagi so‘nggi yozuvlar ham kiradi, nusxa bitta fayl (oddiy jurnal rejimi)", () => {
    const { db, yol } = yangiBaza();
    db.exec("INSERT INTO materiallar (nashr_id, sarlavha, yaratilgan, yangilangan) VALUES (2, 'Yangi', 'x', '2025-04-01T08:00:00')");
    const nom = nusxaYaratish(db, yol, "qolda");
    const fayl = path.join(papka(yol), nom);
    const sarlavha = fs.readFileSync(fayl).subarray(0, 20);
    assert.equal(sarlavha.subarray(0, 16).toString("latin1"), "SQLite format 3\0");
    assert.deepEqual([sarlavha[18], sarlavha[19]], [1, 1], "WAL emas");
    assert.ok(!fs.existsSync(`${fayl}-wal`));
    const nusxa = new DatabaseSync(fayl, { readOnly: true });
    assert.deepEqual(bazaStatistikasi(nusxa), bazaStatistikasi(db));
    assert.deepEqual(bazaStatistikasi(nusxa), {
      nashrlar: 2,
      materiallar: 4,
      tahlillar: 2,
      belgilar: 3,
      ekspertlar: 1,
      ekspert_tahlillari: 0,
      metodika_versiya: 2,
      oxirgi_ozgarish: "2025-04-01T08:00:00",
    });
    nusxa.close();
    db.close();
  });

  it("avtomatik nusxalar: oxirgi 14 tasi qoladi, qo‘lda olinganlar o‘chirilmaydi", () => {
    const { db, yol } = yangiBaza();
    nusxaYaratish(db, yol, "qolda", new Date(2026, 0, 1));
    for (let kun = 1; kun <= 16; kun++) nusxaYaratish(db, yol, "avto", new Date(2026, 1, kun, 9));
    const fayllar = zaxiraFayllari(yol);
    assert.equal(fayllar.filter((z) => z.tur === "avto").length, 14);
    assert.equal(fayllar.filter((z) => z.tur === "qolda").length, 1);
    assert.equal(fayllar.at(-2)?.sana.slice(0, 10), "2026-02-03", "eng eskilari o‘chirilgan");
    eskilarniOchirish(yol, "avto", 2);
    assert.equal(zaxiraFayllari(yol).length, 3);
    db.close();
  });

  it("avtomatik nusxa kuniga bitta; bo‘sh bazadan va tranzaksiya ichida olinmaydi", () => {
    const { db, yol } = yangiBaza();
    const d = new Date(2026, 10, 6, 9);
    assert.ok(avtoZaxira(db, yol, d));
    assert.equal(avtoZaxira(db, yol, new Date(2026, 10, 6, 18)), null);
    assert.ok(avtoZaxira(db, yol, new Date(2026, 10, 7, 9)));
    db.exec("BEGIN");
    assert.equal(avtoZaxira(db, yol, new Date(2026, 10, 8, 9)), null);
    db.exec("ROLLBACK");
    const bosh = yangiBaza(0);
    assert.equal(avtoZaxira(bosh.db, bosh.yol, d), null);
    db.close();
    bosh.db.close();
  });
});

describe("Faylni tekshirish", () => {
  it("SQLite emas, MediaPrag emas, shikastlangan va to‘g‘ri fayl", () => {
    const dir = path.join(ILDIZ, "tekshiruv");
    fs.mkdirSync(dir);
    const matn = path.join(dir, "matn.db");
    fs.writeFileSync(matn, "bu baza emas");
    assert.deepEqual(faylniTekshirish(matn), { xato: "sqlite" });
    assert.deepEqual(faylniTekshirish(path.join(dir, "yoq.db")), { xato: "sqlite" });

    const begona = path.join(dir, "begona.db");
    const b = new DatabaseSync(begona);
    b.exec("CREATE TABLE nashrlar (id INTEGER)");
    b.close();
    assert.deepEqual(faylniTekshirish(begona), { xato: "jadval", jadval: "materiallar" });

    const { db, yol } = yangiBaza(30);
    const togri = path.join(papka(yol), nusxaYaratish(db, yol, "qolda"));
    const n = faylniTekshirish(togri);
    assert.ok("statistika" in n && n.statistika.materiallar === 30);

    // 2-sahifadan boshlab shikastlash (sarlavha butun qoladi)
    const buzuq = path.join(dir, "buzuq.db");
    const bayt = fs.readFileSync(togri);
    const sahifa = bayt.readUInt16BE(16);
    bayt.fill(0xab, sahifa, sahifa * 3);
    fs.writeFileSync(buzuq, bayt);
    assert.deepEqual(faylniTekshirish(buzuq), { xato: "butun" });
    db.close();
  });

  it("WAL rejimidagi yuklangan fayl oddiy rejimga o‘tkaziladi", () => {
    const { db, yol } = yangiBaza();
    db.close(); // yopilganda WAL bazaga yoziladi, sarlavhada esa WAL rejimi qoladi
    assert.equal(fs.readFileSync(yol)[18], 2);
    assert.ok("statistika" in faylniTekshirish(yol));
    assert.equal(fs.readFileSync(yol)[18], 1);
  });
});

describe("Tiklash", () => {
  it("barcha jadvallar nusxadagidek; nusxada yo‘q yangi jadval bo‘shaydi; AUTOINCREMENT hisoblagichi ham", () => {
    const { db, yol } = yangiBaza(5);
    const fayl = path.join(papka(yol), nusxaYaratish(db, yol, "qolda"));
    const nusxada = bazaStatistikasi(db);
    const seq = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'materiallar'").get();

    // Nusxadan keyingi ishlar: o‘chirish, qo‘shish va yangi versiyadagi jadval
    db.exec("DELETE FROM materiallar WHERE id > 3");
    for (let i = 0; i < 4; i++) {
      db.exec("INSERT INTO materiallar (nashr_id, sarlavha, yaratilgan, yangilangan) VALUES (2, 'keyin', 'x', '2026-01-01T00:00:00')");
    }
    db.exec("CREATE TABLE tanlangan_misollar (material_id INTEGER REFERENCES materiallar(id), fragment TEXT)");
    db.exec("INSERT INTO tanlangan_misollar VALUES (1, 'f')");
    assert.notDeepEqual(bazaStatistikasi(db), nusxada);

    bazagaKochirish(db, fayl);
    assert.deepEqual(bazaStatistikasi(db), nusxada);
    assert.deepEqual(db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'materiallar'").get(), seq);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM tanlangan_misollar").get() as { n: number }).n, 0);
    assert.equal((db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys, 1);
    assert.deepEqual(db.prepare("PRAGMA database_list").all().map((r) => (r as { name: string }).name), ["main"]);
    db.close();
  });

  it("tashqi kalitlari buzilgan nusxa — xato va joriy baza o‘zgarmaydi", () => {
    const { db, yol } = yangiBaza(4);
    const fayl = path.join(papka(yol), nusxaYaratish(db, yol, "qolda"));
    // node:sqlite tashqi kalitlarni sukut bo‘yicha yoqadi — «yetim» yozuvni ataylab qo‘yish uchun o‘chiriladi
    const buzuq = new DatabaseSync(fayl, { enableForeignKeyConstraints: false });
    buzuq.exec("INSERT INTO belgilar (material_id, kategoriya, fragment) VALUES (999, 'abstrakt', 'yetim')");
    buzuq.close();
    db.exec("INSERT INTO materiallar (nashr_id, sarlavha, yaratilgan, yangilangan) VALUES (1, 'joriy', 'x', 'y')");
    const oldin = bazaStatistikasi(db);

    assert.throws(() => bazagaKochirish(db, fayl), /foreign_key_check/);
    assert.deepEqual(bazaStatistikasi(db), oldin);
    assert.equal(db.isTransaction, false);
    assert.equal((db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys, 1);
    assert.deepEqual(db.prepare("PRAGMA database_list").all().map((r) => (r as { name: string }).name), ["main"]);
    db.close();
  });
});
