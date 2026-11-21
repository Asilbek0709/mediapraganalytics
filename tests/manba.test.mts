// ТЗ v2, 2-bosqich: havoladan ajratish, takrorlar, tekshiruv belgisi, statistikadan chiqarish, arxiv. npm test
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { after, describe, it } from "node:test";

process.env.MEDIAPRAG_DB = "memory://";
delete process.env.DATABASE_URL;
delete process.env.MEDIAPRAG_NAMOYISH;

const { havolaKaliti, heshUchunMatn, statistikagaKiradimi } = await import("../lib/manba.ts");
const { ajratish, oyNomliSana, sananiOqish, qoidaTanlash } = await import("../lib/ajratish.ts");
const { ichkiManzilmi } = await import("../lib/sahifaYuklash.ts");
const { qatorlarniBirlashtir, formagaBolish } = await import("../lib/faylMatni.ts");
const db = await import("../lib/db.ts");
const q = await import("../lib/queries.ts");
const { dashboard } = await import("../lib/analytics.ts");
const imp = await import("../lib/importlash.ts");
const zaxira = await import("../lib/zaxira.ts");

after(() => db.bazaniYopish());

const UZUN = "Bu asosiy matnning birinchi xatboshisi bo‘lib, unda voqea haqida batafsil ma’lumot beriladi va tafsilotlar keltiriladi.";

// Sayt tuzilishini takrorlovchi sun’iy namunalar (haqiqiy maqolalar repozitoriyga qo‘yilmaydi)
const KUN = `<!doctype html><html><head>
<meta property="og:title" content="Sinov sarlavhasi — Kun.uz"/>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsArticle","headline":"Sinov sarlavhasi","description":"Bu lid matni.","datePublished":"2026-11-15T22:46:29+05:00","articleSection":"Jahon"}</script>
</head><body><header><h1 class="text-xl">Sinov sarlavhasi</h1><p class="text-ink font-serif font-bold">Bu lid matni.</p>
<figure><figcaption>Foto: Muallif</figcaption></figure></header>
<div class="article-body richbox"><div class="container"><p><span>${UZUN}</span></p>
<div id="adfox_1"><p>Reklama</p></div><p>Ikkinchi xatboshi ham yetarlicha uzun bo‘lib, test uchun yozilgan matndan iborat.</p>
<p>Foto: Getty Images</p></div></div></body></html>`;

const QALAMPIR = `<html><head><meta property="og:title" content="Қалампир сарлавҳаси"/><meta property="og:description" content="Қалампир сарлавҳаси"/></head>
<body><div class="content-main-hero"><div class="title"><h1 class="text" itemprop="name">Қалампир сарлавҳаси</h1></div>
<div class="content-main-hero-info"><p class="left"><span class="circle"></span> Олам</p><p class="right" itemprop="datePublished"> 15 Ноябрь <span>visibility</span>4742</p></div></div>
<div class="content-main-titles"><div class="row"><div class="col-12"><p>Биринчи хатбоши лид вазифасини бажаради ва воқеанинг асосий мазмунини беради.</p>
<p>${UZUN}</p><p>Учинчи хатбоши ҳам бор ва у матннинг давоми ҳисобланади, тафсилотлар шу ерда.</p></div></div></div></body></html>`;

const OYINA = `<html><head><title>Oyina </title><meta property=og:title content="Oyina sarlavhasi"/></head><body>
<div class="breadcrumb flat"><a href="/uz">Asosiy sahifa</a><a href="/uz/articles">Maqolalar</a><a href="/uz/articles/adabiyot">Adabiyot</a><a class=active_bread>Oyina sarlavhasi</a></div>
<div class=single-news-headtext><h1>Oyina sarlavhasi</h1></div>
<div class=text-content><div class="statics flex"><span>18:43 / 13.11.2026</span><span>222</span></div></div>
<div class=single-news-paragraph><p><p class=MsoNormal><strong>Jaydari romantika</strong></p><p class=MsoNormal>${UZUN}</p><p>Yana bir xatboshi maqolaning davomi sifatida keladi va tahlil uchun yetarli.</p></p></div></body></html>`;

const UMUMIY = `<html><head><title>Boshqa sayt</title>
<script type="application/ld+json">{"@graph":[{"@type":"WebPage"},{"@type":"NewsArticle","headline":"Umumiy sarlavha","description":"Umumiy lid.","datePublished":"2026-10-01","articleBody":"${UZUN}\\n\\nYana bir xatboshi umumiy usul uchun yozilgan matn bo‘lib, uzunligi yetarli bo‘lishi kerak, shuning uchun bu jumla ham uzunroq yozildi."}]}</script>
</head><body><p>menyu</p></body></html>`;

describe("Havola va matn xeshi", () => {
  it("havola kaliti: www, kuzatish parametrlari, oxirgi «/», # e’tiborga olinmaydi", () => {
    const a = havolaKaliti("https://www.kun.uz/news/2026/11/15/x/?utm_source=tg&fbclid=1#top");
    assert.equal(a, "kun.uz/news/2026/11/15/x");
    assert.equal(havolaKaliti("http://kun.uz/news/2026/11/15/x"), a);
    assert.equal(havolaKaliti("kun.uz/news/2026/11/15/x?id=5&utm_medium=m"), "kun.uz/news/2026/11/15/x?id=5");
    assert.equal(havolaKaliti("ftp://kun.uz/x"), null);
    assert.equal(havolaKaliti("  "), null);
  });

  it("xesh uchun matn: katta-kichik harf, bo‘shliq va tutuq belgilari farq qilmaydi", () => {
    assert.equal(heshUchunMatn({ matn: `  ${UZUN.toUpperCase()}  ` }), heshUchunMatn({ matn: UZUN.replaceAll("‘", "'") }));
    // qisqa matnda sarlavha ham hisobga olinadi — sarlavhasi boshqa qisqa materiallar takror emas
    assert.notEqual(heshUchunMatn({ sarlavha: "A", matn: "Qisqa" }), heshUchunMatn({ sarlavha: "B", matn: "Qisqa" }));
    assert.equal(heshUchunMatn({}), null);
  });

  it("statistikaga: sun’iy va tekshirilmagan kirmaydi; namoyish rejimida sun’iy kiradi", () => {
    assert.ok(statistikagaKiradimi({ manba_turi: "havola", tekshirilgan: true }));
    assert.ok(!statistikagaKiradimi({ manba_turi: "ocr", tekshirilgan: false }));
    assert.ok(!statistikagaKiradimi({ manba_turi: "suniy", tekshirilgan: true }));
    assert.ok(statistikagaKiradimi({ manba_turi: "suniy", tekshirilgan: true }, true));
  });
});

describe("Sahifadan ajratish", () => {
  const bugun = new Date("2026-11-16T10:00:00");

  it("Kun.uz: sarlavha, lid, matn, sana, rukn; rasm izohi va reklama tashlanadi", () => {
    const m = ajratish(KUN, "https://kun.uz/news/2026/11/15/sinov", bugun);
    assert.equal(m.qoida, "kun.uz");
    assert.equal(m.nashr, "Kun.uz");
    assert.equal(m.sarlavha, "Sinov sarlavhasi");
    assert.equal(m.lid, "Bu lid matni.");
    assert.equal(m.sana, "2026-11-15");
    assert.equal(m.rukn, "Jahon");
    assert.ok(m.matn.startsWith(UZUN));
    assert.ok(!/Reklama|Foto:/.test(m.matn), m.matn);
    assert.equal(m.matn.split("\n").length, 2);
  });

  it("Qalampir.uz: kirill matni, yilsiz sana (taxminiy), lid — birinchi xatboshi", () => {
    const m = ajratish(QALAMPIR, "https://qalampir.uz/news/sinov-146363", bugun);
    assert.equal(m.qoida, "qalampir.uz");
    assert.equal(m.sarlavha, "Қалампир сарлавҳаси");
    assert.equal(m.sana, "2026-11-15");
    assert.equal(m.rukn, "Олам");
    assert.ok(m.lid.startsWith("Биринчи хатбоши"));
    assert.ok(m.ogohlantirishlar.includes("yilTaxminiy"));
    assert.ok(m.ogohlantirishlar.includes("lidBirinchiXatboshi"));
    assert.ok(!m.matn.includes("Биринчи хатбоши"));
  });

  it("Oyina.uz: ichma-ich <p>, «13.11.2026» sana, rukn breadcrumb’dan; ichki sarlavha lid emas", () => {
    const m = ajratish(OYINA, "https://oyina.uz/uz/article/5210", bugun);
    assert.equal(m.qoida, "oyina.uz");
    assert.equal(m.sarlavha, "Oyina sarlavhasi");
    assert.equal(m.sana, "2026-11-13");
    assert.equal(m.rukn, "Adabiyot");
    assert.equal(m.lid, "");
    assert.ok(m.ogohlantirishlar.includes("lidTopilmadi"));
    assert.ok(m.matn.startsWith("Jaydari romantika\n"));
    assert.equal(m.matn.split("\n").length, 3, "ichma-ich <p> takrorlanmaydi");
  });

  it("boshqa sayt: JSON-LD (@graph) dan sarlavha, lid, sana va articleBody", () => {
    const m = ajratish(UMUMIY, "https://example.uz/a/1", bugun);
    assert.equal(m.qoida, "umumiy");
    assert.equal(m.nashr, null);
    assert.equal(m.sarlavha, "Umumiy sarlavha");
    assert.equal(m.lid, "Umumiy lid.");
    assert.equal(m.sana, "2026-10-01");
    assert.ok(m.matn.startsWith(UZUN));
  });

  it("sanalar va qoida tanlash", () => {
    assert.equal(sananiOqish("2026-11-15T22:46:29+05:00"), "2026-11-15");
    assert.equal(sananiOqish("18:43 / 3.1.2026"), "2026-01-03");
    assert.equal(sananiOqish("bugun"), null);
    assert.deepEqual(oyNomliSana("15-noyabr, 2025"), { sana: "2025-11-15", yilTaxminiy: false });
    // kelajak chiqsa — o‘tgan yil
    assert.equal(oyNomliSana("28 декабря", new Date("2026-01-05"))?.sana, "2025-12-28");
    assert.equal(qoidaTanlash("https://m.kun.uz/news/1"), "kun.uz");
    assert.equal(qoidaTanlash("https://www.qalampir.uz/uz/news/1"), "qalampir.uz");
  });

  it("ichki tarmoq manzillari yopiq (SSRF)", () => {
    for (const ip of ["127.0.0.1", "10.2.3.4", "192.168.1.1", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1", "0.0.0.0"]) {
      assert.ok(ichkiManzilmi(ip), ip);
    }
    for (const ip of ["8.8.8.8", "185.8.212.1", "2a00:1450:4001::1"]) assert.ok(!ichkiManzilmi(ip), ip);
  });

  it("fayl matni: qator ko‘chishi va bo‘g‘in ko‘chirish birlashtiriladi; formaga bo‘linadi", () => {
    const m = qatorlarniBirlashtir("SARLAVHA\n\nLid birinchi\nqator.\n\nAsosiy maqo-\nla matni\ndavomi.\n\n\nOxirgi xatboshi.");
    assert.equal(m, "SARLAVHA\n\nLid birinchi qator.\n\nAsosiy maqola matni davomi.\n\nOxirgi xatboshi.");
    assert.deepEqual(formagaBolish(m), { sarlavha: "SARLAVHA", lid: "Lid birinchi qator.", matn: "Asosiy maqola matni davomi.\nOxirgi xatboshi." });
    // OCR: sarlavha matn bilan bitta blokda — nuqtasiz birinchi qator alohida ajraladi
    const ocr = qatorlarniBirlashtir("Toshkentda yangi kutubxona ochildi\nPoytaxtda kutubxona ochdi. Unda\nkitoblar bor.\n\nKeyingi xatboshi.");
    assert.deepEqual(formagaBolish(ocr), {
      sarlavha: "Toshkentda yangi kutubxona ochildi",
      lid: "Poytaxtda kutubxona ochdi. Unda kitoblar bor.",
      matn: "Keyingi xatboshi.",
    });
  });
});

describe("Baza: manba, takror, tekshiruv (2-bosqich)", () => {
  it("migratsiya qo‘llangan va jurnalga yozilgan", async () => {
    const m = await db.all<{ versiya: number }>("SELECT versiya FROM migratsiyalar ORDER BY versiya");
    assert.deepEqual(m.map((x) => x.versiya), [3, 4, 5, 6]);
    const u = await db.all<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'materiallar' AND column_name IN ('manba_turi','olingan_sana','matn_hash','tekshirilgan')",
    );
    assert.equal(u.length, 4);
  });

  it("havoladan saqlash: manba, olingan sana, xesh, asl HTML arxivi; takror havola va matn rad etiladi", async () => {
    const nashr = (await q.nashrlarRoyxati())[3];
    const html = "<html><body>asl sahifa</body></html>";
    const { id } = await q.materialQoshish({
      nashr_id: nashr.id,
      sarlavha: "Havoladan olingan",
      lid: "Lid",
      matn: UZUN,
      havola: "https://kun.uz/news/2026/11/15/havola?utm_source=x",
      manba_turi: "havola",
      olingan_sana: "2026-11-16T10:00:00",
      arxiv: gzipSync(html).toString("base64"),
    });
    const m = await q.materialOlish(id);
    assert.equal(m.manba_turi, "havola");
    assert.equal(m.olingan_sana, "2026-11-16T10:00:00");
    assert.equal(m.tekshirilgan, true);
    assert.ok(m.matn_hash && m.matn_hash.length === 64);
    assert.equal(m.arxiv_bor, true);
    assert.equal((await q.materialArxivi(id)).html.toString(), html);

    // xuddi shu havola (kuzatish parametrisiz, www bilan)
    await assert.rejects(
      () => q.materialQoshish({ nashr_id: nashr.id, sarlavha: "Boshqa", matn: "boshqa matn", havola: "https://www.kun.uz/news/2026/11/15/havola/" }),
      (e: { status: number; message: string }) => e.status === 409 && /x\.takrorHavola/.test(e.message),
    );
    // xuddi shu matn (boshqa sarlavha, boshqa havola)
    await assert.rejects(
      () => q.materialQoshish({ nashr_id: nashr.id, sarlavha: "Yangi sarlavha", matn: UZUN.toUpperCase() }),
      (e: { status: number; message: string }) => e.status === 409 && /x\.takrorMatn/.test(e.message),
    );
    assert.ok(await q.takrorniTopish({ havola: "http://kun.uz/news/2026/11/15/havola" }));
    // tahrirlashda o‘zi bilan takror hisoblanmaydi
    await q.materialTahrirlash(id, { nashr_id: nashr.id, sarlavha: "Havoladan olingan (tuzatildi)", lid: "Lid", matn: UZUN, havola: m.havola });

    // o‘chirilsa — arxiv ham
    await q.materialOchirish(id);
    assert.equal((await db.one<{ n: number }>("SELECT COUNT(*) AS n FROM manba_arxivi"))?.n, 0);
  });

  it("OCR: tekshirilmaguncha tahlil saqlanmaydi va statistikaga kirmaydi; sun’iy — ham", async () => {
    const nashr = (await q.nashrlarRoyxati())[0];
    const oldin = await dashboard();
    const { id } = await q.materialQoshish({ nashr_id: nashr.id, sarlavha: "Skan sahifa", matn: `${UZUN} OCR`, manba_turi: "ocr" });
    assert.equal((await q.materialOlish(id)).tekshirilgan, false);
    const tahlil = { sarlavha_turlari: ["axborotiy"], kompozitsiya: "mantiqiy", sar_lid: "mos", lid_matn: "mos", sar_matn: "mos", auditoriya: 3, belgilar: [] };
    await assert.rejects(() => q.tahlilSaqlash(id, tahlil as never), (e: { status: number }) => e.status === 409);

    const d1 = await dashboard();
    assert.equal(d1.jami, oldin.jami, "tekshirilmagan material hisobga kirmaydi");
    assert.equal(d1.chetda, oldin.chetda + 1);

    await q.materialTekshiruvi(id, { tekshirilgan: true });
    await q.tahlilSaqlash(id, tahlil as never);
    const d2 = await dashboard();
    assert.equal(d2.jami, oldin.jami + 1);
    assert.equal(d2.tahlil_qilingan, oldin.tahlil_qilingan + 1);

    const s = await q.materialQoshish({ nashr_id: nashr.id, sarlavha: "Namuna", matn: `${UZUN} sun’iy`, manba_turi: "suniy" });
    await q.tahlilSaqlash(s.id, tahlil as never);
    const d3 = await dashboard();
    assert.equal(d3.jami, d2.jami, "sun’iy material statistikaga kirmaydi");
    assert.equal(d3.chetda, d2.chetda + 1);

    // filtr: faqat tekshirilmaganlar / manba bo‘yicha
    assert.equal((await q.materiallarRoyxati({ manba: "suniy" })).length, 1);
    await q.materialTekshiruvi(s.id, { tekshirilgan: false });
    assert.equal((await q.materiallarRoyxati({ tekshirilgan: "yoq" })).length, 1);
  });

  it("import: aniq takror (havola yoki matn) xato qatorga tushadi va qo‘shilmaydi, manba — import", async () => {
    const nashr = (await q.nashrlarRoyxati())[4];
    const asos = await q.materialQoshish({ nashr_id: nashr.id, sarlavha: "Bazadagi", matn: `${UZUN} baza`, havola: "https://qalampir.uz/news/bor-1" });
    const natija = await imp.importQilish({
      qatorlar: [
        { qator: 2, nashr: nashr.nomi, sarlavha: "Yangi import", matn: `${UZUN} import`, havola: "https://qalampir.uz/news/yangi-2" },
        { qator: 3, nashr: nashr.nomi, sarlavha: "Havola takror", matn: "boshqa", havola: "https://www.qalampir.uz/news/bor-1?utm_source=a" },
        { qator: 4, nashr: nashr.nomi, sarlavha: "Matn takror", matn: `${UZUN} BAZA` },
        { qator: 5, nashr: nashr.nomi, sarlavha: "Fayl ichida takror", matn: "x", havola: "https://qalampir.uz/news/yangi-2" },
      ],
    });
    assert.equal(natija.qoshildi, 1);
    assert.equal(natija.xato_tufayli, 3);
    const yangi = await q.materialOlish(natija.birinchi_id!);
    assert.equal(yangi.manba_turi, "import");
    assert.ok(yangi.matn_hash);
    await q.materialOchirish(asos.id);
  });

  it("nusxadan tiklash: arxiv o‘z materiali bilan qaytadi, mos kelmagani tozalanadi", async () => {
    const nashr = (await q.nashrlarRoyxati())[3];
    const { id } = await q.materialQoshish({
      nashr_id: nashr.id, sarlavha: "Arxivli", matn: `${UZUN} arxiv`, havola: "https://kun.uz/news/arxiv",
      manba_turi: "havola", arxiv: gzipSync("<p>arxiv</p>").toString("base64"),
    });
    const { nom } = await zaxira.zaxiraYaratish();
    // tiklash: material va arxiv saqlanadi
    await zaxira.tiklash(nom);
    assert.equal((await q.materialArxivi(id)).html.toString(), "<p>arxiv</p>");
    // material o‘chirilib, nusxada yo‘q bo‘lsa — arxiv qolmaydi
    await db.run("DELETE FROM materiallar WHERE id = ?", [id]);
    await db.tiklashdanKeyinTozalash();
    assert.equal((await db.one<{ n: number }>("SELECT COUNT(*) AS n FROM manba_arxivi WHERE material_id = ?", [id]))?.n, 0);
  });

  it("metodika tarixida kim o‘zgartirgani saqlanadi", async () => {
    const m = await q.metodikaTolik();
    const vaznlar = Object.fromEntries(m.mezonlar.map((x) => [x.kod, x.vazn]));
    vaznlar.K1 += 5;
    vaznlar.K2 -= 5;
    const joriy = await (await import("../lib/scoring.ts")).metodikaniYuklash();
    await q.metodikaSaqlash(
      {
        vaznlar,
        muvofiqlik: joriy.muvofiqlik,
        kompozitsiya: joriy.kompozitsiya,
        kategoriyalar: Object.fromEntries(Object.values(joriy.kategoriyalar).map((k) => [k.kod, { mezon: k.mezon, jarima: k.jarima }])),
        shkala: joriy.shkala,
        izoh: "sinov",
      },
      "Sinov Admin",
    );
    const t = await q.metodikaTarixi();
    assert.equal(t[0].muallif, "Sinov Admin");
    assert.equal(t[0].snapshot.vaznlar?.K1, vaznlar.K1);
  });
});
