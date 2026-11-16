/**
 * Ekspertlar kelishuvi statistikasi (tashqi bog‘liqliksiz, sof funksiyalar).
 *
 * - Krippendorff α — ixtiyoriy sondagi baholovchi, tushib qolgan qiymatlar va
 *   o‘lchov darajasi (nominal / ordinal / interval) bilan ishlaydi.
 *   Manba: K. Krippendorff, «Computing Krippendorff’s Alpha-Reliability» (2011).
 * - Kendall W — ekspertlar reytinglarining konkordatsiya koeffitsiyenti
 *   (bog‘langan ranglar uchun tuzatish bilan), χ² bo‘yicha ahamiyatlilik.
 *
 * Bu fayl hech narsani import qilmaydi — shuning uchun uni Node’ning o‘zida
 * test qilish mumkin: npm test
 */

export type OlchovDarajasi = "nominal" | "ordinal" | "interval";
export type Qiymat = number | string;

export interface AlphaNatija {
  alpha: number | null;
  /** α hisobiga kirgan birliklar (kamida 2 ta qiymatga ega) */
  birliklar: number;
  /** juftlanuvchi qiymatlar soni (n) */
  qiymatlar: number;
}

const bor = (v: Qiymat | null | undefined): v is Qiymat => v !== null && v !== undefined && v !== "";

export function krippendorffAlpha(
  birliklar: (Qiymat | null | undefined)[][],
  daraja: OlchovDarajasi,
): AlphaNatija {
  const u = birliklar.map((b) => b.filter(bor)).filter((b) => b.length >= 2);
  const turlari = [...new Set(u.flat())];
  const sonli = daraja !== "nominal";
  turlari.sort((a, b) => (sonli ? Number(a) - Number(b) : String(a).localeCompare(String(b))));
  const indeks = new Map(turlari.map((v, i) => [v, i]));
  const K = turlari.length;

  // Tasodifiylik matritsasi (coincidence matrix)
  const o = Array.from({ length: K }, () => new Array<number>(K).fill(0));
  for (const b of u) {
    const m = b.length;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        if (i !== j) o[indeks.get(b[i])!][indeks.get(b[j])!] += 1 / (m - 1);
      }
    }
  }
  const nc = o.map((qator) => qator.reduce((a, b) => a + b, 0));
  const n = nc.reduce((a, b) => a + b, 0);
  const natija = { birliklar: u.length, qiymatlar: Math.round(n) };
  if (n < 2 || K < 1) return { alpha: null, ...natija };

  const delta2 = (c: number, k: number): number => {
    if (c === k) return 0;
    if (daraja === "nominal") return 1;
    if (daraja === "interval") return (Number(turlari[c]) - Number(turlari[k])) ** 2;
    const [a, b] = c < k ? [c, k] : [k, c];
    let s = 0;
    for (let g = a; g <= b; g++) s += nc[g];
    s -= (nc[a] + nc[b]) / 2;
    return s * s;
  };

  let Do = 0;
  let De = 0;
  for (let c = 0; c < K; c++) {
    for (let k = 0; k < K; k++) {
      const d = delta2(c, k);
      Do += o[c][k] * d;
      De += nc[c] * nc[k] * d;
    }
  }
  Do /= n;
  De /= n * (n - 1);
  // Barcha qiymatlar bir xil bo‘lsa, kutilgan tafovut nolga teng — α aniqlanmaydi
  if (De === 0) return { alpha: null, ...natija };
  return { alpha: 1 - Do / De, ...natija };
}

/** Birliklar ichidagi juftlarning mos kelish ulushi (0–1), birliklar bo‘yicha o‘rtacha. */
export function foizKelishuv(birliklar: (Qiymat | null | undefined)[][]): number | null {
  const ulushlar: number[] = [];
  for (const b of birliklar.map((x) => x.filter(bor))) {
    if (b.length < 2) continue;
    let mos = 0;
    let jami = 0;
    for (let i = 0; i < b.length; i++) {
      for (let j = i + 1; j < b.length; j++) {
        jami++;
        if (b[i] === b[j]) mos++;
      }
    }
    ulushlar.push(mos / jami);
  }
  return ulushlar.length ? ulushlar.reduce((a, b) => a + b, 0) / ulushlar.length : null;
}

/** Birliklar ichidagi juftlar orasidagi o‘rtacha mutlaq farq (sonli qiymatlar uchun). */
export function ortachaFarq(birliklar: (number | null | undefined)[][]): number | null {
  const farqlar: number[] = [];
  for (const b of birliklar.map((x) => x.filter((v): v is number => v != null))) {
    if (b.length < 2) continue;
    let s = 0;
    let jami = 0;
    for (let i = 0; i < b.length; i++) {
      for (let j = i + 1; j < b.length; j++) {
        s += Math.abs(b[i] - b[j]);
        jami++;
      }
    }
    farqlar.push(s / jami);
  }
  return farqlar.length ? farqlar.reduce((a, b) => a + b, 0) / farqlar.length : null;
}

export type AlphaTalqini = "ishonchli" | "shartli" | "ishonchsiz";

/** Krippendorff (2004) chegaralari: α ≥ 0,800 — ishonchli; 0,667–0,800 — shartli xulosa; undan past — ishonchsiz. */
export function alphaTalqini(alpha: number | null): AlphaTalqini | null {
  if (alpha == null) return null;
  if (alpha >= 0.8) return "ishonchli";
  if (alpha >= 0.667) return "shartli";
  return "ishonchsiz";
}

// ------------------------------------------------------------------ Kendall W

export interface KendallNatija {
  W: number;
  chi2: number;
  df: number;
  p: number;
  m: number;
  n: number;
  /** har bir obyektning o‘rtacha rangi (1 — eng muhim) */
  ortachaRang: number[];
}

/** Qiymatlarni kamayish tartibida ranglash (eng kattasi — 1), teng qiymatlarga o‘rtacha rang. */
export function ranglash(qiymatlar: number[]): { ranglar: number[]; boglanish: number } {
  const tartib = qiymatlar.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const ranglar = new Array<number>(qiymatlar.length);
  let boglanish = 0;
  let i = 0;
  while (i < tartib.length) {
    let j = i;
    while (j + 1 < tartib.length && tartib[j + 1].v === tartib[i].v) j++;
    const t = j - i + 1;
    const ortacha = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k++) ranglar[tartib[k].i] = ortacha;
    if (t > 1) boglanish += t ** 3 - t;
    i = j + 1;
  }
  return { ranglar, boglanish };
}

/**
 * Kendall konkordatsiya koeffitsiyenti.
 * @param baholar m ta ekspert × n ta obyekt; qiymat qanchalik katta bo‘lsa, obyekt shunchalik muhim.
 */
export function kendallW(baholar: number[][]): KendallNatija | null {
  const m = baholar.length;
  if (m < 2) return null;
  const n = baholar[0].length;
  if (n < 2 || baholar.some((b) => b.length !== n)) return null;

  const ranglangan = baholar.map(ranglash);
  const R = Array.from({ length: n }, (_, i) => ranglangan.reduce((s, r) => s + r.ranglar[i], 0));
  const ortachaR = (m * (n + 1)) / 2;
  const S = R.reduce((s, r) => s + (r - ortachaR) ** 2, 0);
  const T = ranglangan.reduce((s, r) => s + r.boglanish, 0);
  const maxraj = m * m * (n ** 3 - n) - m * T;
  if (maxraj <= 0) return null;

  const W = (12 * S) / maxraj;
  const chi2 = m * (n - 1) * W;
  const df = n - 1;
  return { W, chi2, df, p: chiKvadratP(chi2, df), m, n, ortachaRang: R.map((r) => r / m) };
}

export type WTalqini = "kuchli" | "yaxshi" | "ortacha" | "kuchsiz";

/** Kendall W kuchi: odatiy talqin shkalasi (kod; nomi tarjimada). */
export function wTalqini(W: number): WTalqini {
  if (W >= 0.7) return "kuchli";
  if (W >= 0.5) return "yaxshi";
  if (W >= 0.3) return "ortacha";
  return "kuchsiz";
}

// ------------------------------------------------------------------ χ² taqsimoti

function lnGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2,
    -0.5395239384953e-5,
  ];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Regulyarlashtirilgan pastki to‘liqmas gamma funksiyasi P(a, x). */
function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a;
    let del = sum;
    let ap = a;
    for (let i = 0; i < 500; i++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  // uzluksiz kasr (Lentz usuli)
  let b = x + 1 - a;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** χ² taqsimotining o‘ng dumi: P(χ² ≥ x). */
export function chiKvadratP(x: number, df: number): number {
  if (x <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - gammaP(df / 2, x / 2)));
}

// ------------------------------------------------------------------ oddiy statistika

export const ortacha = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function mediana(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : (s[o - 1] + s[o]) / 2;
}

/** Tanlanma standart chetlanishi (n − 1). */
export function sd(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = ortacha(xs)!;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Variatsiya koeffitsiyenti, %. */
export function cv(xs: number[]): number | null {
  const m = ortacha(xs);
  const s = sd(xs);
  if (m == null || s == null || m === 0) return null;
  return (s / m) * 100;
}

/**
 * Qiymatlarni 0,5 qadam bilan yaxlitlaydi va yig‘indini aniq `jami` ga tenglaydi
 * (eng katta qoldiq usuli).
 */
export function yarimgaYaxlitlash(qiymatlar: number[], jami = 100): number[] {
  const birlik = qiymatlar.map((v) => v * 2);
  const past = birlik.map(Math.floor);
  let qoldiq = Math.round(jami * 2) - past.reduce((a, b) => a + b, 0);
  const tartib = birlik.map((v, i) => ({ i, kasr: v - Math.floor(v) })).sort((a, b) => b.kasr - a.kasr);
  const natija = [...past];
  for (let k = 0; qoldiq > 0 && k < tartib.length; k++, qoldiq--) natija[tartib[k].i] += 1;
  for (let k = tartib.length - 1; qoldiq < 0 && k >= 0; k--, qoldiq++) natija[tartib[k].i] -= 1;
  return natija.map((v) => v / 2);
}

// ------------------------------------------------------------------ guruhlarni taqqoslash (ahamiyat testlari)
//
// Neparametrik testlar: ballar normal taqsimlanmagan va chegaralangan (0–100), guruhlar kichik.
// Natijalar R’dagi wilcox.test, kruskal.test va fisher.test bilan bir xil usulda hisoblanadi.

/** Standart normal taqsimotning o‘ng dumi P(Z ≥ z). erfc — Chebyshev yaqinlashuvi (nisbiy xato < 1,2·10⁻⁷). */
export function normalDum(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * x);
  const kopHad =
    -1.26551223 +
    t * (1.00002368 +
    t * (0.37409196 +
    t * (0.09678418 +
    t * (-0.18628806 +
    t * (0.27886807 +
    t * (-1.13520398 +
    t * (1.48851587 +
    t * (-0.82215223 +
    t * 0.17087277))))))));
  const erfc = t * Math.exp(-x * x + kopHad);
  return z >= 0 ? erfc / 2 : 1 - erfc / 2;
}

/** O‘sish tartibidagi ranglar (eng kichigi — 1), teng qiymatlarga o‘rtacha rang; T = Σ(t³ − t). */
function osishRanglari(qiymatlar: number[]): { ranglar: number[]; T: number } {
  const r = ranglash(qiymatlar.map((v) => -v));
  return { ranglar: r.ranglar, T: r.boglanish };
}

/** Guruhlar ketma-ket birlashtirilgan ranglar massivida har bir guruh ranglari yig‘indisi. */
function guruhRangYigindilari(guruhlar: number[][], ranglar: number[]): number[] {
  let bosh = 0;
  return guruhlar.map((g) => {
    let s = 0;
    for (let i = bosh; i < bosh + g.length; i++) s += ranglar[i];
    bosh += g.length;
    return s;
  });
}

/** Holm–Bonferroni tuzatishi: tuzatilgan p qiymatlari (asl tartibda). */
export function holm(p: number[]): number[] {
  const m = p.length;
  const tartib = p.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const natija = new Array<number>(m);
  let max = 0;
  tartib.forEach((x, k) => {
    max = Math.max(max, Math.min(1, (m - k) * x.v));
    natija[x.i] = max;
  });
  return natija;
}

/** Bog‘lanishsiz n₁, n₂ hajmli tanlanmalar uchun U statistikasining aniq taqsimoti: P(U ≤ u). */
function uTaqsimoti(n1: number, n2: number, u: number): number {
  // f(i, j, k) — i va j elementdan U = k bo‘ladigan joylashuvlar soni:
  // f(i, j, k) = f(i − 1, j, k − j) + f(i, j − 1, k)
  let oldingi: number[][] = Array.from({ length: n2 + 1 }, () => [1]);
  for (let i = 1; i <= n1; i++) {
    const joriy: number[][] = [[1]];
    for (let j = 1; j <= n2; j++) {
      const a = oldingi[j];
      const b = joriy[j - 1];
      const f = new Array<number>(i * j + 1);
      for (let k = 0; k < f.length; k++) f[k] = (k >= j && k - j < a.length ? a[k - j] : 0) + (k < b.length ? b[k] : 0);
      joriy.push(f);
    }
    oldingi = joriy;
  }
  const f = oldingi[n2];
  const jami = f.reduce((s, x) => s + x, 0);
  let s = 0;
  for (let k = 0; k <= Math.floor(u + 1e-9) && k < f.length; k++) s += f[k];
  return s / jami;
}

export interface MannWhitneyNatija {
  /** U = R₁ − n₁(n₁ + 1)/2 — birinchi guruh uchun (R’dagi W) */
  U: number;
  /** normal yaqinlashuvdagi z (aniq testda null) */
  z: number | null;
  /** ikki tomonlama p */
  p: number;
  aniq: boolean;
  /** rang-biserial korrelyatsiya (−1…1): > 0 — birinchi guruh qiymatlari kattaroq */
  r: number;
  n1: number;
  n2: number;
}

/**
 * Mann–Whitney U testi (Wilcoxon rank-sum). Bog‘lanish bo‘lmasa va ikkala guruh 50 dan kichik bo‘lsa —
 * aniq taqsimot, aks holda bog‘lanishga tuzatilgan normal yaqinlashuv (uzluksizlik tuzatishi bilan).
 */
export function mannWhitney(a: number[], b: number[]): MannWhitneyNatija | null {
  const n1 = a.length;
  const n2 = b.length;
  if (n1 < 2 || n2 < 2) return null;
  const N = n1 + n2;
  const { ranglar, T } = osishRanglari([...a, ...b]);
  const [R1] = guruhRangYigindilari([a, b], ranglar);
  const U = R1 - (n1 * (n1 + 1)) / 2;
  const r = (2 * U) / (n1 * n2) - 1;
  if (T === 0 && n1 < 50 && n2 < 50) {
    const kichik = Math.min(U, n1 * n2 - U);
    return { U, z: null, p: Math.min(1, 2 * uTaqsimoti(n1, n2, kichik)), aniq: true, r, n1, n2 };
  }
  const sigma = Math.sqrt(((n1 * n2) / 12) * (N + 1 - T / (N * (N - 1))));
  if (!(sigma > 0)) return { U, z: 0, p: 1, aniq: false, r, n1, n2 };
  const d = U - (n1 * n2) / 2;
  const z = (d - Math.sign(d) * 0.5) / sigma;
  return { U, z, p: Math.min(1, 2 * normalDum(Math.abs(z))), aniq: false, r, n1, n2 };
}

export interface KruskalNatija {
  /** bog‘lanishga tuzatilgan H */
  H: number;
  df: number;
  p: number;
  /** effekt hajmi ε² = H / (N − 1) */
  epsilon2: number;
  N: number;
  ortachaRanglar: number[];
}

/** Kruskal–Wallis H testi (bog‘langan ranglarga tuzatish bilan), p — χ²(k − 1) bo‘yicha. */
export function kruskalWallis(guruhlar: number[][]): KruskalNatija | null {
  const k = guruhlar.length;
  if (k < 2 || guruhlar.some((g) => g.length === 0)) return null;
  const N = guruhlar.reduce((s, g) => s + g.length, 0);
  if (N <= k) return null;
  const { ranglar, T } = osishRanglari(guruhlar.flat());
  const R = guruhRangYigindilari(guruhlar, ranglar);
  const ortachaRanglar = R.map((s, i) => s / guruhlar[i].length);
  const C = 1 - T / (N ** 3 - N);
  const df = k - 1;
  if (!(C > 0)) return { H: 0, df, p: 1, epsilon2: 0, N, ortachaRanglar };
  const H0 = (12 / (N * (N + 1))) * R.reduce((s, r, i) => s + (r * r) / guruhlar[i].length, 0) - 3 * (N + 1);
  const H = Math.max(0, H0 / C);
  return { H, df, p: chiKvadratP(H, df), epsilon2: H / (N - 1), N, ortachaRanglar };
}

export interface DunnJufti {
  i: number;
  j: number;
  /** z > 0 — i-guruhning o‘rtacha rangi kattaroq */
  z: number;
  p: number;
  /** Holm bo‘yicha tuzatilgan p (barcha juftlar uchun) */
  pHolm: number;
}

/** Dunn post-hoc testi: Kruskal–Wallis’dan keyin guruhlarni juft-juft taqqoslash. */
export function dunn(guruhlar: number[][]): DunnJufti[] {
  const N = guruhlar.reduce((s, g) => s + g.length, 0);
  if (guruhlar.length < 2 || N < 2 || guruhlar.some((g) => g.length === 0)) return [];
  const { ranglar, T } = osishRanglari(guruhlar.flat());
  const ortacha = guruhRangYigindilari(guruhlar, ranglar).map((s, i) => s / guruhlar[i].length);
  const asos = (N * (N + 1)) / 12 - T / (12 * (N - 1));
  const juftlar: Omit<DunnJufti, "pHolm">[] = [];
  for (let i = 0; i < guruhlar.length; i++) {
    for (let j = i + 1; j < guruhlar.length; j++) {
      const se = Math.sqrt(asos * (1 / guruhlar[i].length + 1 / guruhlar[j].length));
      const z = se > 0 ? (ortacha[i] - ortacha[j]) / se : 0;
      juftlar.push({ i, j, z, p: Math.min(1, 2 * normalDum(Math.abs(z))) });
    }
  }
  const tuzatilgan = holm(juftlar.map((x) => x.p));
  return juftlar.map((x, k) => ({ ...x, pHolm: tuzatilgan[k] }));
}

const LN_FAKTORIAL: number[] = [0];
function lnFaktorial(n: number): number {
  for (let k = LN_FAKTORIAL.length; k <= n; k++) LN_FAKTORIAL[k] = LN_FAKTORIAL[k - 1] + Math.log(k);
  return LN_FAKTORIAL[n];
}

/** Fisherning aniq testi 2×2 jadval uchun [[a, b], [c, d]] — ikki tomonlama p (R’dagi fisher.test kabi). */
export function fisherAniq(a: number, b: number, c: number, d: number): number {
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const N = r1 + r2;
  if (N === 0) return 1;
  const lnC = (n: number, k: number) => lnFaktorial(n) - lnFaktorial(k) - lnFaktorial(n - k);
  const lnP = (x: number) => lnC(r1, x) + lnC(r2, c1 - x) - lnC(N, c1);
  const kuzatilgan = lnP(a);
  let p = 0;
  for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x++) {
    const l = lnP(x);
    if (l <= kuzatilgan + 1e-7) p += Math.exp(l);
  }
  return Math.min(1, p);
}

export type EffektKuchi = "juda_kichik" | "kichik" | "ortacha" | "katta";

/** Korrelyatsiya ko‘rinishidagi effekt (rang-biserial r): 0,1 / 0,3 / 0,5 chegaralari (Cohen, 1988). */
export function rEffekti(r: number): EffektKuchi {
  const a = Math.abs(r);
  return a < 0.1 ? "juda_kichik" : a < 0.3 ? "kichik" : a < 0.5 ? "ortacha" : "katta";
}

/** Kruskal–Wallis ε²: 0,01 / 0,08 / 0,26 chegaralari (Mangiafico, rcompanion). */
export function epsilonEffekti(e: number): EffektKuchi {
  return e < 0.01 ? "juda_kichik" : e < 0.08 ? "kichik" : e < 0.26 ? "ortacha" : "katta";
}

// ------------------------------------------------------------------ Cohen κ (AI va tadqiqotchi mosligi)

export interface KappaNatija {
  /** juftlar soni */
  n: number;
  /** to‘liq mos kelgan juftlar ulushi, 0–1 */
  mos: number | null;
  /** Cohen κ; tasodifiy mos kelish 1 ga teng bo‘lsa (hammasi bitta toifa) — null */
  kappa: number | null;
}

/**
 * Ikki baholovchi uchun Cohen κ (nominal): κ = (pₒ − pₑ) / (1 − pₑ),
 * pₑ — har bir baholovchining toifalar ulushlari ko‘paytmalari yig‘indisi (Cohen, 1960).
 */
export function cohenKappa(juftlar: [string, string][]): KappaNatija {
  const n = juftlar.length;
  if (!n) return { n: 0, mos: null, kappa: null };
  const a = new Map<string, number>();
  const b = new Map<string, number>();
  let teng = 0;
  for (const [x, y] of juftlar) {
    if (x === y) teng++;
    a.set(x, (a.get(x) ?? 0) + 1);
    b.set(y, (b.get(y) ?? 0) + 1);
  }
  const po = teng / n;
  let pe = 0;
  for (const [k, v] of a) pe += (v / n) * ((b.get(k) ?? 0) / n);
  return { n, mos: po, kappa: pe >= 1 ? null : (po - pe) / (1 - pe) };
}

export type KappaTalqini = "yomon" | "sezilarsiz" | "kuchsiz" | "ortacha" | "sezilarli" | "deyarliTola";

/** Landis va Koch (1977) shkalasi */
export function kappaTalqini(k: number | null): KappaTalqini | null {
  if (k == null) return null;
  if (k < 0) return "yomon";
  if (k <= 0.2) return "sezilarsiz";
  if (k <= 0.4) return "kuchsiz";
  if (k <= 0.6) return "ortacha";
  if (k <= 0.8) return "sezilarli";
  return "deyarliTola";
}
