/**
 * Tahlil natijalarini umumlashtirish.
 *
 * Statistikaga faqat to‘liq tahlil qilingan (LPSI hisoblangan) materiallar kiradi.
 * «Muammo ulushi» — kategoriya kamida bir marta uchragan materiallar foizi.
 */
import { all, one } from "./db.ts";
import { JANR_YOQ } from "./format.ts";
import { daraja, metodikaniYuklash } from "./scoring.ts";
import type { Dashboard, Kesim, MediaTuri, Metodika, Mezon, MuammoChastota, Qism } from "./types.ts";

export { JANR_YOQ };
const K_USTUNLAR = ["k1", "k2", "k3", "k4", "k5", "lpsi"] as const;

export interface MaterialQator {
  id: number;
  nashr_id: number;
  nashr: string;
  sana: string | null;
  sarlavha_turlari: string[];
  media_turi: MediaTuri;
  janr: string | null;
  lpsi: number | null;
  daraja: string | null;
  tahlil_bor: number;
  tahlil_sanasi: string | null;
  sarlavha: string;
  k1: number | null;
  k2: number | null;
  k3: number | null;
  k4: number | null;
  k5: number | null;
  sanoq: Record<string, number>;
}

export async function materialQatorlari(): Promise<MaterialQator[]> {
  const rows = await all<Omit<MaterialQator, "sanoq" | "sarlavha_turlari"> & { sarlavha_turlari: string | null }>(
    `SELECT m.id, m.nashr_id, n.nomi AS nashr, n.turi AS media_turi, m.sana, m.janr, m.sarlavha,
            t.material_id IS NOT NULL AS tahlil_bor, t.sarlavha_turlari,
            t.k1, t.k2, t.k3, t.k4, t.k5, t.lpsi, t.daraja, t.yangilangan AS tahlil_sanasi
     FROM materiallar m
     JOIN nashrlar n ON n.id = m.nashr_id
     LEFT JOIN tahlillar t ON t.material_id = m.id
     ORDER BY m.id`,
  );
  const belgilar = await all<{ material_id: number; kategoriya: string; soni: number }>(
    "SELECT material_id, kategoriya, COUNT(*) AS soni FROM belgilar GROUP BY material_id, kategoriya",
  );
  const sanoqlar = new Map<number, Record<string, number>>();
  for (const b of belgilar) {
    const mavjud = sanoqlar.get(b.material_id) ?? {};
    mavjud[b.kategoriya] = b.soni;
    sanoqlar.set(b.material_id, mavjud);
  }
  return rows.map((r) => ({
    ...r,
    janr: r.janr && r.janr.trim() ? r.janr : JANR_YOQ,
    sarlavha_turlari: r.sarlavha_turlari ? (JSON.parse(r.sarlavha_turlari) as string[]) : [],
    sanoq: sanoqlar.get(r.id) ?? {},
  }));
}

export const ortacha = (xs: (number | null)[]): number | null => {
  const sonlar = xs.filter((x): x is number => x != null);
  if (!sonlar.length) return null;
  return Math.round((sonlar.reduce((a, b) => a + b, 0) / sonlar.length) * 10) / 10;
};

export function kesim(
  qatorlar: MaterialQator[],
  m: Metodika,
  kalit: (q: MaterialQator) => string,
): Kesim[] {
  const tahlilQilingan = qatorlar.filter((q) => q.lpsi != null);
  const guruhlar = new Map<string, MaterialQator[]>();
  for (const q of tahlilQilingan) {
    const k = kalit(q);
    guruhlar.set(k, [...(guruhlar.get(k) ?? []), q]);
  }
  const muammolar = Object.values(m.kategoriyalar).filter((k) => k.guruh === "muammo");

  return [...guruhlar.entries()]
    .map(([nomi, items]) => {
      const lpsi = ortacha(items.map((i) => i.lpsi));
      return {
        nomi,
        media_turi: items[0].media_turi,
        soni: items.length,
        k1: ortacha(items.map((i) => i.k1)),
        k2: ortacha(items.map((i) => i.k2)),
        k3: ortacha(items.map((i) => i.k3)),
        k4: ortacha(items.map((i) => i.k4)),
        k5: ortacha(items.map((i) => i.k5)),
        lpsi,
        daraja: lpsi == null ? null : daraja(lpsi, m.shkala),
        ulushlar: Object.fromEntries(
          muammolar.map((k) => [
            k.kod,
            Math.round((items.filter((i) => (i.sanoq[k.kod] ?? 0) > 0).length / items.length) * 1000) / 10,
          ]),
        ),
      } satisfies Kesim;
    })
    .sort((a, b) => (b.lpsi ?? 0) - (a.lpsi ?? 0));
}

export async function muammolarChastotasi(qatorlar: MaterialQator[], m: Metodika): Promise<MuammoChastota[]> {
  const t = qatorlar.filter((q) => q.lpsi != null);
  const qismlar = await all<{ kategoriya: string; qism: Qism; soni: number }>(
    `SELECT b.kategoriya, b.qism, COUNT(*) AS soni
     FROM belgilar b JOIN tahlillar t ON t.material_id = b.material_id
     WHERE t.lpsi IS NOT NULL
     GROUP BY b.kategoriya, b.qism`,
  );
  return Object.values(m.kategoriyalar).map((kat) => {
    const birliklar = t.reduce((sum, q) => sum + (q.sanoq[kat.kod] ?? 0), 0);
    const materiallar = t.filter((q) => (q.sanoq[kat.kod] ?? 0) > 0).length;
    const oz = qismlar.filter((q) => q.kategoriya === kat.kod);
    return {
      kod: kat.kod,
      nomi: kat.nomi,
      guruh: kat.guruh,
      mezon: kat.mezon,
      birliklar,
      materiallar,
      ulush: t.length ? Math.round((materiallar / t.length) * 1000) / 10 : 0,
      qismlar: {
        sarlavha: oz.find((q) => q.qism === "sarlavha")?.soni ?? 0,
        lid: oz.find((q) => q.qism === "lid")?.soni ?? 0,
        matn: oz.find((q) => q.qism === "matn")?.soni ?? 0,
      },
    } satisfies MuammoChastota;
  });
}

export async function dashboard(): Promise<Dashboard> {
  const m = await metodikaniYuklash();
  const qatorlar = await materialQatorlari();
  const t = qatorlar.filter((q) => q.lpsi != null);
  const ortachaLpsi = ortacha(t.map((q) => q.lpsi));
  const mezonlar = await all<Mezon>("SELECT * FROM mezonlar ORDER BY kod");
  const nashrlarSoni = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM nashrlar"))?.n ?? 0;

  let quyi = 0;
  const taqsimot = m.shkala.map((s) => {
    const oraliq = { nomi: s.nomi, gacha: s.gacha, quyi, soni: t.filter((q) => q.daraja === s.nomi).length };
    quyi = s.gacha;
    return oraliq;
  });

  return {
    jami: qatorlar.length,
    tahlil_qilingan: t.length,
    toliq_emas: qatorlar.filter((q) => q.tahlil_bor && q.lpsi == null).length,
    tahlil_kutmoqda: qatorlar.filter((q) => !q.tahlil_bor).length,
    nashrlar_soni: nashrlarSoni,
    ortacha_lpsi: ortachaLpsi,
    ortacha_daraja: ortachaLpsi == null ? null : daraja(ortachaLpsi, m.shkala),
    taqsimot,
    nashrlar: kesim(qatorlar, m, (q) => q.nashr),
    media_turlari: kesim(qatorlar, m, (q) => q.media_turi),
    janrlar: kesim(qatorlar, m, (q) => q.janr ?? JANR_YOQ),
    muammolar: await muammolarChastotasi(qatorlar, m),
    oxirgi: [...t]
      .sort((a, b) => (b.tahlil_sanasi ?? "").localeCompare(a.tahlil_sanasi ?? ""))
      .slice(0, 6)
      .map((q) => ({
        id: q.id,
        nashr: q.nashr,
        sarlavha: q.sarlavha,
        lpsi: q.lpsi,
        daraja: q.daraja,
        tahlil_sanasi: q.tahlil_sanasi ?? "",
      })),
    metodika_versiya: m.versiya,
    shkala: m.shkala,
    mezonlar,
  };
}

export const K_USTUN_RO_YXATI = K_USTUNLAR;
