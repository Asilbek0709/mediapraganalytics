// Dissertatsiya rasmlari (SVG va PNG dpi) testlari: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { crc32, faylNomi, pngDpi, qadamlar, rasmSvg, sindirish, type Rasm, type RasmSozlama } from "../lib/rasm.ts";

const bayt = (s: string) => new TextEncoder().encode(s);
const son = (x: number | null | undefined, kasr = 1) =>
  x == null ? "—" : Number(x).toFixed(kasr).replace(/\.0+$/, "").replace(".", ",");
const SOZLAMA: RasmSozlama = { kengSm: 16, shrift: "Times New Roman", olchamPt: 11, rangli: true, son };

/** Teglar muvozanatini tekshiradi (oddiy XML to‘g‘riligi). */
function tegMuvozanati(svg: string) {
  const stek: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    const [, yopish, nom, ozi] = m;
    if (ozi) continue;
    if (yopish) assert.equal(stek.pop(), nom, `</${nom}> kutilmagan joyda`);
    else stek.push(nom);
  }
  assert.deepEqual(stek, []);
}

function pngYasash(qoshimcha: Uint8Array[] = []): Uint8Array {
  const bolak = (tur: string, data: Uint8Array) => {
    const b = new Uint8Array(12 + data.length);
    const dv = new DataView(b.buffer);
    dv.setUint32(0, data.length);
    b.set(bayt(tur), 4);
    b.set(data, 8);
    dv.setUint32(8 + data.length, crc32(b.subarray(4, 8 + data.length)));
    return b;
  };
  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, 1);
  new DataView(ihdr.buffer).setUint32(4, 1);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const qismlar = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    bolak("IHDR", ihdr),
    ...qoshimcha.map((d) => bolak("pHYs", d)),
    bolak("IDAT", new Uint8Array([1, 2, 3])),
    bolak("IEND", new Uint8Array()),
  ];
  const natija = new Uint8Array(qismlar.reduce((s, q) => s + q.length, 0));
  let o = 0;
  for (const q of qismlar) {
    natija.set(q, o);
    o += q.length;
  }
  return natija;
}

function bolaklar(png: Uint8Array) {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const natija: { tur: string; data: Uint8Array; crcTogri: boolean }[] = [];
  for (let i = 8; i < png.length; ) {
    const len = dv.getUint32(i);
    const tur = String.fromCharCode(...png.subarray(i + 4, i + 8));
    const data = png.subarray(i + 8, i + 8 + len);
    natija.push({ tur, data, crcTogri: dv.getUint32(i + 8 + len) === crc32(png.subarray(i + 4, i + 8 + len)) });
    i += 12 + len;
  }
  return natija;
}

describe("CRC32 va PNG dpi", () => {
  it("CRC32 standart nazorat qiymatlari", () => {
    assert.equal(crc32(bayt("123456789")), 0xcbf43926);
    assert.equal(crc32(bayt("IEND")), 0xae426082);
  });

  it("pHYs IHDR’dan keyin qo‘shiladi va 300 dpi = 11811 piksel/m", () => {
    const b = bolaklar(pngDpi(pngYasash(), 300));
    assert.deepEqual(b.map((x) => x.tur), ["IHDR", "pHYs", "IDAT", "IEND"]);
    assert.ok(b.every((x) => x.crcTogri));
    const dv = new DataView(b[1].data.buffer, b[1].data.byteOffset, 9);
    assert.equal(dv.getUint32(0), 11811);
    assert.equal(dv.getUint32(4), 11811);
    assert.equal(b[1].data[8], 1);
  });

  it("mavjud pHYs almashtiriladi (ikki marta yozilmaydi)", () => {
    const eski = new Uint8Array(9);
    new DataView(eski.buffer).setUint32(0, 2835);
    new DataView(eski.buffer).setUint32(4, 2835);
    eski[8] = 1;
    const b = bolaklar(pngDpi(pngYasash([eski]), 600));
    assert.equal(b.filter((x) => x.tur === "pHYs").length, 1);
    assert.equal(new DataView(b[1].data.buffer, b[1].data.byteOffset, 9).getUint32(0), 23622);
  });
});

describe("O‘q bo‘linmalari va matnni sindirish", () => {
  it("yaxlit qadamlar", () => {
    assert.deepEqual(qadamlar(100), [0, 20, 40, 60, 80, 100]);
    assert.deepEqual(qadamlar(13, true), [0, 5, 10, 15]);
    assert.deepEqual(qadamlar(3, true), [0, 1, 2, 3]);
    assert.deepEqual(qadamlar(0.7), [0, 0.2, 0.4, 0.6, 0.8]);
  });

  it("qatorlar kenglikdan oshmaydi, ortiqchasi «…» bilan", () => {
    const o = (s: string) => s.length * 10;
    assert.deepEqual(sindirish("bir ikki uch", 80, o), ["bir ikki", "uch"]);
    const q = sindirish("Lisoniy-uslubiy me’yor va kontekstual nomuvofiqlik tahlili", 120, o, 2);
    assert.equal(q.length, 2);
    assert.ok(q.every((x) => o(x) <= 120));
    assert.ok(q[1].endsWith("…"));
  });

  it("so‘z bo‘linganda oxirgi bo‘lak kamida 3 harf", () => {
    const o = (s: string) => s.length * 10;
    const q = sindirish("Оценочный", 85, o, 3);
    assert.ok(q.length > 1);
    assert.ok([...q[q.length - 1]].length >= 3, JSON.stringify(q));
    assert.ok(q.slice(0, -1).every((x) => x.endsWith("-")));
    assert.equal(q.join("").replace(/-/g, ""), "Оценочный");
  });

  it("chiziqcha bo‘yicha bo‘linadi va bo‘sh joysiz qo‘shiladi", () => {
    const o = (s: string) => s.length * 10;
    assert.deepEqual(sindirish("Lisoniy-uslubiy xato", 90, o, 3), ["Lisoniy-", "uslubiy", "xato"]);
  });

  it("fayl nomi: kirill saqlanadi, belgilar almashtiriladi", () => {
    assert.equal(faylNomi("Динамика: LPSI / месяц"), "MediaPrag_Динамика_LPSI_месяц");
    assert.equal(faylNomi("???"), "MediaPrag_rasm");
  });
});

const RASMLAR: Rasm[] = [
  {
    tur: "gorizontal",
    qatorlar: [
      { nomi: "Kun.uz & Daryo", qiymat: 72.4, rang: 1 },
      { nomi: "Sharq yulduzi", qiymat: 64, rang: 0 },
      { nomi: "Ma’lumotsiz nashr", qiymat: null },
    ],
    max: 100,
    legend: [
      { nomi: "Bosma", rang: 0 },
      { nomi: "Raqamli", rang: 1 },
    ],
  },
  {
    tur: "guruhli",
    toifalar: ["K1", "K2", "K3", "K4", "K5", "LPSI"],
    seriyalar: [
      { nomi: "Bosma (15)", qiymatlar: [80, 85.5, 90, 70, 60, 78.2] },
      { nomi: "Raqamli (15)", qiymatlar: [75, 90, 95, null, 55, 80] },
    ],
    max: 100,
  },
  {
    tur: "ustun",
    ustunlar: [
      { nomi: "past (0–40)", qiymat: 2, rang: 0 },
      { nomi: "qoniqarli (40–60)", qiymat: 5, rang: 1 },
      { nomi: "yaxshi (60–80)", qiymat: 13, rang: 2 },
      { nomi: "yuqori (80–100)", qiymat: 10, rang: 3 },
    ],
    darajalar: 4,
  },
  {
    tur: "issiqlik",
    birinchiUstun: "Nashr",
    soniUstuni: "Soni",
    ustunlar: ["Abstrakt jumla", "Semantik noaniqlik", "Mantiqiy noaniqlik"],
    qatorlar: [
      { nomi: "Kun.uz", soni: 5, qiymatlar: [100, 20, null] },
      { nomi: "Adolat", izoh: "muammo", soni: 5, qiymatlar: [0, 40, 60] },
    ],
    max: 100,
    suffix: "%",
    ton: "qizil",
    shkala: { past: "kam", yuqori: "ko‘p" },
  },
  {
    tur: "chiziq",
    davrlar: ["Yanvar 2025", "Fevral 2025", "Mart 2025", "Aprel 2025"],
    seriyalar: [
      { nomi: "Barcha media", qiymatlar: [70, 72.5, null, 75] },
      { nomi: "Bosma", qiymatlar: [68, null, 71, 73] },
    ],
    max: 100,
  },
];

describe("SVG rasmlar", () => {
  for (const r of RASMLAR) {
    for (const rangli of [true, false]) {
      it(`${r.tur} (${rangli ? "rangli" : "oq-qora"}): to‘g‘ri SVG, 16 sm, NaN yo‘q`, () => {
        const n = rasmSvg(r, { ...SOZLAMA, rangli, sarlavha: "2.1-rasm. Sinov & tekshiruv" });
        assert.ok(n.svg.startsWith("<svg "));
        assert.match(n.svg, /width="16cm"/);
        assert.doesNotMatch(n.svg, /NaN|undefined|Infinity/);
        assert.match(n.svg, /Sinov &amp; tekshiruv/);
        tegMuvozanati(n.svg);
        assert.ok(n.balandSm > 3 && n.balandSm < 25, `balandlik ${n.balandSm} sm`);
        if (!rangli) assert.doesNotMatch(n.svg, /#1F4E79|#C55A11|#9C2B2B/);
      });
    }
  }

  it("o‘nli vergul va foiz belgisi: tanlangan til formati", () => {
    const n = rasmSvg(RASMLAR[0], SOZLAMA);
    assert.match(n.svg, />72,4</);
    assert.match(rasmSvg(RASMLAR[3], SOZLAMA).svg, />100%</);
  });

  it("issiqlik: to‘q katakda oq matn", () => {
    const svg = rasmSvg(RASMLAR[3], SOZLAMA).svg;
    assert.match(svg, /fill="#FFFFFF"[^>]*>100%</);
  });

  it("issiqlik: guruh sarlavhasi har guruh uchun bir marta", () => {
    const svg = rasmSvg(
      {
        tur: "issiqlik",
        birinchiUstun: "Kategoriya",
        ustunlar: ["Sarlavha", "Lid", "Matn"],
        qatorlar: [
          { nomi: "A", guruh: "Muammolar", qiymatlar: [1, 2, 3] },
          { nomi: "B", guruh: "Muammolar", qiymatlar: [0, 1, 0] },
          { nomi: "C", guruh: "Pragmatik vositalar", qiymatlar: [2, 0, 1] },
        ],
        max: 3,
        ton: "qizil",
        shkala: { past: "kam", yuqori: "ko‘p" },
      },
      SOZLAMA,
    ).svg;
    assert.equal(svg.match(/>Muammolar</g)?.length, 1);
    assert.equal(svg.match(/>Pragmatik vositalar</g)?.length, 1);
    tegMuvozanati(svg);
  });

  it("qatorlar ko‘paysa rasm balandlashadi, kenglik o‘zgarmaydi", () => {
    const r = RASMLAR[0] as Extract<Rasm, { tur: "gorizontal" }>;
    const kop = { ...r, qatorlar: [...r.qatorlar, ...r.qatorlar, ...r.qatorlar] };
    const a = rasmSvg(r, SOZLAMA);
    const b = rasmSvg(kop, SOZLAMA);
    assert.ok(b.balandlik > a.balandlik);
    assert.equal(a.kenglik, b.kenglik);
  });
});
