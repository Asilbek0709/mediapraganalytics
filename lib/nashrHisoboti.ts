/**
 * Nashr hisoboti (redaksion tahlil uchun): bitta nashrning ko‘rsatkichlari butun korpus bilan
 * taqqoslanadi — o‘rni, kuchli va zaif tomonlari, muammolar profili, muvofiqlik, sarlavha turlari,
 * dinamika va korpusdan tipik misollar.
 *
 * Faqat to‘liq tahlil qilingan materiallar. Davr (dan/gacha) berilsa — nashr ham, korpus ham shu davrda.
 * Kuchli/zaif tomonlar shaffof qoida bilan aniqlanadi (sun’iy intellekt emas): ko‘rsatkichda ±CHEGARA_BALL,
 * muammo ulushida ±CHEGARA_FP; statistik ahamiyat alohida ko‘rsatiladi.
 */
import { all, one } from "./db";
import { kesim, materialQatorlari, ortacha, type MaterialQator } from "./analytics";
import { KORSATKICHLAR, type Korsatkich } from "./davrlar";
import type { Misol } from "./misollar";
import { misollarKorpusi } from "./misollarBaza";
import { ApiError } from "./queries";
import { nashrReytingi } from "./reyting";
import { daraja, metodikaniYuklash } from "./scoring";
import { fisherAniq, holm, mannWhitney, rEffekti, type EffektKuchi, type MannWhitneyNatija } from "./statistika";
import type { MediaTuri, Qism, ShkalaOraliq } from "./types";

export const ALFA = 0.05;
/** Ko‘rsatkich o‘rtachadan shuncha ball farq qilsa — kuchli yoki zaif tomon */
export const CHEGARA_BALL = 5;
/** Muammo ulushi o‘rtachadan shuncha foiz punkt farq qilsa — e’tibor talab qiladi yoki ustunlik */
export const CHEGARA_FP = 10;
const MISOL_KATEGORIYA = 3;
const MISOL_SONI = 2;

export interface KorsatkichQatori {
  k: Korsatkich;
  nashr: number | null;
  korpus: number | null;
  /** shu media turidagi (bosma yoki raqamli) nashrlar o‘rtachasi */
  turdagi: number | null;
  farq: number | null;
  orin: number | null;
  teng: boolean;
  /** nashr va qolgan nashrlar: Mann–Whitney (r > 0 — nashr yuqori) */
  test: MannWhitneyNatija | null;
  effekt: EffektKuchi | null;
}

export interface UlushQatori {
  kod: string;
  nomi: string;
  mezon: string | null;
  /** nashr materiallaridan nechtasida uchragan va jami birliklar */
  bor: number;
  birliklar: number;
  ulush: number;
  korpusUlush: number;
  farq: number;
  /** nashr va qolgan nashrlar: Fisher, Holm (faqat muammolar uchun) */
  pHolm: number | null;
}

export interface MuvofiqlikQatori {
  munosabat: "sar_lid" | "lid_matn" | "sar_matn";
  nashr: Record<"mos" | "qisman" | "mos_emas", number>;
  korpus: Record<"mos" | "qisman" | "mos_emas", number>;
}

export interface Xulosa {
  tur: "korsatkich" | "muammo";
  kod: string;
  nomi: string;
  qiymat: number;
  korpus: number;
  farq: number;
  ahamiyatli: boolean;
}

export interface NashrHisoboti {
  nashr: { id: number; nomi: string; turi: MediaTuri };
  davr: { dan: string | null; gacha: string | null };
  /** tahlil qilingan materiallarning eng erta va eng kech sanasi */
  sanalar: { min: string | null; max: string | null };
  soni: { jami: number; toliq: number; korpus: number; nashrlar: number; turdagiNashrlar: number };
  lpsi: number | null;
  daraja: string | null;
  korsatkichlar: KorsatkichQatori[];
  kuchli: Xulosa[];
  zaif: Xulosa[];
  muammolar: UlushQatori[];
  vositalar: UlushQatori[];
  /** muammo belgilarining matn qismlari bo‘yicha taqsimoti (%) */
  qismlar: { nashr: Record<Qism, number>; korpus: Record<Qism, number>; jami: number };
  muvofiqlik: MuvofiqlikQatori[];
  sarlavhaTurlari: { kod: string; nomi: string; ulush: number; korpusUlush: number }[];
  dinamika: { granulyatsiya: "oy" | "chorak" | "yil"; davrlar: { kalit: string; soni: number; lpsi: number | null; korpus: number | null }[] };
  misollar: { kod: string; nomi: string; ulush: number; royxat: Misol[] }[];
  eng: { yuqori: EngMaterial[]; past: EngMaterial[] };
  metodika_versiya: number;
  shkala: ShkalaOraliq[];
}

export interface EngMaterial {
  id: number;
  sarlavha: string;
  sana: string | null;
  lpsi: number;
  daraja: string | null;
}

const yaxlit = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
const foiz = (k: number, n: number) => (n ? Math.round((k / n) * 1000) / 10 : 0);
const sanaFiltri = (sana: string | null, d: { dan: string | null; gacha: string | null }) =>
  (!d.dan || (!!sana && sana >= d.dan)) && (!d.gacha || (!!sana && sana <= d.gacha));

function davrKaliti(sana: string, g: "oy" | "chorak" | "yil") {
  if (g === "yil") return sana.slice(0, 4);
  if (g === "chorak") return `${sana.slice(0, 4)}-Q${Math.ceil(Number(sana.slice(5, 7)) / 3)}`;
  return sana.slice(0, 7);
}

export function nashrHisoboti(nashrId: number, davr: { dan?: string; gacha?: string } = {}): NashrHisoboti {
  const nashr = one<{ id: number; nomi: string; turi: MediaTuri }>("SELECT id, nomi, turi FROM nashrlar WHERE id = ?", [nashrId]);
  if (!nashr) throw new ApiError(404, "x.nashrTopilmadi");
  const d = { dan: davr.dan ?? null, gacha: davr.gacha ?? null };
  const m = metodikaniYuklash();

  const davrdagi = materialQatorlari().filter((q) => sanaFiltri(q.sana, d));
  const korpus = davrdagi.filter((q) => q.lpsi != null);
  const oz = korpus.filter((q) => q.nashr_id === nashrId);
  const qolgan = korpus.filter((q) => q.nashr_id !== nashrId);
  const turdagi = korpus.filter((q) => q.media_turi === nashr.turi);
  const idlar = new Set(oz.map((q) => q.id));
  const korpusIdlar = new Set(korpus.map((q) => q.id));

  // --------------------------------------------------------------- ko‘rsatkichlar va o‘rin
  const nashrlarKesimi = kesim(korpus, m, (q) => q.nashr);
  const korsatkichlar: KorsatkichQatori[] = KORSATKICHLAR.map((k) => {
    const qiymatlar = (qs: MaterialQator[]) => qs.map((q) => q[k]).filter((v): v is number => v != null);
    const n = ortacha(qiymatlar(oz));
    const kp = ortacha(qiymatlar(korpus));
    const r = nashrReytingi(nashrlarKesimi, k).find((x) => x.nomi === nashr.nomi);
    const test = oz.length >= 2 && qolgan.length >= 2 ? mannWhitney(qiymatlar(oz), qiymatlar(qolgan)) : null;
    return {
      k,
      nashr: n,
      korpus: kp,
      turdagi: ortacha(qiymatlar(turdagi)),
      farq: n != null && kp != null ? yaxlit(n - kp) : null,
      orin: r?.orin ?? null,
      teng: r?.teng ?? false,
      test,
      effekt: test ? rEffekti(test.r) : null,
    };
  });

  // --------------------------------------------------------------- muammolar va vositalar
  const birliklar = new Map<string, number>();
  for (const q of oz) for (const [kod, n] of Object.entries(q.sanoq)) birliklar.set(kod, (birliklar.get(kod) ?? 0) + n);
  const ulushQatori = (kod: string, nomi: string, mezon: string | null): Omit<UlushQatori, "pHolm"> & { p: number } => {
    const bor = oz.filter((q) => (q.sanoq[kod] ?? 0) > 0).length;
    const korpusBor = korpus.filter((q) => (q.sanoq[kod] ?? 0) > 0).length;
    const qolganBor = korpusBor - bor;
    const ulush = foiz(bor, oz.length);
    const korpusUlush = foiz(korpusBor, korpus.length);
    return {
      kod,
      nomi,
      mezon,
      bor,
      birliklar: birliklar.get(kod) ?? 0,
      ulush,
      korpusUlush,
      farq: Math.round((ulush - korpusUlush) * 10) / 10,
      p: fisherAniq(bor, oz.length - bor, qolganBor, qolgan.length - qolganBor),
    };
  };
  const kategoriyalar = Object.values(m.kategoriyalar).sort((a, b) => a.tartib - b.tartib);
  const testMumkin = oz.length >= 2 && qolgan.length >= 2;
  const muammoXom = kategoriyalar.filter((k) => k.guruh === "muammo").map((k) => ulushQatori(k.kod, k.nomi, k.mezon));
  const tuzatilgan = holm(muammoXom.map((q) => q.p));
  const muammolar = muammoXom.map(({ p: _p, ...q }, i) => ({ ...q, pHolm: testMumkin ? tuzatilgan[i] : null }));
  const vositalar = kategoriyalar
    .filter((k) => k.guruh === "vosita")
    .map((k) => {
      const { p: _p, ...q } = ulushQatori(k.kod, k.nomi, k.mezon);
      return { ...q, pHolm: null };
    });

  // --------------------------------------------------------------- kuchli va zaif tomonlar
  const mezonNomi = Object.fromEntries(all<{ kod: string; nomi: string }>("SELECT kod, nomi FROM mezonlar").map((x) => [x.kod, x.nomi]));
  const kuchli: Xulosa[] = [];
  const zaif: Xulosa[] = [];
  for (const q of korsatkichlar) {
    if (q.k === "lpsi" || q.nashr == null || q.korpus == null || q.farq == null) continue;
    const x: Xulosa = {
      tur: "korsatkich",
      kod: q.k.toUpperCase(),
      nomi: mezonNomi[q.k.toUpperCase()] ?? q.k.toUpperCase(),
      qiymat: yaxlit(q.nashr)!,
      korpus: yaxlit(q.korpus)!,
      farq: q.farq,
      ahamiyatli: !!q.test && q.test.p < ALFA,
    };
    if (q.farq >= CHEGARA_BALL) kuchli.push(x);
    else if (q.farq <= -CHEGARA_BALL) zaif.push(x);
  }
  for (const q of muammolar) {
    const x: Xulosa = {
      tur: "muammo",
      kod: q.kod,
      nomi: q.nomi,
      qiymat: q.ulush,
      korpus: q.korpusUlush,
      farq: q.farq,
      ahamiyatli: q.pHolm != null && q.pHolm < ALFA,
    };
    // Muammo kam uchrashi — kuchli tomon, ko‘p uchrashi — zaif tomon
    if (q.farq <= -CHEGARA_FP) kuchli.push(x);
    else if (q.farq >= CHEGARA_FP) zaif.push(x);
  }
  // Avval statistik ahamiyatlilar, keyin mezonlar (asosiy baho), keyin muammolar; ichida — farq kattaligi bo‘yicha
  const tartib = (a: Xulosa, b: Xulosa) =>
    Number(b.ahamiyatli) - Number(a.ahamiyatli) ||
    Number(b.tur === "korsatkich") - Number(a.tur === "korsatkich") ||
    Math.abs(b.farq) - Math.abs(a.farq);
  kuchli.sort(tartib);
  zaif.sort(tartib);

  // --------------------------------------------------------------- matn qismlari
  const qismSanoq = all<{ material_id: number; qism: Qism; soni: number }>(
    `SELECT b.material_id, b.qism, COUNT(*) AS soni
     FROM belgilar b JOIN kategoriyalar k ON k.kod = b.kategoriya
     WHERE k.guruh = 'muammo' GROUP BY b.material_id, b.qism`,
  ).filter((r) => korpusIdlar.has(r.material_id));
  const qismFoiz = (rows: typeof qismSanoq) => {
    const jami = rows.reduce((s, r) => s + r.soni, 0);
    const q = (qism: Qism) => foiz(rows.filter((r) => r.qism === qism).reduce((s, r) => s + r.soni, 0), jami);
    return { foizlar: { sarlavha: q("sarlavha"), lid: q("lid"), matn: q("matn") }, jami };
  };
  const qn = qismFoiz(qismSanoq.filter((r) => idlar.has(r.material_id)));
  const qk = qismFoiz(qismSanoq);

  // --------------------------------------------------------------- muvofiqlik
  const muvQatorlari = all<{ material_id: number; sar_lid: string | null; lid_matn: string | null; sar_matn: string | null }>(
    "SELECT material_id, sar_lid, lid_matn, sar_matn FROM tahlillar WHERE lpsi IS NOT NULL",
  ).filter((r) => korpusIdlar.has(r.material_id));
  const taqsimot = (rows: typeof muvQatorlari, k: "sar_lid" | "lid_matn" | "sar_matn") => {
    const bor = rows.filter((r) => r[k]);
    return {
      mos: foiz(bor.filter((r) => r[k] === "mos").length, bor.length),
      qisman: foiz(bor.filter((r) => r[k] === "qisman").length, bor.length),
      mos_emas: foiz(bor.filter((r) => r[k] === "mos_emas").length, bor.length),
    };
  };
  const muvofiqlik = (["sar_lid", "lid_matn", "sar_matn"] as const).map((k) => ({
    munosabat: k,
    nashr: taqsimot(muvQatorlari.filter((r) => idlar.has(r.material_id)), k),
    korpus: taqsimot(muvQatorlari, k),
  }));

  // --------------------------------------------------------------- sarlavha turlari
  const turlar = all<{ kod: string; nomi: string }>("SELECT kod, nomi FROM lugat WHERE turkum = 'sarlavha_turi' ORDER BY tartib");
  const sarlavhaTurlari = turlar
    .map((tur) => ({
      kod: tur.kod,
      nomi: tur.nomi,
      ulush: foiz(oz.filter((q) => q.sarlavha_turlari.includes(tur.kod)).length, oz.length),
      korpusUlush: foiz(korpus.filter((q) => q.sarlavha_turlari.includes(tur.kod)).length, korpus.length),
    }))
    .filter((x) => x.ulush > 0 || x.korpusUlush > 0)
    .sort((a, b) => b.ulush - a.ulush || b.korpusUlush - a.korpusUlush);

  // --------------------------------------------------------------- dinamika
  const sanali = oz.filter((q) => q.sana && /^\d{4}-\d{2}/.test(q.sana)).map((q) => q.sana!).sort();
  const oylar = sanali.length ? (Number(sanali.at(-1)!.slice(0, 4)) - Number(sanali[0].slice(0, 4))) * 12 + Number(sanali.at(-1)!.slice(5, 7)) - Number(sanali[0].slice(5, 7)) : 0;
  const granulyatsiya = oylar > 36 ? "yil" : oylar > 8 ? "chorak" : "oy";
  const kalitlar = [...new Set(sanali.map((s) => davrKaliti(s, granulyatsiya)))].sort();
  const dinamika = {
    granulyatsiya,
    davrlar: kalitlar.map((kalit) => {
      const ichida = (q: MaterialQator) => !!q.sana && davrKaliti(q.sana, granulyatsiya) === kalit;
      const n = oz.filter(ichida);
      return { kalit, soni: n.length, lpsi: yaxlit(ortacha(n.map((q) => q.lpsi))), korpus: yaxlit(ortacha(korpus.filter(ichida).map((q) => q.lpsi))) };
    }),
  } as NashrHisoboti["dinamika"];

  // --------------------------------------------------------------- tipik misollar (korpusdan)
  const misollar = misollarKorpusi()
    .misollar.filter((x) => x.nashr_id === nashrId && x.guruh === "muammo" && idlar.has(x.material_id))
    .sort(
      (a, b) =>
        Number(b.tanlangan) - Number(a.tanlangan) ||
        b.tasdiq - a.tasdiq ||
        Number(!!b.kontekst) - Number(!!a.kontekst) ||
        (b.sana ?? "").localeCompare(a.sana ?? ""),
    );
  const misolGuruhlari = [...muammolar]
    .filter((q) => q.bor > 0)
    .sort((a, b) => b.ulush - a.ulush || b.birliklar - a.birliklar)
    .map((q) => ({ kod: q.kod, nomi: q.nomi, ulush: q.ulush, royxat: misollar.filter((x) => x.kategoriya === q.kod).slice(0, MISOL_SONI) }))
    .filter((g) => g.royxat.length > 0)
    .slice(0, MISOL_KATEGORIYA);

  // --------------------------------------------------------------- eng yuqori va eng past materiallar
  const saralangan = [...oz].sort((a, b) => b.lpsi! - a.lpsi! || (b.sana ?? "").localeCompare(a.sana ?? ""));
  const engM = (q: MaterialQator): EngMaterial => ({ id: q.id, sarlavha: q.sarlavha, sana: q.sana, lpsi: q.lpsi!, daraja: q.daraja });
  const engSoni = Math.min(3, Math.floor(saralangan.length / 2));

  const lpsi = yaxlit(ortacha(oz.map((q) => q.lpsi)));
  return {
    nashr,
    davr: d,
    sanalar: { min: sanali[0] ?? null, max: sanali.at(-1) ?? null },
    soni: {
      jami: davrdagi.filter((q) => q.nashr_id === nashrId).length,
      toliq: oz.length,
      korpus: korpus.length,
      nashrlar: nashrlarKesimi.length,
      turdagiNashrlar: new Set(turdagi.map((q) => q.nashr_id)).size,
    },
    lpsi,
    daraja: lpsi == null ? null : daraja(lpsi, m.shkala),
    korsatkichlar: korsatkichlar.map((q) => ({ ...q, nashr: yaxlit(q.nashr), korpus: yaxlit(q.korpus), turdagi: yaxlit(q.turdagi) })),
    kuchli,
    zaif,
    muammolar,
    vositalar,
    qismlar: { nashr: qn.foizlar, korpus: qk.foizlar, jami: qn.jami },
    muvofiqlik,
    sarlavhaTurlari,
    dinamika,
    misollar: misolGuruhlari,
    eng: { yuqori: saralangan.slice(0, engSoni).map(engM), past: saralangan.slice(-engSoni).reverse().map(engM) },
    metodika_versiya: m.versiya,
    shkala: m.shkala,
  };
}

/** Hisobot uchun nashrlar ro‘yxati: davrdagi to‘liq tahlil qilingan materiallar soni bilan. */
export function hisobotNashrlari(): { id: number; nomi: string; turi: MediaTuri; toliq: number }[] {
  return all<{ id: number; nomi: string; turi: MediaTuri; toliq: number }>(
    `SELECT n.id, n.nomi, n.turi, COUNT(t.material_id) AS toliq
     FROM nashrlar n
     LEFT JOIN materiallar m ON m.nashr_id = n.id
     LEFT JOIN tahlillar t ON t.material_id = m.id AND t.lpsi IS NOT NULL
     GROUP BY n.id ORDER BY n.turi, n.nomi`,
  );
}

