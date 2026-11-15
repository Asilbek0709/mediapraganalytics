// Davrlarni taqqoslash va reyting testlari: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  davrKaliti,
  davrNomi,
  davrTakliflari,
  davrTaqqoslash,
  oraliqmi,
  type AnalitikaMateriali,
} from "../lib/davrlar.ts";
import { materialReytingi, nashrReytingi, orinlar } from "../lib/reyting.ts";
import { fisherAniq, holm, mannWhitney } from "../lib/statistika.ts";

let id = 0;
const mat = (sana: string | null, lpsi: number | null, q: Partial<AnalitikaMateriali> = {}): AnalitikaMateriali => ({
  id: ++id,
  nashr_id: 1,
  nashr: "Kun.uz",
  media_turi: "raqamli",
  sana,
  janr: "Yangilik",
  sarlavha: `Sarlavha ${id}`,
  k1: lpsi,
  k2: lpsi,
  k3: lpsi,
  k4: lpsi,
  k5: lpsi,
  lpsi,
  daraja: null,
  sanoq: {},
  ...q,
});

describe("Davr takliflari", () => {
  it("ketma-ket yillar (yangisi birinchi) va «teng ikkiga» bo‘linish", () => {
    const sanalar = ["2023-05-01", "2024-02-10", "2024-03-01", "2025-01-15", "2025-06-30", "2025-07-01", null];
    const tk = davrTakliflari(sanalar);
    assert.deepEqual(
      tk.filter((x) => x.tur === "yillar").map((x) => [davrKaliti(x.a), davrKaliti(x.b)]),
      [
        ["2024", "2025"],
        ["2023", "2024"],
      ],
    );
    const teng = tk.find((x) => x.tur === "teng")!;
    assert.deepEqual(teng.a, { dan: "2023-05-01", gacha: "2024-03-01" });
    assert.deepEqual(teng.b, { dan: "2025-01-15", gacha: "2025-07-01" });
  });

  it("bir kundagi materiallar ikki davrga bo‘linmaydi", () => {
    const tk = davrTakliflari(["2025-03-01", "2025-03-01", "2025-03-01", "2025-04-01"]);
    const teng = tk.find((x) => x.tur === "teng")!;
    assert.deepEqual(teng, { tur: "teng", a: { dan: "2025-03-01", gacha: "2025-03-01" }, b: { dan: "2025-04-01", gacha: "2025-04-01" } });
    assert.deepEqual(davrTakliflari(["2025-03-01", "2025-03-01"]), []);
    assert.deepEqual(davrTakliflari([null, "noto‘g‘ri"]), []);
  });

  it("davr nomi: butun yil, butun oy (kabisa yili ham), aks holda sanalar", () => {
    const davr = (k: string) => (k.length === 4 ? k : `oy:${k}`);
    assert.equal(davrNomi({ dan: "2025-01-01", gacha: "2025-12-31" }, davr), "2025");
    assert.equal(davrNomi({ dan: "2024-02-01", gacha: "2024-02-29" }, davr), "oy:2024-02");
    assert.equal(davrKaliti({ dan: "2025-02-01", gacha: "2025-02-28" }), "2025-02");
    assert.equal(davrKaliti({ dan: "2025-02-01", gacha: "2025-02-27" }), null);
    assert.equal(davrNomi({ dan: "2025-03-01", gacha: "2025-04-15" }, davr), "01.03.2025–15.04.2025");
    assert.ok(oraliqmi({ dan: "2025-01-01", gacha: "2025-01-01" }));
    assert.ok(!oraliqmi({ dan: "2025-02-01", gacha: "2025-01-01" }));
    assert.ok(!oraliqmi({ dan: "2025-02-01" }));
  });
});

describe("Ikki davrni taqqoslash", () => {
  const A = { dan: "2024-01-01", gacha: "2024-12-31" };
  const B = { dan: "2025-01-01", gacha: "2025-12-31" };
  const muammolar = [
    { kod: "abstrakt", nomi: "Abstrakt jumla" },
    { kod: "uslubiy", nomi: "Uslubiy xato" },
  ];
  const a = [52, 58, 61, 64, 70];
  const b = [66, 71, 74, 79, 83, 88];
  const materiallar = [
    // chegaralar ham kiradi
    ...a.map((v, i) => mat(i === 0 ? "2024-01-01" : `2024-0${i + 1}-10`, v, { sanoq: i < 4 ? { abstrakt: 1 } : {} })),
    ...b.map((v, i) => mat(i === 5 ? "2025-12-31" : `2025-0${i + 1}-10`, v, { sanoq: i === 0 ? { abstrakt: 2, uslubiy: 1 } : {} })),
    mat(null, 99),
    mat("2023-06-01", 10),
  ];

  it("guruhlar, o‘rtacha, farq va Mann–Whitney — to‘g‘ridan-to‘g‘ri hisob bilan bir xil", () => {
    const d = davrTaqqoslash(materiallar, A, B, muammolar);
    assert.equal(d.a.n, 5);
    assert.equal(d.b.n, 6);
    assert.equal(d.sanasiz, 1);
    assert.equal(d.kesishadi, false);
    const lpsi = d.qatorlar.find((q) => q.korsatkich === "lpsi")!;
    assert.equal(lpsi.a.ortacha, 61);
    assert.equal(lpsi.b.ortacha, 76.8);
    assert.equal(lpsi.farq, 15.8);
    assert.equal(lpsi.a.mediana, 61);
    assert.deepEqual(lpsi.test, mannWhitney(b, a));
    assert.ok(lpsi.test!.p < 0.05 && lpsi.test!.r > 0, "B yuqori → r > 0 (farq B − A bilan bir ishorada)");
    // A yuqori bo‘lgan holat — r manfiy
    const teskari = davrTaqqoslash(materiallar, B, A, muammolar).qatorlar.find((q) => q.korsatkich === "lpsi")!;
    assert.ok(teskari.test!.r < 0 && teskari.farq! < 0);
  });

  it("muammolar ulushi: Fisher va Holm tuzatishi", () => {
    const d = davrTaqqoslash(materiallar, A, B, muammolar);
    const [abs, usl] = d.muammolar;
    assert.deepEqual(abs.a, { bor: 4, n: 5, ulush: 80 });
    assert.deepEqual(abs.b, { bor: 1, n: 6, ulush: 16.7 });
    assert.equal(abs.farq, -63.3);
    assert.equal(abs.p, fisherAniq(4, 1, 1, 5));
    assert.deepEqual(
      d.muammolar.map((q) => q.pHolm),
      holm([fisherAniq(4, 1, 1, 5), fisherAniq(0, 5, 1, 5)]),
    );
    assert.equal(usl.b.bor, 1);
  });

  it("kesishgan davrlar va kichik guruhlarda testlar o‘tkazilmaydi", () => {
    const k = davrTaqqoslash(materiallar, A, { dan: "2024-06-01", gacha: "2025-12-31" }, muammolar);
    assert.equal(k.kesishadi, true);
    assert.ok(k.qatorlar.every((q) => q.test === null));
    assert.ok(k.muammolar.every((q) => q.pHolm === 1));
    const kichik = davrTaqqoslash(materiallar, { dan: "2023-01-01", gacha: "2023-12-31" }, B, muammolar);
    assert.equal(kichik.a.n, 1);
    assert.ok(kichik.qatorlar.every((q) => q.test === null));
    assert.equal(kichik.qatorlar[5].a.ortacha, 10, "tavsifiy qiymatlar baribir hisoblanadi");
  });
});

describe("Reyting", () => {
  it("o‘rinlar: tenglar bir o‘rinda, keyingisi o‘tkazib yuboriladi; 0,1 gacha yaxlitlanadi", () => {
    assert.deepEqual(orinlar([80, 90, 90, null, 70]), [3, 1, 1, null, 4]);
    assert.deepEqual(orinlar([85.04, 85, 84.96, 85.2]), [2, 2, 2, 1]);
    assert.deepEqual(orinlar([]), []);
  });

  it("nashrlar: tartib, «=» belgisi, kam materialli nashr, daraja faqat LPSI uchun", () => {
    const kesim = (nomi: string, soni: number, lpsi: number | null, k1: number | null, turi: "bosma" | "raqamli" = "bosma") => ({
      nomi, media_turi: turi, soni, k1, k2: null, k3: null, k4: null, k5: null, lpsi, daraja: lpsi == null ? null : "yaxshi", ulushlar: {},
    });
    const n = [kesim("A", 5, 70, 90), kesim("B", 2, 80, 60), kesim("C", 6, 70, 75, "raqamli"), kesim("D", 4, null, 50)];
    const r = nashrReytingi(n, "lpsi");
    assert.deepEqual(r.map((x) => [x.orin, x.nomi, x.teng, x.kam]), [
      [1, "B", false, true],
      [2, "C", true, false],
      [2, "A", true, false],
    ]);
    assert.equal(r[0].daraja, "yaxshi");
    assert.deepEqual(nashrReytingi(n, "k1").map((x) => [x.orin, x.nomi, x.daraja]), [
      [1, "A", null],
      [2, "C", null],
      [3, "B", null],
      [4, "D", null],
    ]);
  });

  it("materiallar: ≤ 20 — bitta ro‘yxat; ko‘p bo‘lsa — eng yuqori va eng past 10 tadan (eng pasti birinchi)", () => {
    const oz = Array.from({ length: 12 }, (_, i) => mat("2025-01-01", 50 + i));
    const r1 = materialReytingi(oz, "lpsi");
    assert.equal(r1.toliq, true);
    assert.equal(r1.yuqori.length, 12);
    assert.equal(r1.yuqori[0].qiymat, 61);

    const kop = [...Array.from({ length: 25 }, (_, i) => mat("2025-01-01", 40 + i * 2)), mat("2025-01-01", null)];
    const r2 = materialReytingi(kop, "lpsi");
    assert.equal(r2.toliq, false);
    assert.deepEqual(r2.yuqori.map((x) => x.orin), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(r2.yuqori[0].qiymat, 88);
    assert.deepEqual(r2.past.map((x) => x.qiymat).slice(0, 3), [40, 42, 44]);
    assert.equal(r2.past[0].orin, 25);
    const idlar = new Set([...r2.yuqori, ...r2.past].map((x) => x.m.id));
    assert.equal(idlar.size, 20, "ro‘yxatlar kesishmaydi");
  });
});
