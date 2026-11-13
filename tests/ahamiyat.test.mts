// Guruhlarni taqqoslash testlari (Mann–Whitney, Kruskal–Wallis, Dunn, Fisher): npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dunn,
  epsilonEffekti,
  fisherAniq,
  holm,
  kruskalWallis,
  mannWhitney,
  normalDum,
  rEffekti,
} from "../lib/statistika.ts";

const yaqin = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b} (±${eps}) bo‘lishi kerak`);

/** Testning o‘zidagi mustaqil ranglash (o‘sish tartibida, bog‘lanishga o‘rtacha rang). */
function ranglar(xs: number[]): number[] {
  const s = [...xs].sort((a, b) => a - b);
  return xs.map((x) => {
    const birinchi = s.indexOf(x) + 1;
    const oxirgi = s.lastIndexOf(x) + 1;
    return (birinchi + oxirgi) / 2;
  });
}

describe("Normal taqsimot", () => {
  it("o‘ng dum: ma’lum kvantillar", () => {
    yaqin(normalDum(0), 0.5);
    yaqin(normalDum(1.959964), 0.025, 1e-6);
    yaqin(normalDum(3), 0.0013499, 1e-6);
    yaqin(normalDum(-1.959964), 0.975, 1e-6);
  });
});

describe("Mann–Whitney U", () => {
  it("aniq test: to‘liq ajralgan kichik guruhlar", () => {
    const r = mannWhitney([1, 2, 3], [4, 5, 6])!;
    assert.equal(r.U, 0);
    assert.equal(r.aniq, true);
    yaqin(r.p, 2 / 20); // 2 / C(6, 3)
    yaqin(r.r, -1);
    yaqin(mannWhitney([1, 2, 3, 4, 5], [6, 7, 8, 9, 10])!.p, 2 / 252); // 2 / C(10, 5)
  });

  it("bog‘lanishlar bilan — normal yaqinlashuv (R: wilcox.test, correct = TRUE)", () => {
    // ranglar: 1 → 1; 2,2,2 → 3; 3,3 → 5,5; 4 → 7; 5 → 8.  U = 12,5 − 10 = 2,5
    const r = mannWhitney([1, 2, 2, 3], [2, 3, 4, 5])!;
    assert.equal(r.aniq, false);
    assert.equal(r.U, 2.5);
    // σ² = 16/12 · (9 − 30/56);  z = (2,5 − 8 + 0,5) / σ
    yaqin(r.z!, -5 / Math.sqrt((16 / 12) * (9 - 30 / 56)), 1e-9);
    yaqin(r.p, 0.13666, 2e-4);
  });

  it("katta guruhlar (n ≥ 50) — normal yaqinlashuv", () => {
    const a = Array.from({ length: 50 }, (_, i) => i + 1);
    const b = Array.from({ length: 50 }, (_, i) => i + 51);
    const r = mannWhitney(a, b)!;
    assert.equal(r.aniq, false);
    yaqin(r.z!, (-1250 + 0.5) / Math.sqrt((2500 * 101) / 12), 1e-9);
    assert.ok(r.p < 1e-15);
  });

  it("simmetriya: guruhlar o‘rni almashsa p o‘zgarmaydi, r ishorasi teskari", () => {
    const a = [55, 62, 70, 48, 81, 66];
    const b = [40, 52, 58, 45, 61, 50, 47];
    const ab = mannWhitney(a, b)!;
    const ba = mannWhitney(b, a)!;
    yaqin(ab.p, ba.p, 1e-12);
    yaqin(ab.r, -ba.r, 1e-12);
    assert.ok(ab.r > 0);
  });

  it("guruhda 2 tadan kam qiymat — hisoblanmaydi", () => {
    assert.equal(mannWhitney([1], [2, 3, 4]), null);
  });
});

describe("Kruskal–Wallis H", () => {
  it("bog‘lanishsiz: H = 7,2, p = e^(−3,6)", () => {
    const r = kruskalWallis([[1, 2, 3], [4, 5, 6], [7, 8, 9]])!;
    yaqin(r.H, 7.2, 1e-9);
    assert.equal(r.df, 2);
    yaqin(r.p, Math.exp(-3.6), 1e-6); // χ²(2) o‘ng dumi = e^(−x/2)
    yaqin(r.epsilon2, 7.2 / 8, 1e-9);
  });

  it("bog‘lanishga tuzatish ranglar dispersiyasi formulasi bilan mos", () => {
    const g = [[1, 2, 2, 3], [2, 3, 4, 5], [5, 5, 6]];
    const hammasi = g.flat();
    const r = ranglar(hammasi);
    const N = hammasi.length;
    const ortR = (N + 1) / 2;
    let bosh = 0;
    let surat = 0;
    for (const x of g) {
      const ort = r.slice(bosh, bosh + x.length).reduce((a, b) => a + b, 0) / x.length;
      surat += x.length * (ort - ortR) ** 2;
      bosh += x.length;
    }
    const maxraj = r.reduce((s, v) => s + (v - ortR) ** 2, 0);
    yaqin(kruskalWallis(g)!.H, ((N - 1) * surat) / maxraj, 1e-9);
  });

  it("ikki guruhda H = z² (uzluksizlik tuzatishisiz Mann–Whitney)", () => {
    const sigma = Math.sqrt((16 / 12) * (9 - 30 / 56));
    yaqin(kruskalWallis([[1, 2, 2, 3], [2, 3, 4, 5]])!.H, (5.5 / sigma) ** 2, 1e-9);
  });

  it("barcha qiymatlar bir xil — H = 0, p = 1", () => {
    const r = kruskalWallis([[5, 5], [5, 5, 5]])!;
    assert.equal(r.H, 0);
    assert.equal(r.p, 1);
  });
});

describe("Dunn post-hoc va Holm", () => {
  it("juftlar: z = ΔR̄ / √5, Holm tuzatishi", () => {
    const j = dunn([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    assert.equal(j.length, 3);
    const j02 = j.find((x) => x.i === 0 && x.j === 2)!;
    yaqin(j02.z, -6 / Math.sqrt(5), 1e-9);
    yaqin(j02.p, 0.0072903, 2e-6);
    yaqin(j02.pHolm, 3 * j02.p, 1e-12);
    const j01 = j.find((x) => x.i === 0 && x.j === 1)!;
    yaqin(j01.p, 0.1797125, 2e-6);
    yaqin(j01.pHolm, 2 * j01.p, 1e-12);
  });

  it("Holm: monotonlik va 1 bilan cheklash", () => {
    assert.deepEqual(holm([0.01, 0.04, 0.03]).map((p) => Math.round(p * 1e6) / 1e6), [0.03, 0.06, 0.06]);
    assert.deepEqual(holm([0.6, 0.9]), [1, 1]);
  });
});

describe("Fisherning aniq testi", () => {
  it("«choy tatib ko‘rish» misoli: p = 34/70", () => {
    yaqin(fisherAniq(3, 1, 1, 3), 34 / 70, 1e-9);
    yaqin(fisherAniq(1, 3, 3, 1), 34 / 70, 1e-9);
  });

  it("parhez misoli [[1, 9], [11, 3]]: p = 0,002759", () => {
    yaqin(fisherAniq(1, 9, 11, 3), 0.002759, 1e-6);
  });

  it("to‘liq ajralish va bo‘sh jadval", () => {
    yaqin(fisherAniq(10, 0, 0, 10), 2 / 184756, 1e-12); // 2 / C(20, 10)
    assert.equal(fisherAniq(0, 0, 0, 0), 1);
    yaqin(fisherAniq(2, 3, 2, 3), 1, 1e-9);
  });
});

describe("Effekt hajmi talqini", () => {
  it("r va ε² chegaralari", () => {
    assert.equal(rEffekti(0.05), "juda_kichik");
    assert.equal(rEffekti(-0.35), "ortacha");
    assert.equal(rEffekti(0.5), "katta");
    assert.equal(epsilonEffekti(0.005), "juda_kichik");
    assert.equal(epsilonEffekti(0.1), "ortacha");
    assert.equal(epsilonEffekti(0.3), "katta");
  });
});
