// Kirish, sessiyalar va huquqlar testlari (PGlite, xotirada): npm test
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

process.env.MEDIAPRAG_DB = "memory://";
delete process.env.DATABASE_URL;

const db = await import("../lib/db.ts");
const auth = await import("../lib/auth.ts");
const { ruxsatmi, qaytishManzili, boshSahifa, ochiqmi } = await import("../lib/ruxsat.ts");

after(() => db.bazaniYopish());

describe("Huquqlar jadvali", () => {
  it("yopiq standart: jadvalda yo‘q yo‘l faqat administratorga", () => {
    for (const yol of ["/foydalanuvchilar", "/api/foydalanuvchilar", "/api/zaxira", "/mediabaza/import", "/api/yangi-nomalum"]) {
      assert.ok(ruxsatmi("admin", yol));
      assert.ok(!ruxsatmi("ekspert", yol), yol);
      assert.ok(!ruxsatmi("kuzatuvchi", yol), yol);
    }
  });

  it("ekspert hamma bo‘limni ko‘radi (foydalanuvchilardan tashqari), lekin o‘zgartira olmaydi", () => {
    for (const yol of ["/", "/mediabaza", "/analitika", "/misollar", "/metodika", "/ekspertlar", "/hisobot", "/api/materiallar", "/api/dashboard", "/api/export/excel"]) {
      assert.ok(ruxsatmi("ekspert", yol, "GET"), yol);
    }
    for (const [yol, usul] of [["/api/materiallar", "POST"], ["/api/materiallar/5", "PUT"], ["/api/materiallar/5", "DELETE"], ["/api/metodika", "PUT"], ["/api/ekspertlar", "POST"], ["/api/vaznlar/qollash", "POST"], ["/api/misollar/tanlangan", "PUT"], ["/api/materiallar/5/pdf", "GET"]]) {
      assert.ok(!ruxsatmi("ekspert", yol, usul), `${usul} ${yol}`);
    }
    // kuzatuvchi (va demo) mediabaza va metodikani ko‘radi, ekspertlar bo‘limini — yo‘q
    for (const yol of ["/mediabaza", "/metodika", "/api/materiallar"]) assert.ok(ruxsatmi("kuzatuvchi", yol, "GET"), yol);
    assert.ok(!ruxsatmi("kuzatuvchi", "/ekspertlar"));
    for (const [yol, usul] of [["/api/materiallar", "POST"], ["/api/materiallar/5", "PUT"], ["/api/materiallar/5/arxiv", "GET"], ["/api/metodika", "PUT"]]) {
      assert.ok(!ruxsatmi("kuzatuvchi", yol, usul), `${usul} ${yol}`);
    }
  });

  it("kuzatuvchi — faqat ko‘rish; ekspert — o‘z ish joyi", () => {
    for (const yol of ["/", "/analitika", "/misollar", "/hisobot", "/api/export/excel", "/api/nashrlar/3/hisobot"]) {
      assert.ok(ruxsatmi("kuzatuvchi", yol), yol);
    }
    assert.ok(!ruxsatmi("kuzatuvchi", "/api/misollar/tanlangan", "PUT"));
    assert.ok(!ruxsatmi("kuzatuvchi", "/api/dashboard", "POST"));
    for (const [yol, usul] of [["/vazifalar", "GET"], ["/tahlil/5", "GET"], ["/api/materiallar/5/ekspertlar/2", "PUT"], ["/api/ekspertlar/2/vazn", "PUT"], ["/api/hisoblash", "POST"]]) {
      assert.ok(ruxsatmi("ekspert", yol, usul), yol);
      assert.ok(!ruxsatmi("kuzatuvchi", yol, usul), yol);
    }
    assert.ok(!ruxsatmi("ekspert", "/api/ekspertlar/2/vazn", "DELETE"));
    assert.ok(!ruxsatmi("ekspert", "/api/materiallar/5/tahlil", "GET"), "asosiy tahlil ekspertga yopiq");
    assert.ok(!ruxsatmi("ekspert", "/kelishuv/5"));
  });

  it("kirgandan keyin qaytish manzili faqat sayt ichida va shu rolga ochiq", () => {
    assert.equal(qaytishManzili("/analitika?turi=bosma", "kuzatuvchi"), "/analitika?turi=bosma");
    assert.equal(qaytishManzili("/mediabaza", "kuzatuvchi"), "/mediabaza");
    assert.equal(qaytishManzili("/ekspertlar", "kuzatuvchi"), "/");
    assert.equal(qaytishManzili("//evil.example/x", "admin"), "/");
    assert.equal(qaytishManzili("https://evil.example", "admin"), "/");
    assert.equal(qaytishManzili("/api/zaxira", "admin"), "/");
    assert.equal(qaytishManzili(null, "ekspert"), "/");
    assert.equal(boshSahifa("ekspert"), "/");
    assert.equal(qaytishManzili("/foydalanuvchilar", "ekspert"), "/");
    assert.ok(ochiqmi("/kirish") && ochiqmi("/api/kirish"));
    // bosh sahifa, «Platforma haqida» va «Demo ko‘rish» — kirishsiz; boshqa sahifalar — yo‘q
    assert.ok(ochiqmi("/") && ochiqmi("/haqida") && ochiqmi("/api/demo"));
    for (const yol of ["/analitika", "/api/dashboard", "/api/bosh-sahifa", "/api/foydalanuvchilar/demo", "/haqida/x", "/api/demo/x"]) {
      assert.ok(!ochiqmi(yol), yol);
    }
    // sozlamalar API’lari — faqat administrator
    for (const yol of ["/api/bosh-sahifa", "/api/foydalanuvchilar/demo"]) {
      assert.ok(ruxsatmi("admin", yol, "PUT"));
      assert.ok(!ruxsatmi("ekspert", yol, "PUT") && !ruxsatmi("kuzatuvchi", yol, "PUT"), yol);
    }
  });
});

describe("Parollar va sessiyalar", () => {
  it("scrypt: to‘g‘ri va noto‘g‘ri parol, har safar boshqa tuz", async () => {
    const x1 = await auth.parolXeshi("Maxfiy-parol-1");
    const x2 = await auth.parolXeshi("Maxfiy-parol-1");
    assert.notEqual(x1, x2);
    assert.ok(x1.startsWith("scrypt$"));
    assert.ok(await auth.parolTogri("Maxfiy-parol-1", x1));
    assert.ok(!(await auth.parolTogri("maxfiy-parol-1", x1)));
    assert.ok(!(await auth.parolTogri("x", "buzilgan-xesh")));
    assert.match(auth.vaqtinchalikParol(), /^[a-km-zA-HJ-NP-Z2-9]{12}$/);
  });

  it("birinchi administrator → kirish → sessiya; noto‘g‘ri parol umumiy xato bilan", async () => {
    assert.ok(await auth.sozlashKerakmi());
    await assert.rejects(() => auth.birinchiAdmin({ email: "admin@test.uz", ism: "A", parol: "qisqa" }), /au\.x\.parolQisqa/);
    const { token } = await auth.birinchiAdmin({ email: "Admin@Test.uz", ism: "Admin", parol: "admin-parol-1" });
    assert.ok(!(await auth.sozlashKerakmi()));
    await assert.rejects(() => auth.birinchiAdmin({ email: "b@test.uz", ism: "B", parol: "boshqa-parol-1" }), /au\.x\.sozlanganu/);

    const f = await auth.sessiyaFoydalanuvchisi(token);
    assert.equal(f?.email, "admin@test.uz");
    assert.equal(f?.rol, "admin");
    assert.equal(await auth.sessiyaFoydalanuvchisi("soxta-token"), null);
    await assert.rejects(() => auth.kirish({ email: "admin@test.uz", parol: "noto‘g‘ri-parol" }), /au\.x\.notogri/);
    await assert.rejects(() => auth.kirish({ email: "yoq@test.uz", parol: "admin-parol-1" }), /au\.x\.notogri/);
    const k = await auth.kirish({ email: " ADMIN@test.uz ", parol: "admin-parol-1" });
    assert.equal(k.foydalanuvchi.rol, "admin");
    await auth.sessiyaniTugatish(k.token);
    assert.equal(await auth.sessiyaFoydalanuvchisi(k.token), null);
  });

  it("5 ta noto‘g‘ri urinishdan keyin email vaqtincha bloklanadi (to‘g‘ri parol bilan ham)", async () => {
    for (let i = 0; i < 4; i++) await assert.rejects(() => auth.kirish({ email: "admin@test.uz", parol: `xato-${i}-parol` }));
    await assert.rejects(() => auth.kirish({ email: "admin@test.uz", parol: "admin-parol-1" }), /au\.x\.kopUrinish/);
    await db.run("DELETE FROM kirish_urinishlari");
  });
});

describe("Foydalanuvchilarni boshqarish", () => {
  it("ekspert hisobi: ekspert yozuvi yaratiladi, vaqtinchalik parol, birinchi kirishda almashtirish", async () => {
    const admin = (await auth.kirish({ email: "admin@test.uz", parol: "admin-parol-1" })).foydalanuvchi;
    const { id, parol } = await auth.foydalanuvchiQoshish({ email: "ekspert@test.uz", ism: "Ekspert Bir", rol: "ekspert" });
    await assert.rejects(() => auth.foydalanuvchiQoshish({ email: "ekspert@test.uz", ism: "X", rol: "kuzatuvchi" }), /au\.x\.emailBand/);
    const e = await db.one<{ ekspert_id: number; ism: string }>(
      "SELECT f.ekspert_id, e.ism FROM foydalanuvchilar f JOIN ekspertlar e ON e.id = f.ekspert_id WHERE f.id = ?",
      [id],
    );
    assert.equal(e?.ism, "Ekspert Bir");
    // shu ekspert yozuvini boshqa hisobga bog‘lab bo‘lmaydi
    await assert.rejects(
      () => auth.foydalanuvchiQoshish({ email: "e2@test.uz", ism: "Ekspert Bir", rol: "ekspert" }),
      /au\.x\.ekspertBand/,
    );

    const k = await auth.kirish({ email: "ekspert@test.uz", parol });
    assert.equal(k.foydalanuvchi.parol_almashtirilsin, true);
    await assert.rejects(() => auth.parolniAlmashtirish(k.foydalanuvchi, k.token, { eski: "xato", yangi: "yangi-parol-1" }), /au\.x\.eskiNotogri/);
    await auth.parolniAlmashtirish(k.foydalanuvchi, k.token, { eski: parol, yangi: "yangi-parol-1" });
    assert.equal((await auth.sessiyaFoydalanuvchisi(k.token))?.parol_almashtirilsin, false);

    // tiklash: yangi vaqtinchalik parol, eski sessiyalar tugaydi
    const t = await auth.parolniTiklash(id);
    assert.equal(await auth.sessiyaFoydalanuvchisi(k.token), null);
    assert.ok((await auth.kirish({ email: "ekspert@test.uz", parol: t.parol })).foydalanuvchi.parol_almashtirilsin);

    // faolsizlantirish — kira olmaydi
    await auth.foydalanuvchiTahrirlash(admin, id, { faol: false });
    await assert.rejects(() => auth.kirish({ email: "ekspert@test.uz", parol: t.parol }), /au\.x\.notogri/);
  });

  it("oxirgi administratorni o‘chirib yoki roldan tushirib bo‘lmaydi; o‘zini ham", async () => {
    const admin = (await auth.kirish({ email: "admin@test.uz", parol: "admin-parol-1" })).foydalanuvchi;
    await assert.rejects(() => auth.foydalanuvchiTahrirlash(admin, admin.id, { rol: "kuzatuvchi" }), /au\.x\.(oxirgiAdmin|ozingiz)/);
    await assert.rejects(() => auth.foydalanuvchiOchirish(admin, admin.id), /au\.x\.ozingiz/);
    const { id } = await auth.foydalanuvchiQoshish({ email: "admin2@test.uz", ism: "Admin Ikki", rol: "admin" });
    await auth.foydalanuvchiTahrirlash(admin, id, { rol: "kuzatuvchi" });
    assert.equal((await db.one<{ rol: string }>("SELECT rol FROM foydalanuvchilar WHERE id = ?", [id]))?.rol, "kuzatuvchi");
    await auth.foydalanuvchiOchirish(admin, id);
    assert.equal(await db.one("SELECT 1 FROM foydalanuvchilar WHERE id = ?", [id]), undefined);
  });
});

describe("Ochiq ro‘yxatdan o‘tish", () => {
  it("oddiy foydalanuvchi o‘zi ro‘yxatdan o‘tadi (kuzatuvchi), administrator uni ekspert qiladi", async () => {
    assert.ok(await auth.royxatOchiqmi(), "administrator bor — ro‘yxat standart ochiq");
    const { token, foydalanuvchi } = await auth.royxatdanOtish({ ism: "Oddiy Foydalanuvchi", email: " Oddiy@Test.uz ", parol: "oddiy-parol-1", takror: "oddiy-parol-1" });
    assert.equal(foydalanuvchi.rol, "kuzatuvchi");
    assert.equal((await auth.sessiyaFoydalanuvchisi(token))?.email, "oddiy@test.uz");
    const qator = (await auth.foydalanuvchilar()).find((x) => x.email === "oddiy@test.uz")!;
    assert.equal(qator.ozi_royxatdan, true);
    assert.equal(qator.parol_almashtirilsin, false);

    await assert.rejects(() => auth.royxatdanOtish({ ism: "X", email: "oddiy@test.uz", parol: "boshqa-parol-1" }), /au.x.emailBand/);
    await assert.rejects(() => auth.royxatdanOtish({ ism: "X", email: "x@test.uz", parol: "qisqa" }), /au.x.parolQisqa/);
    await assert.rejects(() => auth.royxatdanOtish({ ism: "X", email: "y@test.uz", parol: "yaxshi-parol-1", takror: "boshqa" }), /au.parolMos/);
    // bot tuzog‘i
    await assert.rejects(() => auth.royxatdanOtish({ ism: "Bot", email: "bot@test.uz", parol: "bot-parol-123", veb_sayt: "http://spam" }), /au.x.maydonlar/);

    // administrator ekspert qiladi — ekspert yozuvi ism bo‘yicha yaratiladi va bog‘lanadi
    const admin = (await auth.kirish({ email: "admin@test.uz", parol: "admin-parol-1" })).foydalanuvchi;
    await auth.foydalanuvchiTahrirlash(admin, qator.id, { rol: "ekspert" });
    const e = await db.one<{ rol: string; ism: string }>(
      "SELECT f.rol, e.ism FROM foydalanuvchilar f JOIN ekspertlar e ON e.id = f.ekspert_id WHERE f.id = ?",
      [qator.id],
    );
    assert.deepEqual(e, { rol: "ekspert", ism: "Oddiy Foydalanuvchi" });

    // o‘chirilsa — yopiq
    await auth.royxatniSozlash({ ochiq: false });
    assert.equal(await auth.royxatOchiqmi(), false);
    await assert.rejects(() => auth.royxatdanOtish({ ism: "Z", email: "z@test.uz", parol: "zz-parol-123" }), /au.x.royxatYopiq/);
    await auth.royxatniSozlash({ ochiq: true });
  });
});

describe("Demo rejimi", () => {
  it("parolsiz umumiy hisob: kuzatuvchi, qisqa sessiya, ro‘yxatda ko‘rinmaydi, parol bilan kirib bo‘lmaydi", async () => {
    assert.ok(await auth.demoOchiqmi(), "standart — yoqilgan");
    const a = await auth.demoKirish();
    const b = await auth.demoKirish();
    assert.equal(a.foydalanuvchi.rol, "kuzatuvchi");
    assert.equal(a.foydalanuvchi.demo, true);
    assert.equal(a.foydalanuvchi.id, b.foydalanuvchi.id, "hisob bitta — har tashrifga alohida sessiya");
    assert.notEqual(a.token, b.token);
    const f = await auth.sessiyaFoydalanuvchisi(a.token);
    assert.equal(f?.demo, true);
    assert.equal(f?.rol, "kuzatuvchi");
    assert.equal(f?.parol_almashtirilsin, false);
    const s = await db.one<{ muddat: string }>("SELECT muddat FROM sessiyalar WHERE foydalanuvchi_id = ? ORDER BY muddat DESC LIMIT 1", [a.foydalanuvchi.id]);
    assert.ok(new Date(s!.muddat).getTime() - Date.now() <= 86400_000 + 60_000, "demo sessiyasi — bir kun");

    // ro‘yxatda va boshqaruvda yo‘q
    assert.ok(!(await auth.foydalanuvchilar()).some((x) => x.demo || x.email === a.foydalanuvchi.email));
    const admin = (await auth.kirish({ email: "admin@test.uz", parol: "admin-parol-1" })).foydalanuvchi;
    await assert.rejects(() => auth.foydalanuvchiTahrirlash(admin, a.foydalanuvchi.id, { rol: "admin" }), /au\.x\.topilmadi/);
    await assert.rejects(() => auth.parolniTiklash(a.foydalanuvchi.id), /au\.x\.topilmadi/);
    await assert.rejects(() => auth.foydalanuvchiOchirish(admin, a.foydalanuvchi.id), /au\.x\.topilmadi/);

    // parol bilan kirish va parol almashtirish — yo‘q; xizmat domeni band
    await assert.rejects(() => auth.kirish({ email: a.foydalanuvchi.email, parol: "!demo" }), /au\.x\.notogri/);
    await assert.rejects(() => auth.parolniAlmashtirish(f!, a.token, { eski: "x", yangi: "yangi-parol-12" }), /au\.x\.demo/);
    await assert.rejects(() => auth.royxatdanOtish({ ism: "X", email: "boshqa@mediaprag.local", parol: "yaxshi-parol-1" }), /au\.x\.email/);
    await assert.rejects(() => auth.foydalanuvchiQoshish({ ism: "X", email: "demo@mediaprag.local", rol: "admin" }), /au\.x\.email/);
  });

  it("administrator o‘chirsa — demo yopiladi va ochiq demo sessiyalari tugaydi", async () => {
    const { token } = await auth.demoKirish();
    await auth.demoniSozlash({ ochiq: false });
    assert.equal(await auth.demoOchiqmi(), false);
    assert.equal(await auth.sessiyaFoydalanuvchisi(token), null);
    await assert.rejects(() => auth.demoKirish(), /au\.x\.demoYopiq/);
    await assert.rejects(() => auth.demoniSozlash({ ochiq: "ha" }), /x\.notogriSorov/);
    await auth.demoniSozlash({ ochiq: true });
    assert.ok(await auth.demoOchiqmi());
  });
});

describe("Ochiq bosh sahifa", () => {
  it("mavzu va muallif saqlanadi, umumiy ko‘rsatkichlar — faqat statistikaga kiradigan materiallardan", async () => {
    const ochiq = await import("../lib/ochiq.ts");
    const bosh = await ochiq.boshMatnlar();
    assert.deepEqual(bosh, { mavzu: { uz: "", ru: "", en: "" }, muallif: "" });
    const saqlangan = await ochiq.boshMatnlarniSaqlash({ mavzu: { uz: "  O‘zbek   mediamatnlari ", ru: "Медиатексты" }, muallif: "A. Muallifov" });
    assert.deepEqual(saqlangan, { mavzu: { uz: "O‘zbek mediamatnlari", ru: "Медиатексты", en: "" }, muallif: "A. Muallifov" });
    assert.equal(ochiq.mavzuMatni(saqlangan, "en"), "O‘zbek mediamatnlari", "tarjima yo‘q — o‘zbekchasi");
    assert.equal(ochiq.mavzuMatni(saqlangan, "ru"), "Медиатексты");
    await assert.rejects(() => ochiq.boshMatnlarniSaqlash({ muallif: "x".repeat(201) }), /bh\.x\.uzun/);
    await assert.rejects(() => ochiq.boshMatnlarniSaqlash({ mavzu: { uz: 5 } }), /x\.notogriSorov/);

    const m = await ochiq.ochiqMalumot();
    assert.equal(m.matnlar.muallif, "A. Muallifov");
    assert.equal(m.demo, true);
    const kutilgan = (await db.one<{ n: number }>(`SELECT COUNT(*) AS n FROM materiallar m WHERE ${db.hisobgaShart("m")}`))!.n;
    assert.equal(m.materiallar, kutilgan);
    assert.ok(m.tahlil_qilingan <= m.materiallar);
    assert.equal(m.mezonlar.reduce((a, x) => a + x.vazn, 0), 100, "vaznlar yig‘indisi — 100");
    assert.deepEqual(m.shkala.map((s) => s.gacha), [40, 60, 80, 100]);
  });
});
