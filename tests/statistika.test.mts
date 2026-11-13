// Statistika modulining testlari: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  alphaTalqini,
  chiKvadratP,
  cv,
  foizKelishuv,
  kendallW,
  krippendorffAlpha,
  mediana,
  ortachaFarq,
  ranglash,
  sd,
  yarimgaYaxlitlash,
} from "../lib/statistika.ts";

const yaqin = (haqiqiy: number | null, kutilgan: number, aniqlik = 0.001) =>
  assert.ok(haqiqiy != null && Math.abs(haqiqiy - kutilgan) < aniqlik, `${haqiqiy} ≠ ${kutilgan}`);

// Krippendorff (2011) maqolasidagi namuna: 4 kuzatuvchi, 12 birlik, tushib qolgan qiymatlar bilan.
// Qatorlar — kuzatuvchilar, ustunlar — birliklar.
const _ = null;
const KUZATUVCHILAR = [
  [1, 2, 3, 3, 2, 1, 4, 1, 2, _, _, _],
  [1, 2, 3, 3, 2, 2, 4, 1, 2, 5, _, 3],
  [_, 3, 3, 3, 2, 3, 4, 2, 2, 5, 1, _],
  [1, 2, 3, 3, 2, 4, 4, 1, 2, 5, 1, _],
];
const BIRLIKLAR = KUZATUVCHILAR[0].map((__, j) => KUZATUVCHILAR.map((q) => q[j]));

describe("Krippendorff α", () => {
  it("nominal: 0,743 (Krippendorff, 2011)", () => {
    yaqin(krippendorffAlpha(BIRLIKLAR, "nominal").alpha, 0.743);
  });
  it("ordinal: 0,815 (Krippendorff, 2011)", () => {
    yaqin(krippendorffAlpha(BIRLIKLAR, "ordinal").alpha, 0.815);
  });
  it("interval: 0,849 (Krippendorff, 2011)", () => {
    yaqin(krippendorffAlpha(BIRLIKLAR, "interval").alpha, 0.849);
  });
  it("faqat bitta qiymatli birlik hisobga olinmaydi", () => {
    const r = krippendorffAlpha(BIRLIKLAR, "nominal");
    assert.equal(r.birliklar, 11); // 12-birlikda faqat bitta qiymat
    assert.equal(r.qiymatlar, 40);
  });
  it("to‘liq kelishuv — 1", () => {
    yaqin(krippendorffAlpha([["a", "a"], ["b", "b"], ["a", "a", "a"]], "nominal").alpha, 1);
  });
  it("barcha qiymatlar bir xil — α aniqlanmaydi", () => {
    assert.equal(krippendorffAlpha([["mos", "mos"], ["mos", "mos"]], "nominal").alpha, null);
  });
  it("juftlanuvchi qiymat yo‘q — α aniqlanmaydi", () => {
    assert.equal(krippendorffAlpha([["a"], [null, "b"]], "nominal").alpha, null);
  });
  it("talqin chegaralari", () => {
    assert.equal(alphaTalqini(0.8), "ishonchli");
    assert.equal(alphaTalqini(0.7), "shartli");
    assert.equal(alphaTalqini(0.5), "ishonchsiz");
    assert.equal(alphaTalqini(null), null);
  });
});

describe("Foizli kelishuv va o‘rtacha farq", () => {
  it("juftlar ulushi birliklar bo‘yicha o‘rtachalanadi", () => {
    // 1-birlik: 3 juftdan 1 tasi mos (1/3); 2-birlik: to‘liq mos (1)
    yaqin(foizKelishuv([["a", "a", "b"], ["c", "c"]]), (1 / 3 + 1) / 2);
  });
  it("o‘rtacha mutlaq farq", () => {
    // 1-birlik: |70−80| = 10; 2-birlik: (|50−60| + |50−70| + |60−70|)/3 = 40/3
    yaqin(ortachaFarq([[70, 80], [50, 60, 70]]), (10 + 40 / 3) / 2);
  });
});

describe("Kendall W", () => {
  it("to‘liq kelishuv — W = 1", () => {
    const r = kendallW([
      [30, 25, 20, 15, 10],
      [35, 25, 20, 12, 8],
      [40, 30, 15, 10, 5],
    ]);
    yaqin(r?.W ?? null, 1);
    assert.deepEqual(r?.ortachaRang, [1, 2, 3, 4, 5]);
  });
  it("qarama-qarshi reytinglar — W = 0", () => {
    const r = kendallW([
      [50, 40, 30, 20, 10],
      [10, 20, 30, 40, 50],
    ]);
    yaqin(r?.W ?? null, 0);
    yaqin(r?.p ?? null, 1);
  });
  it("teng vaznlar o‘rtacha rang oladi, W 0 va 1 oralig‘ida", () => {
    assert.deepEqual(ranglash([25, 25, 20, 15, 15]).ranglar, [1.5, 1.5, 3, 4.5, 4.5]);
    const r = kendallW([
      [25, 25, 20, 15, 15],
      [30, 20, 20, 15, 15],
      [25, 25, 25, 15, 10],
    ]);
    assert.ok(r && r.W > 0 && r.W < 1);
  });
  it("bitta ekspert — hisoblanmaydi", () => {
    assert.equal(kendallW([[25, 25, 20, 15, 15]]), null);
  });
});

describe("χ² taqsimoti", () => {
  it("kritik qiymatlar: p = 0,05", () => {
    yaqin(chiKvadratP(3.841, 1), 0.05);
    yaqin(chiKvadratP(9.488, 4), 0.05);
  });
  it("p = 0,01", () => {
    yaqin(chiKvadratP(13.277, 4), 0.01);
  });
});

describe("Oddiy statistika", () => {
  it("mediana, sd, cv", () => {
    assert.equal(mediana([3, 1, 2]), 2);
    assert.equal(mediana([4, 1, 2, 3]), 2.5);
    yaqin(sd([2, 4, 4, 4, 5, 5, 7, 9]), 2.138);
    yaqin(cv([10, 20, 30]), 50);
  });
  it("0,5 qadamli yaxlitlash yig‘indini 100 da saqlaydi", () => {
    const v = yarimgaYaxlitlash([25.3, 24.9, 20.1, 14.8, 14.9]);
    assert.equal(v.reduce((a, b) => a + b, 0), 100);
    assert.ok(v.every((x) => (x * 2) % 1 === 0));
    assert.deepEqual(yarimgaYaxlitlash([100 / 3, 100 / 3, 100 / 3]).reduce((a, b) => a + b, 0), 100);
  });
});
