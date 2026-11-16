// ТЗ v2, 3-bosqich: AI-taklif (Claude o‘rnida — soxta chaqiruv), tadqiqotchi qarori, AI–tadqiqotchi mosligi. npm test
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

process.env.MEDIAPRAG_DB = "memory://";
delete process.env.DATABASE_URL;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.MEDIAPRAG_NAMOYISH;

const db = await import("../lib/db.ts");
const q = await import("../lib/queries.ts");
const ai = await import("../lib/ai/taklif.ts");
const { cohenKappa, kappaTalqini } = await import("../lib/statistika.ts");
const { promptYasash, STANDART_TARIFLAR } = await import("../lib/ai/yoriqnoma.ts");

after(() => db.bazaniYopish());

const MATN = "Viloyatda yangi ko‘prik qurildi. Mutasaddilar bu haqda ma’lum qildi. Balki keyingi yil yana biri quriladi.";
const material = async (sarlavha: string, qoshimcha: Record<string, unknown> = {}) => {
  const nashr = (await q.nashrlarRoyxati())[0];
  const { id } = await q.materialQoshish({ nashr_id: nashr.id, sarlavha, lid: "Ko‘prik yo‘lovchilar uchun ochildi.", matn: `${MATN} ${sarlavha}`, ...qoshimcha });
  return q.materialOlish(id);
};

/** Claude o‘rnida: sxemaga mos javob; bitta belgi matnda yo‘q (tashlanishi kerak) */
const soxta: import("../lib/ai/taklif.ts").AiChaqiruv = async ({ tizim, xabar, sxema }) => {
  assert.ok(tizim.includes("abstrakt_jumla") && tizim.includes("TA’RIFLAR"));
  assert.ok(xabar.includes("<asosiy_matn>"));
  const javob = sxema.parse({
    sarlavha_turlari: { qiymat: ["axborotiy"], asos: "Fakt xabar qilinadi.", ishonch: "yuqori" },
    sar_lid: { qiymat: "mos", asos: "Lid sarlavhani davom ettiradi.", ishonch: "yuqori" },
    lid_matn: { qiymat: "qisman", asos: "Matn kengroq.", ishonch: "orta" },
    sar_matn: { qiymat: "mos", asos: "Mavzu bir.", ishonch: "yuqori" },
    kompozitsiya: { qiymat: "mantiqiy", asos: "Asosiy fakt boshida.", ishonch: "orta" },
    belgilar: [
      { kategoriya: "referensial_noaniqlik", qism: "matn", fragment: "Mutasaddilar bu haqda ma’lum qildi.", asos: "Kim ekani ko‘rsatilmagan.", ishonch: "yuqori" },
      // qism noto‘g‘ri ko‘rsatilgan, lekin matnda bor — tuzatiladi
      { kategoriya: "modal_birlik", qism: "lid", fragment: "Balki", asos: "Ehtimollik.", ishonch: "orta" },
      // matnda yo‘q — AI o‘ylab topgan, tashlanadi
      { kategoriya: "abstrakt_jumla", qism: "matn", fragment: "Bu juda muhim voqea bo‘ldi.", asos: "—", ishonch: "past" },
    ],
  });
  return { javob, model: "claude-opus-5-5", toxtash: "end_turn", kirishToken: 1200, chiqishToken: 300 };
};

describe("Cohen κ", () => {
  it("darslikdagi misol: pₒ = 0,7; pₑ = 0,5 → κ = 0,4", () => {
    const j: [string, string][] = [
      ...Array(20).fill(["ha", "ha"]), ...Array(5).fill(["ha", "yoq"]), ...Array(10).fill(["yoq", "ha"]), ...Array(15).fill(["yoq", "yoq"]),
    ];
    const k = cohenKappa(j);
    assert.equal(k.n, 50);
    assert.ok(Math.abs(k.mos! - 0.7) < 1e-9);
    assert.ok(Math.abs(k.kappa! - 0.4) < 1e-9);
    assert.equal(kappaTalqini(k.kappa), "kuchsiz");
    assert.equal(cohenKappa([["a", "a"], ["a", "a"]]).kappa, null, "bitta toifa — κ aniqlanmaydi");
    assert.equal(cohenKappa([]).n, 0);
  });
});

describe("AI-taklif", () => {
  it("fragment so‘zma-so‘z tekshiriladi; qism tuzatiladi; yo‘q bo‘lsa — null", async () => {
    const m = { sarlavha: "Sarlavha", lid: "Lid  matni", matn: "Birinchi jumla. «Iqtibos» bor." };
    assert.deepEqual(ai.fragmentniTop(m, "lid", "Lid matni"), { qism: "lid", fragment: "Lid matni" });
    assert.deepEqual(ai.fragmentniTop(m, "sarlavha", "birinchi jumla."), { qism: "matn", fragment: "Birinchi jumla." });
    assert.equal(ai.fragmentniTop(m, "matn", "Yo‘q jumla"), null);
  });

  it("prompt: kodlar va ta’riflar; versiya — matn xeshidan", () => {
    const p = promptYasash(
      { sarlavhaTurlari: [{ kod: "savol", nomi: "Savol" }], muvofiqlik: [{ kod: "mos", nomi: "Mos" }], kompozitsiya: [], kategoriyalar: [{ kod: "murojaat", nomi: "Murojaat", guruh: "vosita" }] },
      STANDART_TARIFLAR,
    );
    assert.ok(p.includes("savol — Savol") && p.includes("murojaat — Murojaat (pragmatik vosita)") && p.includes("so‘zma-so‘z"));
  });

  it("kalit yo‘q bo‘lsa — 503; o‘chirilgan — 403; sun’iy material — 409", async () => {
    const m = await material("Kalitsiz");
    await assert.rejects(() => ai.aiTaklifOlish(m.id, "Admin", m), (e: { status: number }) => e.status === 503);
    await ai.aiSozlash({ yoqilgan: false });
    await assert.rejects(() => ai.aiTaklifOlish(m.id, "Admin", m, soxta), (e: { status: number }) => e.status === 403);
    await ai.aiSozlash({ yoqilgan: true });
    const s = await material("Namuna", { manba_turi: "suniy" });
    await assert.rejects(() => ai.aiTaklifOlish(s.id, "Admin", s, soxta), (e: { status: number }) => e.status === 409);
  });

  it("takliflar saqlanadi (model, prompt versiyasi), lekin tahlil va LPSI ga tegilmaydi; o‘ylab topilgan fragment tashlanadi", async () => {
    const m = await material("Taklif");
    const n = await ai.aiTaklifOlish(m.id, "Admin", m, soxta);
    assert.equal(n.model, "claude-opus-5-5");
    assert.match(n.prompt_versiya, /^v1-[0-9a-f]{10}$/);
    assert.equal(n.tashlandi, 1);
    assert.equal(n.takliflar.filter((t) => t.blok === "belgi").length, 2);
    const modal = n.takliflar.find((t) => t.blok === "belgi" && (t.qiymat as { kategoriya: string }).kategoriya === "modal_birlik");
    assert.deepEqual(modal?.qiymat, { kategoriya: "modal_birlik", qism: "matn", fragment: "Balki" });
    assert.equal((await q.tahlilOlish(m.id)).tahlil, null, "tahlil avtomatik yozilmaydi");
    assert.ok(await db.one("SELECT 1 FROM ai_promptlar WHERE versiya = ?", [n.prompt_versiya]));
    const s = await db.one<{ kirish_token: number; holat: string }>("SELECT kirish_token, holat FROM ai_sorovlar WHERE id = ?", [n.sorov_id]);
    assert.deepEqual(s, { kirish_token: 1200, holat: "ok" });
    // sahifa qayta ochilganda — kutilayotgan takliflar qaytadi
    assert.equal((await ai.kutilayotganTakliflar(m.id))?.takliflar.length, n.takliflar.length);
  });

  it("qarorlar: tasdiqlash, o‘zgartirish, rad — tahlil bilan birga; belgilar holati va kim tasdiqlagani", async () => {
    const m = await material("Qaror");
    const n = await ai.aiTaklifOlish(m.id, "Admin", m, soxta);
    const id = (blok: string, kat?: string) =>
      n.takliflar.find((t) => t.blok === blok && (!kat || (t.qiymat as { kategoriya: string }).kategoriya === kat))!.id;
    const ref = id("belgi", "referensial_noaniqlik");
    const mod = id("belgi", "modal_birlik");
    await ai.tahlilniSaqlashAi(
      m.id,
      {
        sarlavha_turlari: ["axborotiy"], // AI bilan teng — tasdiqlangan
        sar_lid: "mos", // tasdiqlangan
        lid_matn: "mos", // AI «qisman» edi — o‘zgartirilgan
        sar_matn: "mos", // rad etilgan (qiymat qo‘lda tanlangan)
        kompozitsiya: "ketma_ket",
        auditoriya: 4,
        belgilar: [
          { kategoriya: "referensial_noaniqlik", qism: "matn", fragment: "Mutasaddilar bu haqda ma’lum qildi.", izoh: null, holat: "ai_tasdiqlangan", ai_taklif_id: ref },
          { kategoriya: "abstrakt_jumla", qism: "matn", fragment: "Viloyatda yangi ko‘prik qurildi.", izoh: null },
        ],
        ai_qarorlar: [
          { id: id("sarlavha_turlari"), qaror: "tasdiqlangan" },
          { id: id("sar_lid"), qaror: "tasdiqlangan" },
          { id: id("lid_matn"), qaror: "ozgartirilgan" },
          { id: id("sar_matn"), qaror: "rad" },
          { id: ref, qaror: "tasdiqlangan" },
          { id: mod, qaror: "rad" },
        ],
      } as never,
      "Barno",
    );
    const qarorlar = Object.fromEntries(
      (await db.all<{ blok: string; taklif_qiymati: string; yakuniy_qaror: string; qaror_beruvchi: string }>(
        "SELECT blok, taklif_qiymati, yakuniy_qaror, qaror_beruvchi FROM ai_takliflar WHERE material_id = ?",
        [m.id],
      )).map((r) => [r.blok === "belgi" ? JSON.parse(r.taklif_qiymati).kategoriya : r.blok, r]),
    );
    assert.equal(qarorlar.sarlavha_turlari.yakuniy_qaror, "tasdiqlangan");
    assert.equal(qarorlar.sar_lid.yakuniy_qaror, "tasdiqlangan");
    assert.equal(qarorlar.lid_matn.yakuniy_qaror, "ozgartirilgan");
    assert.equal(qarorlar.sar_matn.yakuniy_qaror, "rad");
    assert.equal(qarorlar.kompozitsiya.yakuniy_qaror, null, "ko‘rib chiqilmagani — kutilmoqda");
    assert.equal(qarorlar.referensial_noaniqlik.yakuniy_qaror, "tasdiqlangan");
    assert.equal(qarorlar.modal_birlik.yakuniy_qaror, "rad");
    assert.equal(qarorlar.sar_lid.qaror_beruvchi, "Barno");

    const { belgilar } = await q.tahlilOlish(m.id);
    const aiBelgi = belgilar.find((b) => b.kategoriya === "referensial_noaniqlik")!;
    assert.equal(aiBelgi.holat, "ai_tasdiqlangan");
    assert.equal(aiBelgi.tasdiqlagan, "Barno");
    assert.ok(aiBelgi.tasdiq_sanasi);
    assert.equal(belgilar.find((b) => b.kategoriya === "abstrakt_jumla")!.holat, "qolda");

    // keyingi saqlashda holat saqlanib qoladi (belgilar qayta yoziladi)
    await ai.tahlilniSaqlashAi(m.id, { sarlavha_turlari: ["axborotiy"], belgilar } as never, "Boshqa");
    const qayta = (await q.tahlilOlish(m.id)).belgilar.find((b) => b.kategoriya === "referensial_noaniqlik")!;
    assert.equal(qayta.holat, "ai_tasdiqlangan");
    assert.equal(qayta.tasdiqlagan, "Barno");
  });

  it("AI–tadqiqotchi mosligi: foiz va κ, kutilayotganlar hisobga olinmaydi", async () => {
    const r = await ai.aiMoslik(db.hisobgaShart("m"));
    assert.ok(r.takliflar >= 7 && r.tasdiqlangan >= 3 && r.rad >= 2 && r.kutilmoqda >= 1);
    const lid = r.qatorlar.find((x) => x.kalit === "lid_matn")!;
    assert.equal(lid.n, 1);
    assert.equal(lid.mos, 0);
    const jami = r.qatorlar.find((x) => x.tur === "jami")!;
    // birliklar: ref (AI=ref, tadq.=ref), modal (AI=modal, tadq.=yo‘q), abstrakt (AI=yo‘q, tadq.=abstrakt)
    assert.equal(jami.n, 3);
    assert.ok(Math.abs(jami.mos! - 33.3) < 0.1);
    assert.deepEqual(r.modellar, ["claude-opus-5-5"]);
  });

  it("kunlik chegara", async () => {
    await ai.aiSozlash({ kunlikChegara: 1 });
    const m = await material("Chegara");
    await assert.rejects(() => ai.aiTaklifOlish(m.id, "Admin", m, soxta), (e: { status: number }) => e.status === 429);
    await assert.rejects(() => ai.aiSozlash({ kunlikChegara: 0 }), (e: { status: number }) => e.status === 422);
  });
});
