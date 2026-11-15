// Eski SQLite bazasini (.db) joriy PostgreSQL bazasiga ko‘chirish — BAZADAGI MA’LUMOTLAR ALMASHTIRILADI.
//
//   node scripts/sqlite-import.mts data/demo.db
//
// Qaysi bazaga: DATABASE_URL (masalan, Supabase) yoki MEDIAPRAG_DB (PGlite papkasi; standart — data/pglite).
// Foydalanuvchi hisoblari o‘zgarmaydi. Oldin joriy holatdan «tiklashdan oldin» nusxasi olinadi.
import fs from "node:fs";

const fayl = process.argv[2];
if (!fayl || !fs.existsSync(fayl)) {
  console.error("Foydalanish: node scripts/sqlite-import.mts <fayl.db>");
  process.exit(1);
}
const { bazaManzili, bazaniYopish } = await import("../lib/db.ts");
const zaxira = await import("../lib/zaxira.ts");

const m = bazaManzili();
console.log("Manba:  ", fayl);
console.log("Baza:   ", m.tur === "postgres" ? "PostgreSQL (DATABASE_URL)" : `PGlite — ${m.joy}`);

// WAL rejimidagi bazada so‘nggi o‘zgarishlar «-wal» faylida: nusxasi vaqtinchalik papkada ochilib,
// bitta faylga yig‘iladi (asl fayllarga tegilmaydi)
const os = await import("node:os");
const path = await import("node:path");
const { DatabaseSync } = await import("node:sqlite");
const vaqtincha = fs.mkdtempSync(path.join(os.tmpdir(), "mediaprag-import-"));
const nusxa = path.join(vaqtincha, "baza.db");
fs.copyFileSync(fayl, nusxa);
for (const q of ["-wal", "-shm"]) if (fs.existsSync(fayl + q)) fs.copyFileSync(fayl + q, nusxa + q);
const yigilgan = path.join(vaqtincha, "yigilgan.db");
const s = new DatabaseSync(nusxa);
s.prepare("VACUUM INTO ?").run(yigilgan);
s.close();
const z = await zaxira.sqlitedanOqish(new Uint8Array(fs.readFileSync(yigilgan)));
fs.rmSync(vaqtincha, { recursive: true, force: true });
const { nom } = await zaxira.zaxiraYaratish();
await zaxira.bazagaYozish(z);
const st = await zaxira.joriyStatistika();
console.log(`Oldingi holat nusxasi: ${nom}`);
console.log(`Ko‘chirildi: ${st.nashrlar} nashr, ${st.materiallar} material, ${st.tahlillar} to‘liq tahlil, ${st.belgilar} belgi, ${st.ekspertlar} ekspert`);
await bazaniYopish();
