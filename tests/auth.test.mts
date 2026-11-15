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
    // ko‘rish sahifalari kuzatuvchiga ochilmadi
    for (const yol of ["/mediabaza", "/metodika", "/ekspertlar"]) assert.ok(!ruxsatmi("kuzatuvchi", yol), yol);
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
    assert.equal(qaytishManzili("/mediabaza", "kuzatuvchi"), "/");
    assert.equal(qaytishManzili("//evil.example/x", "admin"), "/");
    assert.equal(qaytishManzili("https://evil.example", "admin"), "/");
    assert.equal(qaytishManzili("/api/zaxira", "admin"), "/");
    assert.equal(qaytishManzili(null, "ekspert"), "/");
    assert.equal(boshSahifa("ekspert"), "/");
    assert.equal(qaytishManzili("/foydalanuvchilar", "ekspert"), "/");
    assert.ok(ochiqmi("/kirish") && ochiqmi("/api/kirish") && !ochiqmi("/"));
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
