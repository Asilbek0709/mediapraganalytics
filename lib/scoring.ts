/**
 * LPSI — Lisoniy-pragmatik sifat indeksi.
 *
 *   K1 = (sarlavha↔lid + lid↔matn + sarlavha↔matn) / 3 × 100
 *   K2 = 100 − semantik noaniqlik jarimalari
 *   K3 = 100 − lisoniy-uslubiy xatolik jarimalari
 *   K4 = kompozitsiya turi balli
 *   K5 = (auditoriya bahosi − 1) / 4 × 100 − kontekstual nomuvofiqlik jarimalari
 *   LPSI = Σ (vazn × K) / Σ vazn
 *
 * Barcha vaznlar, ballar va jarimalar bazadagi «Metodika» bo‘limidan olinadi.
 */
import { all, one, run } from "./db.ts";
import type { IzohJarima, Kategoriya, Metodika, Natija, ShkalaOraliq, TahlilKirish, Yetishmaydi } from "./types.ts";

export const MEZON_KODLARI = ["K1", "K2", "K3", "K4", "K5"] as const;
export type MezonKod = (typeof MEZON_KODLARI)[number];

export const MUNOSABATLAR = [["sar_lid"], ["lid_matn"], ["sar_matn"]] as const;

export async function metodikaniYuklash(): Promise<Metodika> {
  const sozlamalar = Object.fromEntries(
    (await all<{ kalit: string; qiymat: string }>("SELECT kalit, qiymat FROM sozlamalar")).map((r) => [r.kalit, r.qiymat]),
  );
  const lugatQatorlari = await all<{ turkum: string; kod: string; qiymat: number }>(
    "SELECT turkum, kod, qiymat FROM lugat WHERE turkum IN ('muvofiqlik', 'kompozitsiya') ORDER BY turkum, tartib",
  );
  const lugat = (turkum: string) =>
    Object.fromEntries(lugatQatorlari.filter((r) => r.turkum === turkum).map((r) => [r.kod, r.qiymat]));

  const kategoriyalar: Record<string, Kategoriya> = Object.fromEntries(
    (await all<Kategoriya>("SELECT * FROM kategoriyalar ORDER BY tartib")).map((k) => [k.kod, k]),
  );

  return {
    versiya: Number(sozlamalar.metodika_versiya || 1),
    vaznlar: Object.fromEntries(
      (await all<{ kod: string; vazn: number }>("SELECT kod, vazn FROM mezonlar ORDER BY kod")).map((r) => [r.kod, r.vazn]),
    ),
    muvofiqlik: lugat("muvofiqlik"),
    kompozitsiya: lugat("kompozitsiya"),
    kategoriyalar,
    shkala: (JSON.parse(sozlamalar.shkala || "[]") as ShkalaOraliq[]).sort((a, b) => a.gacha - b.gacha),
  };
}

/** 83.333 -> «83,3»; 100 -> «100» */
export function son(x: number): string {
  return String(Math.round(x * 10) / 10).replace(".", ",");
}

export function daraja(lpsi: number, shkala: ShkalaOraliq[]): string {
  return (shkala.find((o) => lpsi <= o.gacha) ?? shkala[shkala.length - 1]).nomi;
}

export function hisoblash(
  tahlil: TahlilKirish,
  belgilar: { kategoriya: string }[],
  m: Metodika,
): Natija {
  const asos: Partial<Record<MezonKod, number>> = {};
  const yetishmaydi: Yetishmaydi[] = [];

  const qiymatlar: number[] = [];
  for (const [maydon] of MUNOSABATLAR) {
    const kod = tahlil[maydon];
    if (kod && kod in m.muvofiqlik) qiymatlar.push(m.muvofiqlik[kod]);
    else yetishmaydi.push(maydon);
  }
  if (qiymatlar.length === MUNOSABATLAR.length) {
    asos.K1 = (qiymatlar.reduce((a, b) => a + b, 0) / qiymatlar.length) * 100;
  }
  asos.K2 = 100;
  asos.K3 = 100;

  const komp = tahlil.kompozitsiya;
  if (komp && komp in m.kompozitsiya) asos.K4 = m.kompozitsiya[komp];
  else yetishmaydi.push("kompozitsiya");

  const auditoriya = tahlil.auditoriya;
  if (auditoriya != null && auditoriya >= 1 && auditoriya <= 5) asos.K5 = ((auditoriya - 1) / 4) * 100;
  else yetishmaydi.push("auditoriya");

  const sanoq: Record<string, number> = {};
  for (const b of belgilar) sanoq[b.kategoriya] = (sanoq[b.kategoriya] ?? 0) + 1;

  const jarimalar: Record<MezonKod, number> = { K1: 0, K2: 0, K3: 0, K4: 0, K5: 0 };
  const izohJarimalar: Record<MezonKod, IzohJarima[]> = { K1: [], K2: [], K3: [], K4: [], K5: [] };
  for (const kat of Object.values(m.kategoriyalar)) {
    const soni = sanoq[kat.kod] ?? 0;
    if (!soni || !kat.mezon || !kat.jarima) continue;
    const mezon = kat.mezon as MezonKod;
    jarimalar[mezon] += soni * kat.jarima;
    izohJarimalar[mezon].push({ kategoriya: kat.kod, soni, jarima: kat.jarima });
  }

  const natija: Natija = {
    toliq: yetishmaydi.length === 0,
    yetishmaydi,
    izohlar: {},
    metodika_versiya: m.versiya,
    k1: null, k2: null, k3: null, k4: null, k5: null,
    lpsi: null,
    daraja: null,
  };

  const ballar: Partial<Record<MezonKod, number>> = {};
  for (const kod of MEZON_KODLARI) {
    const base = asos[kod];
    if (base == null) {
      natija.izohlar[kod] = null;
      continue;
    }
    const xom = base - jarimalar[kod];
    const ball = Math.max(0, Math.min(100, xom));
    ballar[kod] = ball;
    natija[kod.toLowerCase() as "k1"] = Math.round(ball * 10) / 10;
    const umumiy = { jarimalar: izohJarimalar[kod], ball, xom };
    natija.izohlar[kod] =
      kod === "K1"
        ? { tur: "k1", qiymatlar, ...umumiy }
        : kod === "K4"
          ? { tur: "k4", asos: base, ...umumiy }
          : kod === "K5"
            ? { tur: "k5", auditoriya: auditoriya!, ...umumiy }
            : { tur: "yuz", ...umumiy };
  }

  const vaznJami = Object.values(m.vaznlar).reduce((a, b) => a + b, 0);
  if (Object.keys(ballar).length === MEZON_KODLARI.length && vaznJami > 0) {
    const lpsi =
      Math.round(
        (MEZON_KODLARI.reduce((sum, k) => sum + (m.vaznlar[k] ?? 0) * (ballar[k] ?? 0), 0) / vaznJami) * 10,
      ) / 10;
    natija.lpsi = lpsi;
    natija.daraja = daraja(lpsi, m.shkala);
  }
  return natija;
}

export async function tahlilNatijasiniYangilash(materialId: number, m: Metodika): Promise<Natija | null> {
  const row = await one<TahlilKirish & { sarlavha_turlari: string }>(
    "SELECT * FROM tahlillar WHERE material_id = ?",
    [materialId],
  );
  if (!row) return null;
  const belgilar = await all<{ kategoriya: string }>("SELECT kategoriya FROM belgilar WHERE material_id = ?", [materialId]);
  const n = hisoblash(row, belgilar, m);
  await run(
    `UPDATE tahlillar SET k1 = ?, k2 = ?, k3 = ?, k4 = ?, k5 = ?, lpsi = ?, daraja = ?, metodika_versiya = ?
     WHERE material_id = ?`,
    [n.k1, n.k2, n.k3, n.k4, n.k5, n.lpsi, n.daraja, m.versiya, materialId],
  );
  return n;
}

/** Ekspert tahlilining ballarini joriy metodika bo‘yicha qayta hisoblab, bazaga yozadi. */
export async function ekspertTahliliNatijasiniYangilash(ekspertTahlilId: number, m: Metodika): Promise<Natija | null> {
  const row = await one<TahlilKirish & { sarlavha_turlari: string }>("SELECT * FROM ekspert_tahlillari WHERE id = ?", [
    ekspertTahlilId,
  ]);
  if (!row) return null;
  const belgilar = await all<{ kategoriya: string }>("SELECT kategoriya FROM ekspert_belgilari WHERE ekspert_tahlil_id = ?", [
    ekspertTahlilId,
  ]);
  const n = hisoblash(row, belgilar, m);
  await run(
    `UPDATE ekspert_tahlillari SET k1 = ?, k2 = ?, k3 = ?, k4 = ?, k5 = ?, lpsi = ?, daraja = ?, metodika_versiya = ?
     WHERE id = ?`,
    [n.k1, n.k2, n.k3, n.k4, n.k5, n.lpsi, n.daraja, m.versiya, ekspertTahlilId],
  );
  return n;
}

/** Asosiy va ekspert tahlillarining barchasini qayta hisoblaydi; jami sonini qaytaradi. */
export async function hammasiniQaytaHisoblash(m: Metodika): Promise<number> {
  const ids = await all<{ material_id: number }>("SELECT material_id FROM tahlillar");
  for (const { material_id } of ids) await tahlilNatijasiniYangilash(material_id, m);
  const ekspertlar = await all<{ id: number }>("SELECT id FROM ekspert_tahlillari");
  for (const { id } of ekspertlar) await ekspertTahliliNatijasiniYangilash(id, m);
  return ids.length + ekspertlar.length;
}
