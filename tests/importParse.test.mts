// Import tahlilchisining testlari: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ajratgichniAniqlash,
  csvTahlil,
  kalitNormallash,
  matnniDekodlash,
  nashrKaliti,
  sananiNormallash,
  sarlavhaKaliti,
  turniTanish,
  turTaxmini,
  ustunlarniAniqlash,
} from "../lib/importParse.ts";

describe("CSV", () => {
  it("ajratgichni aniqlaydi: vergul, nuqtali vergul, tab", () => {
    assert.equal(ajratgichniAniqlash("a,b,c\n1,2,3"), ",");
    assert.equal(ajratgichniAniqlash("a;b;c\n1;2;3"), ";");
    assert.equal(ajratgichniAniqlash("a\tb\tc"), "\t");
    assert.equal(ajratgichniAniqlash('"x;y",b,c'), ",");
  });
  it("qo‘shtirnoq, qator ko‘chishi va \"\" ni to‘g‘ri o‘qiydi", () => {
    const q = csvTahlil('sarlavha;lid\n"Birinchi; sarlavha";"Ikki\nqatorli ""lid"""\r\nOddiy;x\n\n');
    assert.deepEqual(q, [
      ["sarlavha", "lid"],
      ["Birinchi; sarlavha", 'Ikki\nqatorli "lid"'],
      ["Oddiy", "x"],
    ]);
  });
  it("oxirgi qator yangi qatorsiz tugasa ham o‘qiladi", () => {
    assert.deepEqual(csvTahlil("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
  });
});

describe("Kodirovka", () => {
  it("UTF-8 (BOM bilan)", () => {
    const bayt = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("O‘zbek matn")]);
    assert.deepEqual(matnniDekodlash(bayt), { matn: "O‘zbek matn", kodirovka: "utf-8" });
  });
  it("Windows-1251 (Excel CSV)", () => {
    // «Заголовок» windows-1251 da
    const bayt = new Uint8Array([0xc7, 0xe0, 0xe3, 0xee, 0xeb, 0xee, 0xe2, 0xee, 0xea]);
    assert.deepEqual(matnniDekodlash(bayt), { matn: "Заголовок", kodirovka: "windows-1251" });
  });
});

describe("Ustunlarni tanish", () => {
  it("lotin, kirill, rus va ingliz nomlari", () => {
    const { xarita, tanilmagan } = ustunlarniAniqlash([
      "Nashr", "Sana", "Жанр", "Мавзу", "URL", "Sarlavha", "Лид", "Asosiy matn", "Izoh",
    ]);
    assert.deepEqual(xarita, { nashr: 0, sana: 1, janr: 2, mavzu: 3, havola: 4, sarlavha: 5, lid: 6, matn: 7 });
    assert.deepEqual(tanilmagan, ["Izoh"]);
  });
  it("tutuq belgisi va registrga e’tibor bermaydi", () => {
    assert.equal(kalitNormallash("  SARLAVҲA  "), "sarlavҳa");
    assert.deepEqual(ustunlarniAniqlash(["Media turi", "ЗАГОЛОВОК"]).xarita, { turi: 0, sarlavha: 1 });
  });
  it("bir xil maydon ikki marta uchrasa, ikkinchisi tanilmagan hisoblanadi", () => {
    const r = ustunlarniAniqlash(["sarlavha", "title"]);
    assert.deepEqual(r.xarita, { sarlavha: 0 });
    assert.deepEqual(r.tanilmagan, ["title"]);
  });
});

describe("Sana", () => {
  it("turli formatlar", () => {
    assert.equal(sananiNormallash("2025-03-15").sana, "2025-03-15");
    assert.equal(sananiNormallash("15.03.2025").sana, "2025-03-15");
    assert.equal(sananiNormallash("5/3/2025").sana, "2025-03-05");
    assert.equal(sananiNormallash("2025.3.5").sana, "2025-03-05");
    assert.equal(sananiNormallash("15.03.2025 10:30").sana, "2025-03-15");
  });
  it("Excel: Date obyekti va seriya raqami", () => {
    assert.equal(sananiNormallash(new Date(Date.UTC(2025, 2, 15))).sana, "2025-03-15");
    assert.equal(sananiNormallash(45731).sana, "2025-03-15");
    assert.equal(sananiNormallash("45731").sana, "2025-03-15");
  });
  it("bo‘sh — xato emas; noto‘g‘ri — xato", () => {
    assert.deepEqual(sananiNormallash(""), { sana: null, xato: false });
    assert.deepEqual(sananiNormallash(null), { sana: null, xato: false });
    assert.equal(sananiNormallash("31.02.2025").xato, true);
    assert.equal(sananiNormallash("mart oyi").xato, true);
  });
});

describe("Solishtirish va media turi", () => {
  it("nashr va sarlavha kalitlari", () => {
    assert.equal(nashrKaliti("  Kun.UZ "), "kun.uz");
    assert.equal(nashrKaliti("Sharq  yulduzi"), nashrKaliti("sharq yulduzi"));
    assert.equal(sarlavhaKaliti("«Toshkentda» yangi  bog‘!"), sarlavhaKaliti("Toshkentda yangi bog’"));
  });
  it("media turi", () => {
    assert.equal(turTaxmini("Kun.uz"), "raqamli");
    assert.equal(turTaxmini("Adolat"), "bosma");
    assert.equal(turniTanish("Raqamli"), "raqamli");
    assert.equal(turniTanish("печатное"), "bosma");
    assert.equal(turniTanish("noma’lum"), null);
  });
});
