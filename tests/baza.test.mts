// PostgreSQL (PGlite, xotirada) bilan integratsion test: yozish, o‘qish, eksport, zaxira. npm test
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";

process.env.MEDIAPRAG_DB = "memory://";

const db = await import("../lib/db.ts");
const q = await import("../lib/queries.ts");
const ekspert = await import("../lib/ekspert.ts");
const { dashboard } = await import("../lib/analytics.ts");
const { analitika } = await import("../lib/analitika.ts");
const { misollarKorpusi, misolniTanlash } = await import("../lib/misollarBaza.ts");
const { nashrHisoboti } = await import("../lib/nashrHisoboti.ts");
const { umumiyKelishuv, materialKelishuvi } = await import("../lib/kelishuv.ts");
const excel = await import("../lib/excel.ts");
const { tahlilKartasiPdf } = await import("../lib/pdf.ts");
const { nashrHisobotiPdf } = await import("../lib/pdfNashr.ts");
const zaxira = await import("../lib/zaxira.ts");
const { davrTaqqoslash } = await import("../lib/davrlar.ts");

const BELGILAR = [
  { kategoriya: "abstrakt_jumla", qism: "matn", fragment: "Birinchi jumla umumiy gap.", izoh: null },
  { kategoriya: "uslubiy_xatolik", qism: "sarlavha", fragment: "Sarlavha", izoh: "uslub" },
  { kategoriya: "murojaat", qism: "lid", fragment: "Hurmatli o‘quvchi", izoh: null },
];
const TAHLIL = {
  sarlavha_turlari: ["axborotiy", "savol"],
  kompozitsiya: "ketma_ket",
  sar_lid: "mos",
  lid_matn: "qisman",
  sar_matn: "mos",
  auditoriya: 4,
  izoh: "test",
};

let materiallar: number[] = [];
let ekspertId = 0;

before(async () => {
  // 6 ta boshlang‘ich nashr bor; ikkitasiga 8 tadan material
  const nashrlar = await q.nashrlarRoyxati();
  assert.equal(nashrlar.length, 6);
  for (let i = 0; i < 16; i++) {
    const nashr = nashrlar[i % 2 === 0 ? 0 : 3];
    const { id } = await q.materialQoshish({
      nashr_id: nashr.id,
      sana: `202${4 + (i % 2)}-0${1 + (i % 9)}-15`,
      janr: i % 3 ? "xabar" : "maqola",
      sarlavha: `Sarlavha ${i} — sinov`,
      lid: "Hurmatli o‘quvchi, bu lid.",
      matn: "Birinchi jumla umumiy gap. Ikkinchi jumla aniq.",
    });
    materiallar.push(id);
    if (i < 14) {
      await q.tahlilSaqlash(id, { ...TAHLIL, auditoriya: 1 + (i % 5), belgilar: i % 4 ? BELGILAR : BELGILAR.slice(0, 1) } as never);
    }
  }
  ekspertId = (await ekspert.ekspertQoshish({ ism: "Ekspert A" })).id;
  await ekspert.ekspertQoshish({ ism: "Ekspert B" });
  for (const id of materiallar.slice(0, 6)) {
    await ekspert.ekspertTahlilSaqlash(id, ekspertId, { ...TAHLIL, belgilar: BELGILAR } as never);
  }
  await ekspert.ekspertVazniSaqlash(ekspertId, { vaznlar: { K1: 30, K2: 25, K3: 15, K4: 15, K5: 15 } });
});

after(() => db.bazaniYopish());

describe("PostgreSQL: yozish va o‘qish", () => {
  it("materiallar, tahlil va belgilar; qidiruv katta-kichik harfga sezgir emas", async () => {
    const r = await q.materiallarRoyxati({ q: "SINOV" });
    assert.equal(r.length, 16);
    assert.equal(typeof r[0].id, "number");
    assert.ok(r.every((m) => typeof m.tahlil_bor === "boolean"));
    const t = await q.tahlilOlish(materiallar[1]);
    assert.equal(t.belgilar.length, 3);
    assert.ok(t.natija && t.natija.lpsi != null);
    assert.deepEqual(t.tahlil?.sarlavha_turlari, ["axborotiy", "savol"]);
    assert.equal((await q.materiallarRoyxati({ holat: "tahlil_qilinmagan" })).length, 2);
  });

  it("dashboard va analitika: sonlar raqam turida, to‘liq tahlillar soni to‘g‘ri", async () => {
    const d = await dashboard();
    assert.equal(d.jami, 16);
    assert.equal(d.tahlil_qilingan, 14);
    assert.equal(typeof d.nashrlar_soni, "number");
    assert.ok(d.muammolar.length > 0 && d.muammolar.every((m) => typeof m.birliklar === "number"));
    const a = await analitika({});
    assert.equal(a.tahlil_qilingan, 14);
    assert.equal(a.materiallar.length, 14);
    assert.ok(a.kesimlar.nashr.length === 2);
    assert.equal(a.ahamiyat.yil.guruhlar.length, 2);
    const d2 = davrTaqqoslash(a.materiallar, { dan: "2024-01-01", gacha: "2024-12-31" }, { dan: "2025-01-01", gacha: "2025-12-31" }, a.muammolar);
    assert.equal(d2.a.n + d2.b.n, 14);
  });

  it("misollar korpusi, ★ tanlov va nashr hisoboti", async () => {
    const k = await misollarKorpusi();
    assert.ok(k.misollar.length >= 14);
    const m = k.misollar.find((x) => x.kategoriya === "abstrakt_jumla")!;
    assert.ok(m.kontekst, "fragment matnda topiladi");
    await misolniTanlash({ material_id: m.material_id, kategoriya: m.kategoriya, qism: m.qism, fragment: m.fragment, tanlangan: true });
    assert.ok((await misollarKorpusi()).misollar.some((x) => x.tanlangan));
    const h = await nashrHisoboti((await q.nashrlarRoyxati())[0].id);
    assert.ok(h.soni.toliq > 0 && h.korsatkichlar.length === 6);
  });

  it("ekspertlar: kelishuv va vaznlar", async () => {
    const u = await umumiyKelishuv(true);
    assert.ok(u.qatorlar.length > 0);
    const mk = await materialKelishuvi(materiallar[0], true);
    assert.ok(mk.baholovchilar.length >= 2);
    const v = await ekspert.vaznTahlili();
    assert.equal(v.vaznlar.length, 1);
  });

  it("metodika o‘zgarsa barcha tahlillar qayta hisoblanadi", async () => {
    const met = await q.metodikaTolik();
    const vaznlar = Object.fromEntries(met.mezonlar.map((m) => [m.kod, m.kod === "K1" ? 40 : m.kod === "K2" ? 10 : m.vazn]));
    const r = await q.metodikaSaqlash({
      vaznlar,
      muvofiqlik: Object.fromEntries(met.lugat.muvofiqlik.map((x) => [x.kod, x.qiymat])),
      kompozitsiya: Object.fromEntries(met.lugat.kompozitsiya.map((x) => [x.kod, x.qiymat])),
      kategoriyalar: Object.fromEntries(met.kategoriyalar.map((k) => [k.kod, { mezon: k.mezon, jarima: k.jarima }])),
      shkala: met.shkala,
      izoh: "sinov",
    } as never);
    assert.equal(r.versiya, 2);
    assert.equal(r.qayta_hisoblangan, 20, "14 ta asosiy tahlil va 6 ta ekspert tahlili");
    assert.equal((await q.metodikaTarixi()).length, 2);
  });
});

describe("Eksport", () => {
  it("Excel hisobot, misollar va davrlar", async () => {
    const h = await excel.excelHisobot("ru");
    assert.ok(h.buf.length > 5000);
    const k = await misollarKorpusi();
    assert.ok((await excel.misollarExcel("uz", k.misollar)).buf.length > 1000);
    const a = await analitika({});
    const d = davrTaqqoslash(a.materiallar, { dan: "2024-01-01", gacha: "2024-12-31" }, { dan: "2025-01-01", gacha: "2025-12-31" }, a.muammolar);
    assert.ok((await excel.davrlarExcel("en", d, null)).buf.length > 1000);
  });

  it("PDF: tahlil kartasi va nashr hisoboti", async () => {
    const p = await tahlilKartasiPdf(materiallar[1], "ru");
    assert.equal(p.subarray(0, 5).toString("latin1"), "%PDF-");
    const n = await nashrHisobotiPdf((await q.nashrlarRoyxati())[0].id, {}, "uz");
    assert.equal(n.pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  });
});

describe("Zaxira (PostgreSQL)", () => {
  it("nusxa → o‘zgarish → tiklash: ma’lumotlar va id hisoblagichlari qaytadi, foydalanuvchilar tegmaydi", async () => {
    await db.run(
      "INSERT INTO foydalanuvchilar (email, ism, rol, parol_hash, ekspert_id, yaratilgan) VALUES ('e@x.uz', 'E', 'ekspert', 'x', ?, ?)",
      [ekspertId, db.hozir()],
    );
    const oldin = await zaxira.joriyStatistika();
    const { nom } = await zaxira.zaxiraYaratish();
    await q.materialOchirish(materiallar[0]);
    await q.materialOchirish(materiallar[1]);
    assert.equal((await zaxira.joriyStatistika()).materiallar, oldin.materiallar - 2);

    const t = await zaxira.tiklash(nom);
    assert.deepEqual(t.statistika, oldin);
    // id hisoblagichi: yangi material eski id’lar bilan to‘qnashmaydi
    const { id } = await q.materialQoshish({ nashr_id: (await q.nashrlarRoyxati())[0].id, sarlavha: "Yangi" });
    assert.ok(id > Math.max(...materiallar));
    // ekspert hisobi ism bo‘yicha qayta bog‘langan
    const f = await db.one<{ ekspert_id: number }>("SELECT ekspert_id FROM foydalanuvchilar WHERE email = 'e@x.uz'");
    assert.equal(f?.ekspert_id, ekspertId);
    const h = await zaxira.zaxiraHolati();
    assert.deepEqual(h.zaxiralar.map((z) => z.tur).sort(), ["qolda", "tiklashdan_oldin"]);
  });

  it("fayldan: siqilgan JSON va eski SQLite bazasi; noto‘g‘ri fayl rad etiladi", async () => {
    const json = await zaxira.zaxiraFayli((await zaxira.zaxiraYaratish()).nom);
    const r1 = await zaxira.zaxiraniYuklash(new File([new Uint8Array(json)], "nusxa.json.gz"));
    assert.equal(r1.statistika.materiallar, (await zaxira.joriyStatistika()).materiallar);

    // eski SQLite: zarur jadvallar bilan kichik baza
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const fayl = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mp-test-")), "eski.db");
    const s = new DatabaseSync(fayl);
    s.exec(`CREATE TABLE nashrlar (id INTEGER PRIMARY KEY, nomi TEXT, turi TEXT);
            CREATE TABLE materiallar (id INTEGER PRIMARY KEY, nashr_id INTEGER, sarlavha TEXT, yaratilgan TEXT, yangilangan TEXT);
            CREATE TABLE tahlillar (material_id INTEGER PRIMARY KEY, lpsi REAL, yangilangan TEXT);
            CREATE TABLE belgilar (id INTEGER PRIMARY KEY, material_id INTEGER, kategoriya TEXT, qism TEXT);
            CREATE TABLE kategoriyalar (kod TEXT PRIMARY KEY, nomi TEXT, guruh TEXT, jarima REAL, tartib INTEGER);
            CREATE TABLE lugat (turkum TEXT, kod TEXT, nomi TEXT, qiymat REAL, tartib INTEGER);
            CREATE TABLE mezonlar (kod TEXT PRIMARY KEY, nomi TEXT, vazn REAL);
            CREATE TABLE sozlamalar (kalit TEXT PRIMARY KEY, qiymat TEXT);
            CREATE TABLE metodika_tarixi (versiya INTEGER PRIMARY KEY, sana TEXT, snapshot TEXT);
            INSERT INTO nashrlar VALUES (1, 'Eski nashr', 'bosma');
            INSERT INTO materiallar VALUES (7, 1, 'Eski material', '2025-01-01', '2025-01-01');
            INSERT INTO sozlamalar VALUES ('metodika_versiya', '3');`);
    s.close();
    const r2 = await zaxira.zaxiraniYuklash(new File([fs.readFileSync(fayl)], "eski.db"));
    assert.deepEqual([r2.statistika.nashrlar, r2.statistika.materiallar, r2.statistika.metodika_versiya], [1, 1, 3]);
    fs.rmSync(path.dirname(fayl), { recursive: true, force: true });

    await assert.rejects(() => zaxira.zaxiraniYuklash(new File([new TextEncoder().encode("salom")], "x.db")), /zaxiraSqliteEmas/);
  });

  it("avtomatik nusxa kuniga bitta", async () => {
    assert.ok(await zaxira.avtoZaxira());
    assert.equal(await zaxira.avtoZaxira(), null);
  });
});
