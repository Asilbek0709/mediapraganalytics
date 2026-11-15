/**
 * «Analitika» bo‘limi: filtrlangan kesimlar, muammo xaritasi, sarlavha turlari
 * va vaqt bo‘yicha dinamika.
 *
 * Barcha hisob-kitoblar faqat to‘liq tahlil qilingan materiallar bo‘yicha.
 */
import { ahamiyatTestlari, type Ahamiyat } from "./ahamiyat.ts";
import { all } from "./db.ts";
import { JANR_YOQ, kesim, materialQatorlari, ortacha, type MaterialQator } from "./analytics.ts";
import type { AnalitikaMateriali } from "./davrlar.ts";
import { metodikaniYuklash } from "./scoring.ts";
import type { Kategoriya, Kesim, MediaTuri, Mezon, Qism, ShkalaOraliq } from "./types.ts";

export interface AnalitikaFiltr {
  turi?: MediaTuri;
  janr?: string;
  nashr_id?: number;
  dan?: string;
  gacha?: string;
}

export type Granulyatsiya = "oy" | "chorak" | "yil";
export type SeriyaKalit = "hammasi" | "bosma" | "raqamli";

export interface DinamikaNuqta {
  soni: number;
  lpsi: number | null;
  k1: number | null;
  k2: number | null;
  k3: number | null;
  k4: number | null;
  k5: number | null;
}

/** Davr va seriya nomlari mijozda tarjima qilinadi (tr.davr, an.seriya.*). */
export interface Dinamika {
  davrlar: { kalit: string }[];
  seriyalar: { kalit: SeriyaKalit; nuqtalar: (DinamikaNuqta | null)[] }[];
}

export interface QismQatori {
  kod: string;
  nomi: string;
  guruh: "muammo" | "vosita";
  sarlavha: number;
  lid: number;
  matn: number;
  jami: number;
}

export interface SarlavhaTuri {
  kod: string;
  nomi: string;
  soni: number;
  ulush: number;
  bosma: number | null;
  raqamli: number | null;
}

export interface Analitika {
  filtr: AnalitikaFiltr;
  jami: number;
  tahlil_qilingan: number;
  sanasiz: number;
  ortacha_lpsi: number | null;
  kesimlar: { nashr: Kesim[]; media_turi: Kesim[]; janr: Kesim[] };
  muammolar: Kategoriya[];
  qismlar: QismQatori[];
  sarlavhaTurlari: SarlavhaTuri[];
  dinamika: Record<Granulyatsiya, Dinamika>;
  ahamiyat: Ahamiyat;
  /** filtrga mos, to‘liq tahlil qilingan materiallar — davrlarni taqqoslash va reyting uchun */
  materiallar: AnalitikaMateriali[];
  shkala: ShkalaOraliq[];
  mezonlar: Mezon[];
  tanlovlar: { nashrlar: { id: number; nomi: string; turi: MediaTuri }[]; janrlar: string[] };
}


function davrKaliti(sana: string, g: Granulyatsiya): string {
  const yil = sana.slice(0, 4);
  const oy = Number(sana.slice(5, 7));
  if (g === "yil") return yil;
  if (g === "chorak") return `${yil}-Q${Math.ceil(oy / 3)}`;
  return sana.slice(0, 7);
}

/** Birinchi va oxirgi davr orasidagi barcha davrlar (bo‘shlari ham) — o‘q uzluksiz bo‘lishi uchun. */
function davrOraligi(kalitlar: string[], g: Granulyatsiya): string[] {
  if (!kalitlar.length) return [];
  const saralangan = [...kalitlar].sort();
  const [bosh, oxir] = [saralangan[0], saralangan[saralangan.length - 1]];
  const natija: string[] = [];
  if (g === "yil") {
    for (let y = Number(bosh); y <= Number(oxir); y++) natija.push(String(y));
  } else if (g === "chorak") {
    let [y, q] = [Number(bosh.slice(0, 4)), Number(bosh.slice(-1))];
    const [yo, qo] = [Number(oxir.slice(0, 4)), Number(oxir.slice(-1))];
    while (y < yo || (y === yo && q <= qo)) {
      natija.push(`${y}-Q${q}`);
      q += 1;
      if (q > 4) [y, q] = [y + 1, 1];
    }
  } else {
    let [y, m] = [Number(bosh.slice(0, 4)), Number(bosh.slice(5, 7))];
    const [yo, mo] = [Number(oxir.slice(0, 4)), Number(oxir.slice(5, 7))];
    while (y < yo || (y === yo && m <= mo)) {
      natija.push(`${y}-${String(m).padStart(2, "0")}`);
      m += 1;
      if (m > 12) [y, m] = [y + 1, 1];
    }
  }
  return natija;
}

function nuqta(items: MaterialQator[]): DinamikaNuqta | null {
  if (!items.length) return null;
  return {
    soni: items.length,
    lpsi: ortacha(items.map((i) => i.lpsi)),
    k1: ortacha(items.map((i) => i.k1)),
    k2: ortacha(items.map((i) => i.k2)),
    k3: ortacha(items.map((i) => i.k3)),
    k4: ortacha(items.map((i) => i.k4)),
    k5: ortacha(items.map((i) => i.k5)),
  };
}

function dinamika(t: MaterialQator[], g: Granulyatsiya): Dinamika {
  const sanali = t.filter((q) => q.sana && /^\d{4}-\d{2}/.test(q.sana));
  const davrlar = davrOraligi([...new Set(sanali.map((q) => davrKaliti(q.sana!, g)))], g);
  const turlar = new Set(sanali.map((q) => q.media_turi));
  const kalitlar: SeriyaKalit[] = ["hammasi", ...(["bosma", "raqamli"] as const).filter((k) => turlar.has(k))];

  return {
    davrlar: davrlar.map((kalit) => ({ kalit })),
    seriyalar: kalitlar.map((kalit) => ({
      kalit,
      nuqtalar: davrlar.map((d) =>
        nuqta(
          sanali.filter((q) => davrKaliti(q.sana!, g) === d && (kalit === "hammasi" || q.media_turi === kalit)),
        ),
      ),
    })),
  };
}

export function filtrniTekshirish(p: Record<string, string | string[] | undefined>): AnalitikaFiltr {
  const bitta = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  const sanami = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const turi = bitta(p.turi);
  const nashrId = Number(bitta(p.nashr_id));
  return {
    turi: turi === "bosma" || turi === "raqamli" ? turi : undefined,
    janr: bitta(p.janr),
    nashr_id: Number.isInteger(nashrId) && nashrId > 0 ? nashrId : undefined,
    dan: sanami(bitta(p.dan)),
    gacha: sanami(bitta(p.gacha)),
  };
}

export async function analitika(filtr: AnalitikaFiltr = {}): Promise<Analitika> {
  const m = await metodikaniYuklash();
  const hammasi = await materialQatorlari();

  const mos = hammasi.filter((q) => {
    if (filtr.turi && q.media_turi !== filtr.turi) return false;
    if (filtr.janr && q.janr !== filtr.janr) return false;
    if (filtr.nashr_id && q.nashr_id !== filtr.nashr_id) return false;
    if (filtr.dan && (!q.sana || q.sana < filtr.dan)) return false;
    if (filtr.gacha && (!q.sana || q.sana > filtr.gacha)) return false;
    return true;
  });
  const t = mos.filter((q) => q.lpsi != null);
  const idlar = new Set(t.map((q) => q.id));

  const kategoriyalar = Object.values(m.kategoriyalar);
  const belgilar = (await all<{ material_id: number; kategoriya: string; qism: Qism }>(
    "SELECT material_id, kategoriya, qism FROM belgilar",
  )).filter((b) => idlar.has(b.material_id));

  const qismlar: QismQatori[] = kategoriyalar.map((k) => {
    const oz = belgilar.filter((b) => b.kategoriya === k.kod);
    const sanash = (qism: Qism) => oz.filter((b) => b.qism === qism).length;
    return {
      kod: k.kod,
      nomi: k.nomi,
      guruh: k.guruh,
      sarlavha: sanash("sarlavha"),
      lid: sanash("lid"),
      matn: sanash("matn"),
      jami: oz.length,
    };
  });

  const turNomlari = await all<{ kod: string; nomi: string }>(
    "SELECT kod, nomi FROM lugat WHERE turkum = 'sarlavha_turi' ORDER BY tartib",
  );
  const ulush = (items: MaterialQator[], kod: string) =>
    items.length
      ? Math.round((items.filter((q) => q.sarlavha_turlari.includes(kod)).length / items.length) * 1000) / 10
      : null;
  const bosmalar = t.filter((q) => q.media_turi === "bosma");
  const raqamlilar = t.filter((q) => q.media_turi === "raqamli");
  const sarlavhaTurlari = turNomlari
    .map((tur) => ({
      kod: tur.kod,
      nomi: tur.nomi,
      soni: t.filter((q) => q.sarlavha_turlari.includes(tur.kod)).length,
      ulush: ulush(t, tur.kod) ?? 0,
      bosma: ulush(bosmalar, tur.kod),
      raqamli: ulush(raqamlilar, tur.kod),
    }))
    .sort((a, b) => b.ulush - a.ulush);

  return {
    filtr,
    jami: mos.length,
    tahlil_qilingan: t.length,
    sanasiz: t.filter((q) => !q.sana).length,
    ortacha_lpsi: ortacha(t.map((q) => q.lpsi)),
    kesimlar: {
      nashr: kesim(mos, m, (q) => q.nashr),
      media_turi: kesim(mos, m, (q) => q.media_turi),
      janr: kesim(mos, m, (q) => q.janr ?? "—"),
    },
    muammolar: kategoriyalar.filter((k) => k.guruh === "muammo"),
    qismlar,
    sarlavhaTurlari,
    dinamika: { oy: dinamika(t, "oy"), chorak: dinamika(t, "chorak"), yil: dinamika(t, "yil") },
    ahamiyat: ahamiyatTestlari(t, m, filtr),
    materiallar: t.map((q) => ({
      id: q.id,
      nashr_id: q.nashr_id,
      nashr: q.nashr,
      media_turi: q.media_turi,
      sana: q.sana,
      janr: q.janr ?? JANR_YOQ,
      sarlavha: q.sarlavha,
      k1: q.k1,
      k2: q.k2,
      k3: q.k3,
      k4: q.k4,
      k5: q.k5,
      lpsi: q.lpsi,
      daraja: q.daraja,
      sanoq: q.sanoq,
    })),
    shkala: m.shkala,
    mezonlar: await all<Mezon>("SELECT * FROM mezonlar ORDER BY kod"),
    tanlovlar: {
      nashrlar: await all<{ id: number; nomi: string; turi: MediaTuri }>("SELECT id, nomi, turi FROM nashrlar ORDER BY turi, nomi"),
      janrlar: [...new Set(hammasi.map((q) => q.janr).filter((j): j is string => !!j))].sort(),
    },
  };
}
