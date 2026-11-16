/**
 * Zaxira nusxalar: yaratish, ro‘yxat, yuklab olish, fayldan qo‘shish, tiklash, avtomatik nusxa.
 *
 * Nusxalar bazaning o‘zida (zaxiralar jadvali) saqlanadi — Vercel’da doimiy disk yo‘q.
 * Disk/xizmat buzilishidan himoya uchun nusxani yuklab olib, tashqarida saqlash kerak.
 *
 * Tiklash bitta tranzaksiyada: ma’lumot jadvallari tozalanadi va nusxadan to‘ldiriladi, identity
 * hisoblagichlari tiklanadi; foydalanuvchilar va sessiyalar o‘zgarmaydi (ekspert hisoblari ism bo‘yicha
 * qayta bog‘lanadi). Xato bo‘lsa — ROLLBACK, joriy baza o‘zgarmaydi.
 */
import { gunzipSync, gzipSync } from "node:zlib";

import { all, hozir, JADVALLAR, one, run, SXEMA_VERSIYASI, transaction, tiklashdanKeyinTozalash } from "./db.ts";
import { ApiError } from "./queries.ts";
import {
  SAQLANADI,
  zaxiraniTekshirish,
  zaxiraNomi,
  zaxiraStatistikasi,
  ZARUR_JADVALLAR,
  type Qator,
  type Statistika,
  type ZaxiraMalumoti,
  type ZaxiraTuri,
} from "./zaxiraFormat.ts";

export interface Zaxira {
  nom: string;
  tur: ZaxiraTuri;
  sana: string;
  hajm: number;
  statistika: Statistika | null;
}

export interface ZaxiraHolati {
  baza: string;
  hajm: number | null;
  statistika: Statistika;
  saqlanadi: Partial<Record<ZaxiraTuri, number>>;
  zaxiralar: Zaxira[];
}

/** Yuklanadigan fayl chegarasi */
export const MAX_HAJM = 100 * 1024 * 1024;

const IDENTITY_JADVALLAR = ["nashrlar", "materiallar", "belgilar", "ekspertlar", "ekspert_tahlillari", "ekspert_belgilari"];

// ------------------------------------------------------------------ olish va yozish

/** Joriy bazaning barcha ma’lumot jadvallari. */
export async function bazaniOlish(): Promise<ZaxiraMalumoti> {
  const jadvallar: Record<string, Qator[]> = {};
  await transaction(async () => {
    // Izchil holat: barcha jadvallar bitta tranzaksiyada o‘qiladi
    for (const j of JADVALLAR) jadvallar[j] = await all<Qator>(`SELECT * FROM ${j} ORDER BY 1, 2`);
  });
  return { format: "mediaprag-zaxira", versiya: 1, sxema: SXEMA_VERSIYASI, yaratilgan: hozir(), jadvallar };
}

export const siqish = (z: ZaxiraMalumoti) => gzipSync(Buffer.from(JSON.stringify(z), "utf8"));

/** Siqilgan JSON → nusxa (tekshiruv bilan). */
export function ochish(bayt: Uint8Array): ZaxiraMalumoti {
  let x: unknown;
  try {
    x = JSON.parse(gunzipSync(bayt).toString("utf8"));
  } catch {
    throw new ApiError(422, "x.zaxiraSqliteEmas");
  }
  return tekshiruvXatosi(zaxiraniTekshirish(x));
}

function tekshiruvXatosi(n: ReturnType<typeof zaxiraniTekshirish>): ZaxiraMalumoti {
  if ("zaxira" in n) return n.zaxira;
  if (n.xato === "jadval") throw new ApiError(422, "x.zaxiraJadvalYoq", { v: n.jadval });
  throw new ApiError(422, "x.zaxiraSqliteEmas");
}

async function ustunlar(jadval: string): Promise<Set<string>> {
  const r = await all<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?",
    [jadval],
  );
  return new Set(r.map((x) => x.column_name));
}

/** Joriy ma’lumotlarni nusxadagi bilan almashtiradi (chaqiruvchi tranzaksiya ichida bo‘lishi shart emas). */
export async function bazagaYozish(z: ZaxiraMalumoti): Promise<void> {
  await transaction(async () => {
    // Ekspert hisoblari: tiklashdan keyin ism bo‘yicha qayta bog‘lanadi
    const boglar = await all<{ id: number; ism: string }>(
      "SELECT f.id, e.ism FROM foydalanuvchilar f JOIN ekspertlar e ON e.id = f.ekspert_id",
    );
    for (const j of [...JADVALLAR].reverse()) await run(`DELETE FROM ${j}`);

    for (const j of JADVALLAR) {
      const qatorlar = z.jadvallar[j] ?? [];
      if (!qatorlar.length) continue;
      const bor = await ustunlar(j);
      const nomlar = [...new Set(qatorlar.flatMap((q) => Object.keys(q)))].filter((u) => bor.has(u));
      if (!nomlar.length) continue;
      // Bir so‘rovda ko‘p qator (parametrlar soni chegarasi ichida)
      const bolak = Math.max(1, Math.floor(4000 / nomlar.length));
      for (let i = 0; i < qatorlar.length; i += bolak) {
        const qism = qatorlar.slice(i, i + bolak);
        const qiymatlar = qism.map((q) => `(${nomlar.map(() => "?").join(", ")})`).join(", ");
        await run(
          `INSERT INTO ${j} (${nomlar.map((u) => `"${u}"`).join(", ")}) OVERRIDING SYSTEM VALUE VALUES ${qiymatlar}`,
          qism.flatMap((q) => nomlar.map((u) => (q[u] === undefined ? null : q[u]))),
        );
      }
    }
    for (const j of IDENTITY_JADVALLAR) {
      await one(
        `SELECT setval(pg_get_serial_sequence('${j}', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM ${j}), 0), 1),
                       (SELECT MAX(id) FROM ${j}) IS NOT NULL)`,
      );
    }
    await run(
      "INSERT INTO sozlamalar (kalit, qiymat) VALUES ('sxema_versiya', ?) ON CONFLICT (kalit) DO UPDATE SET qiymat = excluded.qiymat",
      [String(SXEMA_VERSIYASI)],
    );
    for (const b of boglar) {
      await run("UPDATE foydalanuvchilar SET ekspert_id = (SELECT id FROM ekspertlar WHERE ism = ?) WHERE id = ?", [b.ism, b.id]);
    }
    await tiklashdanKeyinTozalash();
  });
}

// ------------------------------------------------------------------ SQLite (eski format va demo baza)

const SQLITE_SARLAVHA = "SQLite format 3\0";

/** Eski versiyadagi SQLite bazasini (.db) nusxa formatiga o‘giradi. */
export async function sqlitedanOqish(bayt: Uint8Array): Promise<ZaxiraMalumoti> {
  if (Buffer.from(bayt.subarray(0, 16)).toString("latin1") !== SQLITE_SARLAVHA) throw new ApiError(422, "x.zaxiraSqliteEmas");
  const os = await import("node:os");
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { DatabaseSync } = await import("node:sqlite");
  const fayl = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mediaprag-")), "baza.db");
  fs.writeFileSync(fayl, bayt);
  let db: InstanceType<typeof DatabaseSync> | null = null;
  try {
    db = new DatabaseSync(fayl);
    db.exec("PRAGMA journal_mode = DELETE");
    const tekshiruv = db.prepare("PRAGMA quick_check").all() as { quick_check: string }[];
    if (tekshiruv.length !== 1 || tekshiruv[0].quick_check !== "ok") throw new ApiError(422, "x.zaxiraButunEmas");
    const bor = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name));
    const yoq = ZARUR_JADVALLAR.find((j) => !bor.has(j));
    if (yoq) throw new ApiError(422, "x.zaxiraJadvalYoq", { v: yoq });
    const jadvallar: Record<string, Qator[]> = {};
    for (const j of JADVALLAR) {
      if (bor.has(j)) jadvallar[j] = (db.prepare(`SELECT * FROM ${j}`).all() as Qator[]).map((q) => ({ ...q }));
    }
    return { format: "mediaprag-zaxira", versiya: 1, sxema: 1, yaratilgan: hozir(), jadvallar };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(422, "x.zaxiraButunEmas");
  } finally {
    db?.close();
    fs.rmSync(path.dirname(fayl), { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ nusxalar jadvali

async function saqlash(z: ZaxiraMalumoti, tur: ZaxiraTuri): Promise<string> {
  const vaqt = hozir();
  let nom = zaxiraNomi(vaqt, tur);
  for (let i = 2; await one("SELECT 1 FROM zaxiralar WHERE nom = ?", [nom]); i++) {
    nom = zaxiraNomi(vaqt, tur).replace(`_${tur}.json.gz`, `-${i}_${tur}.json.gz`);
  }
  const bayt = siqish(z);
  await run("INSERT INTO zaxiralar (nom, tur, yaratilgan, hajm, statistika, malumot) VALUES (?, ?, ?, ?, ?, ?)", [
    nom,
    tur,
    vaqt,
    bayt.length,
    JSON.stringify(zaxiraStatistikasi(z)),
    bayt,
  ]);
  const chegara = SAQLANADI[tur];
  if (chegara) {
    await run(
      `DELETE FROM zaxiralar WHERE tur = ? AND id NOT IN (
         SELECT id FROM zaxiralar WHERE tur = ? ORDER BY yaratilgan DESC, id DESC LIMIT ?)`,
      [tur, tur, chegara],
    );
  }
  return nom;
}

async function nusxaOlish(nom: string): Promise<{ malumot: Uint8Array }> {
  const r = await one<{ malumot: Uint8Array }>("SELECT malumot FROM zaxiralar WHERE nom = ?", [nom]);
  if (!r) throw new ApiError(404, "x.zaxiraTopilmadi");
  return r;
}

export async function joriyStatistika(): Promise<Statistika> {
  const son = async (sql: string) => (await one<{ n: number }>(sql))?.n ?? 0;
  const versiya = await one<{ qiymat: string }>("SELECT qiymat FROM sozlamalar WHERE kalit = 'metodika_versiya'");
  const oxirgi = await one<{ v: string | null }>(
    `SELECT MAX(v) AS v FROM (
       SELECT MAX(yangilangan) AS v FROM materiallar UNION ALL
       SELECT MAX(yangilangan) FROM tahlillar UNION ALL
       SELECT MAX(yangilangan) FROM ekspert_tahlillari) x`,
  );
  return {
    nashrlar: await son("SELECT COUNT(*) AS n FROM nashrlar"),
    materiallar: await son("SELECT COUNT(*) AS n FROM materiallar"),
    tahlillar: await son("SELECT COUNT(*) AS n FROM tahlillar WHERE lpsi IS NOT NULL"),
    belgilar: await son("SELECT COUNT(*) AS n FROM belgilar"),
    ekspertlar: await son("SELECT COUNT(*) AS n FROM ekspertlar"),
    ekspert_tahlillari: await son("SELECT COUNT(*) AS n FROM ekspert_tahlillari"),
    metodika_versiya: versiya ? Number(versiya.qiymat) : null,
    oxirgi_ozgarish: oxirgi?.v ?? null,
  };
}

export async function zaxiraHolati(): Promise<ZaxiraHolati> {
  const qatorlar = await all<{ nom: string; tur: ZaxiraTuri; yaratilgan: string; hajm: number; statistika: string }>(
    "SELECT nom, tur, yaratilgan, hajm, statistika FROM zaxiralar ORDER BY yaratilgan DESC, id DESC",
  );
  let hajm: number | null = null;
  try {
    hajm = (await one<{ n: number }>("SELECT pg_database_size(current_database()) AS n"))?.n ?? null;
  } catch {
    hajm = null;
  }
  return {
    baza: process.env.DATABASE_URL ? "PostgreSQL" : "PGlite",
    hajm,
    statistika: await joriyStatistika(),
    saqlanadi: SAQLANADI,
    zaxiralar: qatorlar.map((q) => {
      let statistika: Statistika | null = null;
      try {
        statistika = JSON.parse(q.statistika);
      } catch {
        statistika = null;
      }
      return { nom: q.nom, tur: q.tur, sana: q.yaratilgan, hajm: q.hajm, statistika };
    }),
  };
}

export async function zaxiraYaratish(): Promise<{ nom: string }> {
  return { nom: await saqlash(await bazaniOlish(), "qolda") };
}

/** Yuklab olish uchun: siqilgan JSON fayl. */
export async function zaxiraFayli(nom: string): Promise<Uint8Array> {
  return new Uint8Array((await nusxaOlish(nom)).malumot);
}

/** Kompyuterdan tanlangan fayl (.json.gz yoki eski SQLite .db) — tekshirilib, ro‘yxatga qo‘shiladi; bazaga hali tegmaydi. */
export async function zaxiraniYuklash(fayl: File | null): Promise<{ nom: string; statistika: Statistika }> {
  if (!fayl || typeof fayl.arrayBuffer !== "function" || fayl.size === 0) throw new ApiError(422, "x.zaxiraFaylYoq");
  if (fayl.size > MAX_HAJM) throw new ApiError(413, "x.zaxiraKatta", { v: Math.round(MAX_HAJM / 1024 / 1024) });
  const bayt = new Uint8Array(await fayl.arrayBuffer());
  const gzip = bayt[0] === 0x1f && bayt[1] === 0x8b;
  const z = gzip ? ochish(bayt) : await sqlitedanOqish(bayt);
  const nom = await saqlash(z, "yuklangan");
  return { nom, statistika: zaxiraStatistikasi(z) };
}

/** Bazani tanlangan nusxadan tiklaydi; oldin joriy holatdan «tiklashdan oldin» nusxasi olinadi. */
export async function tiklash(nom: string): Promise<{ oldingi: string; statistika: Statistika }> {
  const z = ochish((await nusxaOlish(nom)).malumot);
  const oldingi = await saqlash(await bazaniOlish(), "tiklashdan_oldin");
  try {
    await bazagaYozish(z);
  } catch (e) {
    console.error("tiklash:", e);
    throw new ApiError(500, "x.tiklashXato");
  }
  return { oldingi, statistika: await joriyStatistika() };
}

export async function zaxiraniOchirish(nom: string) {
  const r = await run("DELETE FROM zaxiralar WHERE nom = ?", [nom]);
  if (!r.changes) throw new ApiError(404, "x.zaxiraTopilmadi");
  return { ok: true };
}

/** Bugun avtomatik nusxa olinmagan bo‘lsa — oladi (bo‘sh bazadan emas). */
export async function avtoZaxira(): Promise<string | null> {
  const bugun = hozir().slice(0, 10);
  if (await one("SELECT 1 FROM zaxiralar WHERE tur = 'avto' AND yaratilgan >= ?", [bugun])) return null;
  if (!(await one("SELECT 1 FROM materiallar LIMIT 1"))) return null;
  return saqlash(await bazaniOlish(), "avto");
}
