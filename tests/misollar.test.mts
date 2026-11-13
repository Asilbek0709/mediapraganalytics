// Misollar korpusi testlari (kontekst, ekspertlar tasdig‘i, filtrlar, Word ro‘yxati): npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fragmentOrni,
  kontekstAjratish,
  misolFiltriniOqish,
  misolFiltriQatori,
  misollarniFiltrlash,
  ustmaUst,
  wordRoyxati,
  type Misol,
  type WordMatnlari,
  type WordSozlama,
} from "../lib/misollar.ts";

const MATN =
  "Prezident Sh. Mirziyoyev yig‘ilish o‘tkazdi. Unda ta’lim tizimidagi muammolar muhokama qilindi, xususan «o‘qituvchilar yetishmasligi» masalasi! Keyingi qadamlar haqida esa hech narsa aytilmadi.\nIkkinchi xatboshi shu yerda boshlanadi.";

describe("Fragment va kontekst", () => {
  it("fragment joylashgan gap ajratiladi, «Sh.» gap oxiri emas", () => {
    const k = kontekstAjratish(MATN, "yig‘ilish o‘tkazdi")!;
    assert.deepEqual(k, { oldin: "Prezident Sh. Mirziyoyev ", fragment: "yig‘ilish o‘tkazdi", keyin: "." });
  });

  it("gap o‘rtasidagi fragment: oldingi gap tugashidan keyingi gap tugashigacha (! va » bilan)", () => {
    const k = kontekstAjratish(MATN, "muammolar muhokama qilindi")!;
    assert.equal(k.oldin, "Unda ta’lim tizimidagi ");
    assert.equal(k.keyin, ", xususan «o‘qituvchilar yetishmasligi» masalasi!");
  });

  it("fragment butun gap bo‘lsa, keyingi gapga o‘tilmaydi", () => {
    const k = kontekstAjratish(MATN, "Keyingi qadamlar haqida esa hech narsa aytilmadi.")!;
    assert.equal(k.oldin, "");
    assert.equal(k.keyin, "");
  });

  it("xatboshi ham chegara", () => {
    const k = kontekstAjratish(MATN, "xatboshi shu yerda")!;
    assert.equal(k.oldin, "Ikkinchi ");
    assert.equal(k.keyin, " boshlanadi.");
  });

  it("katta-kichik harf, tutuq belgisi va bo‘shliqlar farqi e’tiborsiz (o‘ / o' / oʻ)", () => {
    const joy = fragmentOrni(MATN, "YIG'ILISH   oʻtkazdi");
    assert.ok(joy);
    assert.equal(MATN.slice(joy.boshi, joy.oxiri), "yig‘ilish o‘tkazdi");
    // ko‘rsatiladigan fragment — matndagi asl ko‘rinish
    assert.equal(kontekstAjratish(MATN, "YIG'ILISH oʻtkazdi")!.fragment, "yig‘ilish o‘tkazdi");
  });

  it("matnda yo‘q fragment — null", () => {
    assert.equal(kontekstAjratish(MATN, "bunday jumla yo‘q"), null);
    assert.equal(kontekstAjratish(null, "nimadir"), null);
  });

  it("juda uzun gap so‘z chegarasida «…» bilan qisqartiriladi", () => {
    const uzun = `${"so‘z ".repeat(120)}FRAGMENT ${"keyin ".repeat(120)}oxiri.`;
    const k = kontekstAjratish(uzun, "FRAGMENT")!;
    assert.ok(k.oldin.startsWith("…") && k.oldin.length <= 262, String(k.oldin.length));
    assert.ok(k.keyin.endsWith("…") && k.keyin.length <= 262, String(k.keyin.length));
    assert.ok(!/\s{2}/.test(k.oldin) && !/\s{2}/.test(k.keyin));
  });
});

describe("Ekspertlar tasdig‘i: fragmentlar ustma-ust", () => {
  it("biri ikkinchisini o‘z ichiga oladi (registr va oxirgi tinish belgisi farqi e’tiborsiz)", () => {
    assert.ok(ustmaUst("muammolar muhokama qilindi", "Unda ta’lim tizimidagi muammolar muhokama qilindi."));
    assert.ok(ustmaUst("Yig‘ilish o‘tkazdi.", "yig'ilish o'tkazdi"));
  });
  it("matndagi o‘rinlar kesishadi", () => {
    assert.ok(ustmaUst("tizimidagi muammolar muhokama", "muhokama qilindi, xususan", MATN));
  });
  it("kesishmaydigan yoki bo‘sh fragmentlar — tasdiq emas", () => {
    assert.equal(ustmaUst("yig‘ilish o‘tkazdi", "hech narsa aytilmadi", MATN), false);
    assert.equal(ustmaUst("yig‘ilish", null, MATN), false);
    assert.equal(ustmaUst("", "yig‘ilish", MATN), false);
  });
});

const misol = (q: Partial<Misol>): Misol => ({
  id: 1,
  material_id: 1,
  nashr_id: 1,
  nashr: "Kun.uz",
  turi: "raqamli",
  sana: "2025-03-12",
  janr: "Yangilik",
  sarlavha: "Sarlavha",
  havola: null,
  kategoriya: "abstrakt_jumla",
  kategoriya_nomi: "Abstrakt jumla",
  guruh: "muammo",
  tartib: 0,
  qism: "matn",
  fragment: "fragment",
  izoh: null,
  kontekst: { oldin: "Gap boshi ", fragment: "fragment", keyin: " davomi." },
  toliq: true,
  ekspertlar: 0,
  tasdiq: 0,
  tanlangan: false,
  ...q,
});

describe("Filtrlar", () => {
  it("URL → filtr → URL (noto‘g‘ri qiymatlar tashlanadi)", () => {
    const f = misolFiltriniOqish({
      kategoriya: "abstrakt_jumla",
      qism: "lid",
      turi: "gazeta",
      nashr_id: "3",
      dan: "2025-13",
      toliq: "1",
      tasdiq: "0",
      tartib: "sana",
    });
    assert.deepEqual(
      Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)),
      { kategoriya: "abstrakt_jumla", qism: "lid", nashr_id: 3, toliq: true, tartib: "sana" },
    );
    assert.equal(misolFiltriQatori(f), "kategoriya=abstrakt_jumla&qism=lid&nashr_id=3&toliq=1&tartib=sana");
    assert.deepEqual(misolFiltriniOqish(new URLSearchParams(misolFiltriQatori(f))), f);
  });

  it("qidiruv: gap, izoh va sarlavha bo‘yicha; tutuq belgilari bir xil", () => {
    const ms = [
      misol({ id: 1, kontekst: { oldin: "Ta’lim ", fragment: "o‘qituvchi", keyin: " yetishmaydi." } }),
      misol({ id: 2, izoh: "noaniq ifoda" }),
      misol({ id: 3, sarlavha: "Narxlar oshdi" }),
    ];
    assert.deepEqual(misollarniFiltrlash(ms, { q: "O'QITUVCHI yet" }).map((m) => m.id), [1]);
    assert.deepEqual(misollarniFiltrlash(ms, { q: "noaniq" }).map((m) => m.id), [2]);
    assert.deepEqual(misollarniFiltrlash(ms, { q: "narxlar" }).map((m) => m.id), [3]);
  });

  it("★, ekspert tasdig‘i va to‘liq tahlil filtrlari; kategoriya sanog‘i uchun istisno", () => {
    const ms = [
      misol({ id: 1, tanlangan: true }),
      misol({ id: 2, ekspertlar: 2, tasdiq: 1, kategoriya: "murojaat", guruh: "vosita" }),
      misol({ id: 3, toliq: false }),
    ];
    assert.deepEqual(misollarniFiltrlash(ms, { tanlangan: true }).map((m) => m.id), [1]);
    assert.deepEqual(misollarniFiltrlash(ms, { tasdiq: true }).map((m) => m.id), [2]);
    assert.deepEqual(misollarniFiltrlash(ms, { toliq: true }).map((m) => m.id).sort(), [1, 2]);
    assert.deepEqual(misollarniFiltrlash(ms, { kategoriya: "murojaat" }).map((m) => m.id), [2]);
    assert.equal(misollarniFiltrlash(ms, { kategoriya: "murojaat" }, "kategoriya").length, 3);
    assert.deepEqual(misollarniFiltrlash(ms, { guruh: "vosita" }).map((m) => m.id), [2]);
  });

  it("saralash: ekspertlar tasdig‘i ulushi bo‘yicha, ekspertsizlar oxirida", () => {
    const ms = [
      misol({ id: 1, ekspertlar: 0 }),
      misol({ id: 2, ekspertlar: 3, tasdiq: 1 }),
      misol({ id: 3, ekspertlar: 2, tasdiq: 2 }),
    ];
    assert.deepEqual(misollarniFiltrlash(ms, { tartib: "tasdiq" }).map((m) => m.id), [3, 2, 1]);
  });
});

const MT: WordMatnlari = {
  kategoriya: (m) => m.kategoriya_nomi,
  sana: (iso) => iso.split("-").reverse().join("."),
  qoshtirnoq: ["«", "»"],
  ichki: ["„", "“"],
};
const SOZ: WordSozlama = {
  gap: true,
  ajratish: "qalin",
  raqamlash: "qavs",
  boshlangich: 1,
  guruhlash: false,
  sarlavhaBilan: false,
  izohBilan: false,
  olchamPt: 14,
};

describe("Word ro‘yxati", () => {
  it("raqam, butun gap, fragment qalin, manba (nashr, sana)", () => {
    const r = wordRoyxati([misol({})], SOZ, MT);
    assert.equal(r.matn, "(1) «Gap boshi fragment davomi.» (Kun.uz, 12.03.2025)");
    assert.match(r.tana, /\(1\) «Gap boshi <b>fragment<\/b> davomi\.» \(Kun\.uz, 12\.03\.2025\)/);
    assert.match(r.tana, /font-family:'Times New Roman',serif;font-size:14pt;line-height:1\.5/);
    assert.ok(r.html.startsWith("<!DOCTYPE html>"));
  });

  it("boshlang‘ich raqam, nuqtali raqamlash, faqat fragment, kursiv", () => {
    const r = wordRoyxati([misol({ id: 1 }), misol({ id: 2, fragment: "ikkinchi" })], { ...SOZ, gap: false, raqamlash: "nuqta", boshlangich: 7 }, MT);
    assert.equal(r.matn, "7. «fragment» (Kun.uz, 12.03.2025)\n8. «ikkinchi» (Kun.uz, 12.03.2025)");
    assert.doesNotMatch(r.tana, /<b>/);
    const k = wordRoyxati([misol({})], { ...SOZ, ajratish: "kursiv" }, MT);
    assert.match(k.tana, /<i>fragment<\/i>/);
  });

  it("ichki qo‘shtirnoqlar „…“ ga almashtiriladi, HTML belgilar ekranlanadi", () => {
    const r = wordRoyxati(
      [misol({ kontekst: { oldin: "«Kun.uz» <saytida> ", fragment: "A & B", keyin: "." }, sarlavha: "«Iqtibos»" })],
      { ...SOZ, sarlavhaBilan: true },
      MT,
    );
    assert.equal(r.matn, "(1) «„Kun.uz“ <saytida> A & B.» (Kun.uz, 12.03.2025, «„Iqtibos“»)");
    assert.match(r.tana, /&lt;saytida&gt; <b>A &amp; B<\/b>/);
    assert.doesNotMatch(r.tana, /<saytida>/);
  });

  it("kategoriya bo‘yicha guruhlash va izoh; raqamlash guruhlar orasida uzluksiz", () => {
    const ms = [
      misol({ id: 1, kategoriya: "b", kategoriya_nomi: "Ikkinchi kategoriya", tartib: 2 }),
      misol({ id: 2, kategoriya: "a", kategoriya_nomi: "Birinchi kategoriya", tartib: 1, izoh: "izoh matni" }),
    ];
    const r = wordRoyxati(ms, { ...SOZ, guruhlash: true, izohBilan: true, gap: false }, MT);
    assert.equal(
      r.matn,
      "Birinchi kategoriya\n(1) «fragment» (Kun.uz, 12.03.2025) — izoh matni\n\nIkkinchi kategoriya\n(2) «fragment» (Kun.uz, 12.03.2025)",
    );
    assert.match(r.tana, /<b>Birinchi kategoriya<\/b>/);
    assert.match(r.tana, /<i> — izoh matni<\/i>/);
  });

  it("kontekst topilmagan misol «butun gap» rejimida ham fragment bilan chiqadi; cheklov", () => {
    const ms = [misol({ kontekst: null, fragment: "topilmagan" }), misol({ id: 2 }), misol({ id: 3 })];
    const r = wordRoyxati(ms, SOZ, MT, 2);
    assert.equal(r.matn.split("\n").length, 2);
    assert.match(r.matn, /^\(1\) «topilmagan»/);
  });
});
