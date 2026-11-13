/**
 * Dissertatsiya uchun rasmlar: grafik ma’lumotidan mustaqil SVG — oq fon, bosma shrifti,
 * aniq jismoniy o‘lcham (sm), rangli yoki oq-qora. Interfeys mavzusiga bog‘liq emas.
 *
 * DOM ishlatilmaydi va hech narsa import qilinmaydi: brauzerda ham, Node testlarida ham ishlaydi.
 * Matn kengligini brauzer o‘lchab beradi (canvas measureText); berilmasa — taxminiy hisob.
 */

export type Shrift = "Times New Roman" | "Arial";
export type Olchagich = (matn: string, px: number, qalin: boolean) => number;

export type Rasm =
  | {
      tur: "gorizontal";
      qatorlar: { nomi: string; qiymat: number | null; rang?: number }[];
      max: number;
      suffix?: string;
      legend?: { nomi: string; rang: number }[];
    }
  | {
      tur: "guruhli";
      toifalar: string[];
      /** rang — palitradagi o‘rin (bir xil seriya barcha rasmlarda bir xil rangda bo‘lishi uchun) */
      seriyalar: { nomi: string; qiymatlar: (number | null)[]; rang?: number }[];
      /** berilmasa — qiymatlarga qarab yaxlit chegara */
      max?: number;
      suffix?: string;
    }
  | {
      tur: "ustun";
      /** rang — shkala darajasi (0 — eng past); berilmasa asosiy rang */
      ustunlar: { nomi: string; qiymat: number; rang?: number }[];
      darajalar?: number;
    }
  | {
      tur: "issiqlik";
      birinchiUstun: string;
      soniUstuni?: string;
      ustunlar: string[];
      /** guruh o‘zgarganda jadvalda guruh sarlavhasi qatori chiziladi */
      qatorlar: { nomi: string; izoh?: string; guruh?: string; soni?: number; qiymatlar: (number | null)[] }[];
      max: number;
      suffix?: string;
      ton: "kok" | "qizil";
      shkala: { past: string; yuqori: string };
    }
  | {
      tur: "chiziq";
      davrlar: string[];
      seriyalar: { nomi: string; qiymatlar: (number | null)[]; rang?: number }[];
      max: number;
    };

export interface RasmMalumot {
  sarlavha: string;
  rasm: Rasm;
}

export interface RasmSozlama {
  kengSm: number;
  shrift: Shrift;
  olchamPt: number;
  rangli: boolean;
  /** rasm tepasiga yoziladigan sarlavha (null — yozilmaydi) */
  sarlavha?: string | null;
  son: (x: number | null | undefined, kasr?: number) => string;
  olchash?: Olchagich;
}

export interface RasmNatija {
  svg: string;
  /** CSS piksellarda (96 dpi) */
  kenglik: number;
  balandlik: number;
  kengSm: number;
  balandSm: number;
}

const PX_PT = 96 / 72;
const PX_SM = 96 / 2.54;

const RANG = { matn: "#1A1A1A", ikkinchi: "#4D4D4D", panjara: "#D9D9D9", oq: "#FFFFFF", bosh: "#F2F2F2" };
/** 0 — bosma, 1 — raqamli, 2 — «barcha media» (ilovadagi ranglar mantig‘i bilan bir xil) */
const SERIYA_RANGLI = ["#1F4E79", "#C55A11", "#404040", "#548235", "#7030A0", "#2E75B6"];
const SERIYA_OQQORA = ["#3A3A3A", "#A6A6A6", "#E0E0E0", "#6E6E6E", "#C8C8C8", "#000000"];
/** shkala darajalari: past → yuqori */
const DARAJA_RANGLI = ["#C0392B", "#E08A1E", "#3F8E4F", "#1F4E79"];
const DARAJA_OQQORA = ["#E3E3E3", "#ABABAB", "#6E6E6E", "#2B2B2B"];
const TON = { kok: "#1F4E79", qizil: "#9C2B2B", qora: "#1A1A1A" };
const CHIZIQ_OQQORA = [
  { rang: "#000000", dash: "" },
  { rang: "#000000", dash: "6 3" },
  { rang: "#707070", dash: "" },
  { rang: "#000000", dash: "2 2.5" },
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n2 = (x: number) => (Math.round(x * 100) / 100).toString();

/** Shrift o‘lchami bo‘yicha taxminiy matn kengligi (brauzer o‘lchagichi bo‘lmaganda). */
export function taxminiyKenglik(matn: string, px: number, qalin: boolean, shrift: Shrift = "Times New Roman"): number {
  let em = 0;
  for (const ch of matn) {
    if (ch === " ") em += 0.25;
    else if (/[ilIjtf.,:;'’‘|!()\-]/.test(ch)) em += 0.3;
    else if (/[mwMWшщжюМШЩЖЮ]/.test(ch)) em += 0.82;
    else if (/[A-ZА-ЯЁЎҚҒҲ]/.test(ch)) em += 0.66;
    else em += 0.5;
  }
  return em * px * (shrift === "Arial" ? 1.08 : 1) * (qalin ? 1.07 : 1);
}

function qisqartirish(q: string, maxW: number, o: (s: string) => number): string {
  if (o(q) <= maxW) return q;
  let s = q;
  while (s.length > 1 && o(`${s}…`) > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/** Qatorga sig‘maydigan so‘z: avval chiziqcha bo‘yicha, keyin harflar bo‘yicha «-» bilan bo‘linadi. */
function sozniBolish(soz: string, maxW: number, o: (s: string) => number): string[] {
  if (o(soz) <= maxW) return [soz];
  const chiziqcha = soz.indexOf("-");
  if (chiziqcha > 0 && chiziqcha < soz.length - 1) {
    return [...sozniBolish(soz.slice(0, chiziqcha + 1), maxW, o), ...sozniBolish(soz.slice(chiziqcha + 1), maxW, o)];
  }
  const bolaklar: string[] = [];
  let joriy = "";
  for (const ch of soz) {
    if (joriy.length >= 2 && o(`${joriy}${ch}-`) > maxW) {
      bolaklar.push(`${joriy}-`);
      joriy = ch;
    } else joriy += ch;
  }
  // Oxirgi bo‘lak kamida 3 harf bo‘lsin («Оценочны- й» emas, «Оценоч- ный»)
  const kam = 3 - [...joriy].length;
  if (kam > 0 && bolaklar.length) {
    const oldingi = [...bolaklar[bolaklar.length - 1].slice(0, -1)];
    if (oldingi.length - kam >= 2) {
      joriy = oldingi.slice(-kam).join("") + joriy;
      bolaklar[bolaklar.length - 1] = `${oldingi.slice(0, -kam).join("")}-`;
    }
  }
  bolaklar.push(joriy);
  return bolaklar;
}

/**
 * Yorliqlar to‘plami uchun shrift o‘lchami: eng uzun so‘z (bo‘sh joy va chiziqcha bo‘yicha)
 * maxW ga sig‘guncha kichraytiriladi, lekin minPx dan kichik emas.
 */
function mosOlcham(matnlar: string[], maxW: number, px: number, minPx: number, o: Olchagich, qalin = false): number {
  const sozlar = matnlar.flatMap((m) => m.split(/[\s-]+/).filter(Boolean));
  let natija = px;
  while (natija > minPx && sozlar.some((s) => o(s, natija, qalin) > maxW)) natija *= 0.95;
  return Math.max(minPx, natija);
}

/** So‘zlar bo‘yicha qatorlarga bo‘lish (ko‘pi bilan maxQator; sig‘maganini «…» bilan qisqartiradi). */
export function sindirish(matn: string, maxW: number, o: (s: string) => number, maxQator = 2): string[] {
  // bogliq — so‘z bo‘lagi, oldingisiga bo‘sh joysiz qo‘shiladi
  const bolaklar = matn
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((s) => sozniBolish(s, maxW, o).map((m, i) => ({ m, bogliq: i > 0 })));
  const qatorlar: string[] = [];
  let joriy = "";
  for (const { m, bogliq } of bolaklar) {
    const sinov = joriy ? `${joriy}${bogliq ? "" : " "}${m}` : m;
    if (!joriy || o(sinov) <= maxW) joriy = sinov;
    else {
      qatorlar.push(joriy);
      joriy = m;
    }
  }
  if (joriy) qatorlar.push(joriy);
  if (qatorlar.length > maxQator) {
    const qoldiq = qatorlar.slice(maxQator - 1).join(" ");
    qatorlar.length = maxQator - 1;
    qatorlar.push(qoldiq);
  }
  return qatorlar.map((q) => qisqartirish(q, maxW, o));
}

/** O‘q bo‘linmalari: 0 dan max’ni qoplaydigan «yaxlit» qadamlar. */
export function qadamlar(max: number, butun = false, son = 5): number[] {
  if (!(max > 0)) return [0, 1];
  const xom = max / son;
  const daraja = 10 ** Math.floor(Math.log10(xom));
  const qadam = [1, 2, 2.5, 5, 10]
    .filter((m) => !butun || Number.isInteger(m * daraja))
    .map((m) => Math.max(butun ? 1 : 0, m * daraja))
    .find((v) => v >= xom - 1e-9)!;
  const yuqori = Math.ceil(max / qadam - 1e-9) * qadam;
  return Array.from({ length: Math.round(yuqori / qadam) + 1 }, (_, i) => Math.round(i * qadam * 1e9) / 1e9);
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function aralash(a: string, b: string, t: number): string {
  const [x, y] = [hexRgb(a), hexRgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
function yorqinlik(hex: string): number {
  const [r, g, b] = hexRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

interface MatnUslubi {
  px?: number;
  qalin?: boolean;
  anchor?: "start" | "middle" | "end";
  rang?: string;
  burilish?: number;
}

/** Chizma holati: o‘lchamlar, kursor (y) va SVG bo‘laklari. */
class Chizma {
  readonly W: number;
  readonly f: number;
  readonly P: number;
  readonly kichik: number;
  y = 0;
  readonly s: RasmSozlama;
  private qismlar: string[] = [];
  private oilasi: string;

  constructor(s: RasmSozlama) {
    this.s = s;
    this.W = s.kengSm * PX_SM;
    this.f = s.olchamPt * PX_PT;
    this.P = this.f * 0.6;
    this.kichik = this.f * 0.86;
    this.y = this.P;
    this.oilasi = s.shrift === "Arial" ? "Arial, Helvetica, sans-serif" : "'Times New Roman', Times, serif";
  }

  o(matn: string, px = this.f, qalin = false): number {
    return this.s.olchash ? this.s.olchash(matn, px, qalin) : taxminiyKenglik(matn, px, qalin, this.s.shrift);
  }
  son(x: number | null | undefined, kasr?: number): string {
    return this.s.son(x, kasr);
  }
  seriya(i: number): string {
    const p = this.s.rangli ? SERIYA_RANGLI : SERIYA_OQQORA;
    return p[i % p.length];
  }
  /** Oq-qora rejimda och ustunlar fondan ajralib turishi uchun chegara */
  get chegara(): string | undefined {
    return this.s.rangli ? undefined : RANG.matn;
  }

  matn(x: number, y: number, m: string, u: MatnUslubi = {}) {
    const px = u.px ?? this.f;
    const burilish = u.burilish ? ` transform="rotate(${n2(u.burilish)} ${n2(x)} ${n2(y)})"` : "";
    this.qismlar.push(
      `<text x="${n2(x)}" y="${n2(y)}" font-family="${this.oilasi}" font-size="${n2(px)}"` +
        `${u.qalin ? ' font-weight="bold"' : ""} text-anchor="${u.anchor ?? "start"}" fill="${u.rang ?? RANG.matn}"${burilish}>${esc(m)}</text>`,
    );
  }
  rect(x: number, y: number, w: number, h: number, fill: string, stroke?: string) {
    const ch = stroke ? ` stroke="${stroke}" stroke-width="0.75"` : "";
    this.qismlar.push(`<rect x="${n2(x)}" y="${n2(y)}" width="${n2(Math.max(0, w))}" height="${n2(Math.max(0, h))}" fill="${fill}"${ch}/>`);
  }
  chiziq(x1: number, y1: number, x2: number, y2: number, rang: string, qalinlik = 1, dash = "") {
    const d = dash ? ` stroke-dasharray="${dash}"` : "";
    this.qismlar.push(
      `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" stroke="${rang}" stroke-width="${n2(qalinlik)}"${d}/>`,
    );
  }
  yol(d: string, rang: string, qalinlik: number, dash = "") {
    const ds = dash ? ` stroke-dasharray="${dash}"` : "";
    this.qismlar.push(
      `<path d="${d}" fill="none" stroke="${rang}" stroke-width="${n2(qalinlik)}" stroke-linejoin="round" stroke-linecap="round"${ds}/>`,
    );
  }
  marker(tur: number, cx: number, cy: number, r: number, fill: string, stroke: string) {
    const ch = `fill="${fill}" stroke="${stroke}" stroke-width="1"`;
    const t = tur % 4;
    if (t === 0) this.qismlar.push(`<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" ${ch}/>`);
    else if (t === 1) this.qismlar.push(`<rect x="${n2(cx - r)}" y="${n2(cy - r)}" width="${n2(2 * r)}" height="${n2(2 * r)}" ${ch}/>`);
    else if (t === 2)
      this.qismlar.push(
        `<path d="M${n2(cx)},${n2(cy - r * 1.15)} L${n2(cx + r * 1.1)},${n2(cy + r * 0.85)} L${n2(cx - r * 1.1)},${n2(cy + r * 0.85)} Z" ${ch}/>`,
      );
    else
      this.qismlar.push(
        `<path d="M${n2(cx)},${n2(cy - r * 1.25)} L${n2(cx + r * 1.25)},${n2(cy)} L${n2(cx)},${n2(cy + r * 1.25)} L${n2(cx - r * 1.25)},${n2(cy)} Z" ${ch}/>`,
      );
  }

  /** Matn bazaviy chizig‘i: berilgan markaz bo‘yicha vertikal tekislash */
  baza(markaz: number, px = this.f) {
    return markaz + px * 0.35;
  }

  sarlavha(matn: string) {
    const px = this.f * 1.08;
    const qatorlar = sindirish(matn, this.W - 2 * this.P, (m) => this.o(m, px, true), 3);
    for (const q of qatorlar) {
      this.matn(this.P, this.y + px, q, { px, qalin: true });
      this.y += px * 1.3;
    }
    this.y += this.f * 0.4;
  }

  /** Legenda: namunalar qatorlarga o‘raladi. chiziq — chiziqli grafik namunasi. */
  legend(items: { nomi: string; rang: string; chiziq?: { dash: string; marker: number; markerFill: string } }[]) {
    if (!items.length) return;
    const px = this.kichik;
    const qatorH = this.f * 1.35;
    let x = this.P;
    let y = this.y;
    for (const it of items) {
      const namuna = it.chiziq ? this.f * 1.8 : this.f * 0.78;
      const w = namuna + this.f * 0.4 + this.o(it.nomi, px);
      if (x > this.P && x + w > this.W - this.P) {
        x = this.P;
        y += qatorH;
      }
      const markaz = y + qatorH / 2;
      if (it.chiziq) {
        this.chiziq(x, markaz, x + namuna, markaz, it.rang, this.f * 0.13, it.chiziq.dash);
        this.marker(it.chiziq.marker, x + namuna / 2, markaz, this.f * 0.22, it.chiziq.markerFill, it.rang);
      } else {
        this.rect(x, markaz - namuna / 2, namuna, namuna, it.rang, this.chegara);
      }
      this.matn(x + namuna + this.f * 0.4, this.baza(markaz, px), it.nomi, { px, rang: RANG.matn });
      x += w + this.f * 1.1;
    }
    this.y = y + qatorH + this.f * 0.3;
  }

  natija(): RasmNatija {
    const H = this.y + this.P;
    const kengSm = this.s.kengSm;
    const balandSm = H / PX_SM;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${n2(kengSm)}cm" height="${n2(balandSm)}cm" ` +
      `viewBox="0 0 ${n2(this.W)} ${n2(H)}">` +
      `<rect x="0" y="0" width="${n2(this.W)}" height="${n2(H)}" fill="${RANG.oq}"/>` +
      this.qismlar.join("") +
      `</svg>`;
    return { svg, kenglik: this.W, balandlik: H, kengSm, balandSm };
  }
}

// ------------------------------------------------------------------ rasm turlari

function gorizontal(k: Chizma, r: Extract<Rasm, { tur: "gorizontal" }>) {
  const { f, W, P, kichik } = k;
  if (r.legend?.length) k.legend(r.legend.map((l) => ({ nomi: l.nomi, rang: k.seriya(l.rang) })));
  const maxL = W * 0.38;
  const yorliqlar = r.qatorlar.map((q) => sindirish(q.nomi, maxL, (m) => k.o(m), 2));
  const L = Math.min(maxL, Math.max(f * 2, ...yorliqlar.flat().map((m) => k.o(m))));
  const qiymatMatni = (v: number | null) => (v == null ? "—" : `${k.son(v)}${r.suffix ?? ""}`);
  const V = Math.max(f, ...r.qatorlar.map((q) => k.o(qiymatMatni(q.qiymat), f, true)));
  const x0 = P + L + f * 0.5;
  const x1 = W - P - V - f * 0.45;
  const ustunH = f * 1.05;
  const satr = f * 1.15;
  const oraliq = f * 0.5;
  const ticks = qadamlar(r.max);
  const yuqori = ticks[ticks.length - 1];
  const sx = (v: number) => x0 + (Math.max(0, Math.min(yuqori, v)) / yuqori) * (x1 - x0);

  const bosh = k.y + f * 0.2;
  let y = bosh;
  const markazlar = yorliqlar.map((ls) => {
    const h = Math.max(ustunH, ls.length * satr);
    const m = y + h / 2;
    y += h + oraliq;
    return m;
  });
  const oxir = y - oraliq + f * 0.2;

  for (const t of ticks) {
    k.chiziq(sx(t), bosh - f * 0.2, sx(t), oxir, RANG.panjara, 0.75);
    k.matn(sx(t), oxir + kichik * 1.2, `${k.son(t)}${r.suffix ?? ""}`, { px: kichik, anchor: "middle", rang: RANG.ikkinchi });
  }
  r.qatorlar.forEach((q, i) => {
    const m = markazlar[i];
    const ls = yorliqlar[i];
    ls.forEach((satrMatn, j) => k.matn(x0 - f * 0.5, k.baza(m + (j - (ls.length - 1) / 2) * satr), satrMatn, { anchor: "end" }));
    const w = q.qiymat == null ? 0 : sx(q.qiymat) - x0;
    if (w > 0) k.rect(x0, m - ustunH / 2, w, ustunH, k.seriya(q.rang ?? 0), k.chegara);
    k.matn(x0 + w + f * 0.3, k.baza(m), qiymatMatni(q.qiymat), { qalin: true });
  });
  k.chiziq(x0, bosh - f * 0.2, x0, oxir, RANG.matn, 1);
  k.y = oxir + kichik * 1.6;
}

/** Vertikal ustunli grafiklar uchun umumiy o‘qlar: y bo‘linmalari va toifa yorliqlari. */
function vertikalOqlar(k: Chizma, toifalar: string[], ticks: number[], suffix: string, butun: boolean) {
  const { f, W, P, kichik } = k;
  const tickMatn = (t: number) => `${k.son(t, butun ? 0 : undefined)}${suffix}`;
  const Ly = Math.max(...ticks.map((t) => k.o(tickMatn(t), kichik)));
  const x0 = P + Ly + f * 0.45;
  const x1 = W - P;
  const gw = (x1 - x0) / Math.max(1, toifalar.length);
  const yorliqW = gw - f * 0.25;
  const yorliqPx = mosOlcham(toifalar, yorliqW, f * 0.92, f * 0.7, (m, px, q) => k.o(m, px, q));
  const yorliqlar = toifalar.map((t) => sindirish(t, yorliqW, (m) => k.o(m, yorliqPx), 4));
  const ust = k.y + f * 0.9;
  const balandlik = Math.max(f * 9, Math.min(f * 16, (x1 - x0) * 0.42));
  const past = ust + balandlik;
  const yuqori = ticks[ticks.length - 1];
  const sy = (v: number) => past - (Math.max(0, Math.min(yuqori, v)) / yuqori) * balandlik;

  for (const t of ticks) {
    k.chiziq(x0, sy(t), x1, sy(t), RANG.panjara, 0.75);
    k.matn(x0 - f * 0.3, k.baza(sy(t), kichik), tickMatn(t), { px: kichik, anchor: "end", rang: RANG.ikkinchi });
  }
  const yorliqlarniChizish = () => {
    yorliqlar.forEach((ls, i) =>
      ls.forEach((m, j) =>
        k.matn(x0 + (i + 0.5) * gw, past + yorliqPx * 1.25 + j * yorliqPx * 1.15, m, { px: yorliqPx, anchor: "middle" }),
      ),
    );
    k.chiziq(x0, past, x1, past, RANG.matn, 1);
    k.y = past + yorliqPx * 0.5 + Math.max(...yorliqlar.map((l) => l.length)) * yorliqPx * 1.15 + f * 0.2;
  };
  return { x0, gw, sy, past, yorliqlarniChizish };
}

function guruhli(k: Chizma, r: Extract<Rasm, { tur: "guruhli" }>) {
  const { f } = k;
  k.legend(r.seriyalar.map((s, i) => ({ nomi: s.nomi, rang: k.seriya(s.rang ?? i) })));
  const eng = Math.max(0, ...r.seriyalar.flatMap((s) => s.qiymatlar.map((v) => v ?? 0)));
  const ticks = qadamlar(r.max ?? eng);
  const { x0, gw, sy, past, yorliqlarniChizish } = vertikalOqlar(k, r.toifalar, ticks, r.suffix ?? "", false);
  const ns = Math.max(1, r.seriyalar.length);
  const ichki = gw * 0.78;
  const bw = ichki / ns;
  const qiymatPx = f * 0.74;
  r.toifalar.forEach((_, gi) => {
    const bosh = x0 + gi * gw + (gw - ichki) / 2;
    r.seriyalar.forEach((s, si) => {
      const v = s.qiymatlar[gi];
      if (v == null) return;
      const x = bosh + si * bw + bw * 0.06;
      const w = bw * 0.88;
      k.rect(x, sy(v), w, past - sy(v), k.seriya(s.rang ?? si), k.chegara);
      const m = k.son(v);
      if (k.o(m, qiymatPx) <= bw * 1.02) k.matn(x + w / 2, sy(v) - f * 0.22, m, { px: qiymatPx, anchor: "middle" });
    });
  });
  yorliqlarniChizish();
}

function ustun(k: Chizma, r: Extract<Rasm, { tur: "ustun" }>) {
  const { f } = k;
  const eng = Math.max(1, ...r.ustunlar.map((u) => u.qiymat));
  const ticks = qadamlar(eng, true);
  const { x0, gw, sy, past, yorliqlarniChizish } = vertikalOqlar(k, r.ustunlar.map((u) => u.nomi), ticks, "", true);
  const palitra = k.s.rangli ? DARAJA_RANGLI : DARAJA_OQQORA;
  const n = r.darajalar ?? r.ustunlar.length;
  r.ustunlar.forEach((u, i) => {
    const w = gw * 0.56;
    const x = x0 + i * gw + (gw - w) / 2;
    const rang =
      u.rang == null ? k.seriya(0) : palitra[n <= 1 ? palitra.length - 1 : Math.round((u.rang * (palitra.length - 1)) / (n - 1))];
    k.rect(x, sy(u.qiymat), w, past - sy(u.qiymat), rang, k.s.rangli ? undefined : RANG.matn);
    k.matn(x + w / 2, sy(u.qiymat) - f * 0.25, k.son(u.qiymat, 0), { qalin: true, anchor: "middle" });
  });
  yorliqlarniChizish();
}

function issiqlik(k: Chizma, r: Extract<Rasm, { tur: "issiqlik" }>) {
  const { f, W, P, kichik } = k;
  const ton = k.s.rangli ? TON[r.ton] : TON.qora;
  const nC = Math.max(1, r.ustunlar.length);
  const soniW = r.soniUstuni
    ? Math.max(k.o(r.soniUstuni, kichik, true), ...r.qatorlar.map((q) => k.o(String(q.soni ?? ""), f))) + f * 0.8
    : 0;
  // Ustunlar kam bo‘lsa, nomlar ustuni kengroq (har katakka kamida ~3,5 f qoladi)
  const maxL = Math.max(W * 0.3, Math.min(W * 0.5, W - 2 * P - soniW - nC * f * 3.5));
  const izohPx = f * 0.8;
  const yorliqlar = r.qatorlar.map((q) => sindirish(q.nomi, maxL, (m) => k.o(m), 2));
  const L =
    Math.min(
      maxL,
      Math.max(
        k.o(r.birinchiUstun, kichik, true),
        ...yorliqlar.flat().map((m) => k.o(m)),
        ...r.qatorlar.map((q) => (q.izoh ? k.o(q.izoh, izohPx) : 0)),
      ),
    ) + f * 0.6;
  const cellW = (W - 2 * P - L - soniW) / nC;
  // Ustun nomlari: eng uzun so‘z katakka sig‘guncha shrift kichraytiriladi (0,62 f gacha)
  const ichkiW = cellW - f * 0.3;
  const hdrPx = mosOlcham(r.ustunlar, ichkiW, kichik, f * 0.62, (m, px, q) => k.o(m, px, q), true);
  const sarlavhalar = r.ustunlar.map((u) => sindirish(u, ichkiW, (m) => k.o(m, hdrPx, true), 4));
  const satrH = hdrPx * 1.15;
  const hdrH = Math.max(1, ...sarlavhalar.map((l) => l.length)) * satrH + f * 0.45;

  // sarlavha qatori (pastga tekislangan)
  const hdrPast = k.y + hdrH;
  k.matn(P, hdrPast - f * 0.35, r.birinchiUstun, { px: kichik, qalin: true });
  if (r.soniUstuni) k.matn(P + L + soniW / 2, hdrPast - f * 0.35, r.soniUstuni, { px: kichik, qalin: true, anchor: "middle" });
  sarlavhalar.forEach((ls, c) => {
    const cx = P + L + soniW + (c + 0.5) * cellW;
    ls.forEach((m, j) =>
      k.matn(cx, hdrPast - f * 0.35 - (ls.length - 1 - j) * satrH, m, { px: hdrPx, qalin: true, anchor: "middle" }),
    );
  });
  k.chiziq(P, hdrPast, W - P, hdrPast, RANG.matn, 1);

  let y = hdrPast + 2;
  r.qatorlar.forEach((q, i) => {
    if (q.guruh && q.guruh !== r.qatorlar[i - 1]?.guruh) {
      const gh = f * 1.45;
      k.matn(P, k.baza(y + gh / 2 + f * 0.1, kichik), q.guruh, { px: kichik, qalin: true, rang: RANG.ikkinchi });
      y += gh;
    }
    const ls = yorliqlar[i];
    const ichki = ls.length * f * 1.15 + (q.izoh ? izohPx * 1.2 : 0);
    const h = Math.max(f * 1.75, ichki + f * 0.55);
    const m = y + h / 2;
    let ty = m - ichki / 2 + f * 0.85;
    for (const satr of ls) {
      k.matn(P, ty, satr);
      ty += f * 1.15;
    }
    if (q.izoh) k.matn(P, ty - f * 0.15, q.izoh, { px: izohPx, rang: RANG.ikkinchi });
    if (r.soniUstuni) k.matn(P + L + soniW / 2, k.baza(m), String(q.soni ?? "—"), { anchor: "middle", rang: RANG.ikkinchi });
    q.qiymatlar.forEach((v, c) => {
      const x = P + L + soniW + c * cellW;
      if (v == null) {
        k.rect(x + 1, y + 1, cellW - 2, h - 2, RANG.bosh);
        k.matn(x + cellW / 2, k.baza(m), "—", { anchor: "middle", rang: RANG.ikkinchi });
        return;
      }
      const t = r.max > 0 ? Math.max(0, Math.min(1, v / r.max)) : 0;
      const fill = aralash(RANG.oq, ton, 0.06 + 0.86 * t);
      k.rect(x + 1, y + 1, cellW - 2, h - 2, fill);
      k.matn(x + cellW / 2, k.baza(m), `${k.son(v)}${r.suffix ?? ""}`, {
        anchor: "middle",
        rang: yorqinlik(fill) < 0.36 ? RANG.oq : RANG.matn,
      });
    });
    y += h;
  });

  // rang shkalasi
  y += f * 0.7;
  const swW = f * 1.5;
  const swH = f * 0.75;
  let x = P;
  k.matn(x, k.baza(y + swH / 2, kichik), r.shkala.past, { px: kichik, rang: RANG.ikkinchi });
  x += k.o(r.shkala.past, kichik) + f * 0.4;
  for (let s = 0; s < 6; s++) {
    k.rect(x + s * swW, y, swW, swH, aralash(RANG.oq, ton, 0.06 + (0.86 * s) / 5), s === 0 ? RANG.panjara : undefined);
  }
  x += 6 * swW + f * 0.4;
  k.matn(x, k.baza(y + swH / 2, kichik), r.shkala.yuqori, { px: kichik, rang: RANG.ikkinchi });
  k.y = y + swH + f * 0.2;
}

function chiziq(k: Chizma, r: Extract<Rasm, { tur: "chiziq" }>) {
  const { f, W, P, kichik } = k;
  const uslub = (i: number) =>
    k.s.rangli
      ? { rang: k.seriya(i), dash: "", markerFill: k.seriya(i) }
      : { ...CHIZIQ_OQQORA[i % CHIZIQ_OQQORA.length], markerFill: i % 2 ? RANG.oq : CHIZIQ_OQQORA[i % CHIZIQ_OQQORA.length].rang };
  const tartib = (s: { rang?: number }, i: number) => s.rang ?? i;
  k.legend(
    r.seriyalar.map((s, i) => {
      const u = uslub(tartib(s, i));
      return { nomi: s.nomi, rang: u.rang, chiziq: { dash: u.dash, marker: tartib(s, i), markerFill: u.markerFill } };
    }),
  );
  const ticks = qadamlar(r.max);
  const yuqori = ticks[ticks.length - 1];
  const Ly = Math.max(...ticks.map((t) => k.o(k.son(t), kichik)));
  const x0 = P + Ly + f * 0.45;
  const x1 = W - P - f * 0.4;
  const ust = k.y + f * 0.5;
  const balandlik = Math.max(f * 9, Math.min(f * 15, (x1 - x0) * 0.4));
  const past = ust + balandlik;
  const sy = (v: number) => past - (Math.max(0, Math.min(yuqori, v)) / yuqori) * balandlik;
  const n = r.davrlar.length;
  const chet = f * 0.7;
  const sx = (i: number) => (n === 1 ? (x0 + x1) / 2 : x0 + chet + (i * (x1 - x0 - 2 * chet)) / (n - 1));

  for (const t of ticks) {
    k.chiziq(x0, sy(t), x1, sy(t), RANG.panjara, 0.75);
    k.matn(x0 - f * 0.3, k.baza(sy(t), kichik), k.son(t), { px: kichik, anchor: "end", rang: RANG.ikkinchi });
  }

  // davr yorliqlari: sig‘masa har k-chisi ko‘rsatiladi
  const joy = (x1 - x0) / Math.max(1, n);
  const engKeng = Math.max(...r.davrlar.map((d) => k.o(d, kichik)));
  const qadam = Math.max(1, Math.ceil((Math.min(engKeng, joy * 2.2) + f * 0.5) / joy));
  const yorliqKeng = joy * qadam - f * 0.2;
  let yorliqQator = 1;
  r.davrlar.forEach((d, i) => {
    if (i % qadam !== 0) return;
    const ls = sindirish(d, yorliqKeng, (m) => k.o(m, kichik), 2);
    yorliqQator = Math.max(yorliqQator, ls.length);
    k.chiziq(sx(i), past, sx(i), past + f * 0.25, RANG.matn, 1);
    // chetdagi yorliqlar rasm chegarasidan chiqmasligi uchun ichkariga suriladi
    ls.forEach((m, j) => {
      const yarim = k.o(m, kichik) / 2;
      const x = Math.max(P + yarim, Math.min(W - P - yarim, sx(i)));
      k.matn(x, past + kichik * 1.35 + j * kichik * 1.15, m, { px: kichik, anchor: "middle" });
    });
  });

  r.seriyalar.forEach((s, si) => {
    const u = uslub(tartib(s, si));
    const bolaklar: string[] = [];
    let joriy: string[] = [];
    s.qiymatlar.forEach((v, i) => {
      if (v == null) {
        if (joriy.length > 1) bolaklar.push(joriy.join(" "));
        joriy = [];
      } else joriy.push(`${joriy.length ? "L" : "M"}${n2(sx(i))},${n2(sy(v))}`);
    });
    if (joriy.length > 1) bolaklar.push(joriy.join(" "));
    for (const d of bolaklar) k.yol(d, u.rang, f * 0.13, u.dash);
    s.qiymatlar.forEach((v, i) => {
      if (v != null) k.marker(tartib(s, si), sx(i), sy(v), f * 0.22, u.markerFill, u.rang);
    });
  });
  k.chiziq(x0, past, x1, past, RANG.matn, 1);
  k.chiziq(x0, ust, x0, past, RANG.matn, 1);
  k.y = past + kichik * 0.6 + yorliqQator * kichik * 1.15 + f * 0.3;
}

/** Grafik ma’lumotidan tayyor SVG (oq fon, sm o‘lchamda). */
export function rasmSvg(rasm: Rasm, s: RasmSozlama): RasmNatija {
  const k = new Chizma(s);
  if (s.sarlavha) k.sarlavha(s.sarlavha);
  if (rasm.tur === "gorizontal") gorizontal(k, rasm);
  else if (rasm.tur === "guruhli") guruhli(k, rasm);
  else if (rasm.tur === "ustun") ustun(k, rasm);
  else if (rasm.tur === "issiqlik") issiqlik(k, rasm);
  else chiziq(k, rasm);
  return k.natija();
}

// ------------------------------------------------------------------ PNG: jismoniy o‘lcham (dpi)

const CRC_JADVAL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_JADVAL[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * PNG fayliga pHYs bo‘lagini (piksel zichligi) yozadi — Word rasmni to‘g‘ri jismoniy kattalikda
 * (masalan, 16 sm) qo‘yadi. Mavjud pHYs almashtiriladi.
 */
export function pngDpi(png: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  const ppm = Math.round(dpi / 0.0254);
  const phys = new Uint8Array(21);
  const dv = new DataView(phys.buffer);
  dv.setUint32(0, 9);
  phys.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  phys[16] = 1; // birlik: metr
  dv.setUint32(17, crc32(phys.subarray(4, 17)));

  const bolaklar: Uint8Array[] = [png.subarray(0, 8)];
  const oqish = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let i = 8;
  while (i + 12 <= png.length) {
    const len = oqish.getUint32(i);
    const tur = String.fromCharCode(png[i + 4], png[i + 5], png[i + 6], png[i + 7]);
    const bolak = png.subarray(i, i + 12 + len);
    i += 12 + len;
    if (tur === "pHYs") continue;
    bolaklar.push(bolak);
    if (tur === "IHDR") bolaklar.push(phys);
  }
  const natija = new Uint8Array(bolaklar.reduce((s, b) => s + b.length, 0));
  let o = 0;
  for (const b of bolaklar) {
    natija.set(b, o);
    o += b.length;
  }
  return natija;
}

/** Fayl nomi uchun xavfsiz qism: harf va raqamlar saqlanadi (kirill ham). */
export function faylNomi(sarlavha: string): string {
  const s = sarlavha
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `MediaPrag_${s || "rasm"}`;
}
