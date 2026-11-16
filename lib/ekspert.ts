/**
 * v3: ekspertlar, ularning mustaqil tahlillari va mezon vaznlari bo‘yicha so‘rov.
 *
 * Ekspert tahlillari asosiy statistikaga (Bosh panel, Analitika, Excel kesimlari)
 * kirmaydi — ular faqat kodlash ishonchliligini (kelishuvni) baholash uchun.
 */
import { all, hozir, one, run, transaction, hisobgaShart } from "./db.ts";
import { ApiError, materialOlish, metodikaSaqlash, tahlilniTekshirish, type TahlilSaqlash, tahlilgaTayyormi } from "./queries.ts";
import { ekspertTahliliNatijasiniYangilash, hisoblash, MEZON_KODLARI, metodikaniYuklash } from "./scoring.ts";
import { tarjimon } from "./i18n/index.ts";
import type { Til } from "./i18n/til.ts";
import { cv, kendallW, mediana, ortacha, sd, yarimgaYaxlitlash, type KendallNatija } from "./statistika.ts";
import type { Belgi, Material, Mezon, Natija, Tahlil } from "./types.ts";

export interface Ekspert {
  id: number;
  ism: string;
  izoh: string | null;
  yaratilgan: string;
  tahlillar_soni: number;
  vazn_bor: number;
}

const matn = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
};

// ------------------------------------------------------------------ ekspertlar

export async function ekspertlarRoyxati(): Promise<Ekspert[]> {
  return await all<Ekspert>(
    `SELECT e.id, e.ism, e.izoh, e.yaratilgan,
            (SELECT COUNT(*) FROM ekspert_tahlillari t WHERE t.ekspert_id = e.id) AS tahlillar_soni,
            EXISTS (SELECT 1 FROM ekspert_vaznlari v WHERE v.ekspert_id = e.id) AS vazn_bor
     FROM ekspertlar e ORDER BY e.id`,
  );
}

async function ekspertOlish(id: number): Promise<{ id: number; ism: string }> {
  const e = await one<{ id: number; ism: string }>("SELECT id, ism FROM ekspertlar WHERE id = ?", [id]);
  if (!e) throw new ApiError(404, "x.ekspertTopilmadi");
  return e;
}

function ekspertTekshir(data: unknown) {
  const d = (data ?? {}) as Record<string, unknown>;
  const ism = matn(d.ism);
  if (!ism) throw new ApiError(422, "x.ekspertIsmi");
  if (ism.length > 200) throw new ApiError(422, "x.ismUzun");
  return { ism, izoh: matn(d.izoh) };
}

export async function ekspertQoshish(data: unknown) {
  const { ism, izoh } = ekspertTekshir(data);
  if (await one("SELECT 1 FROM ekspertlar WHERE ism = ?", [ism])) throw new ApiError(409, "x.ekspertMavjud");
  const r = await one<{ id: number }>("INSERT INTO ekspertlar (ism, izoh, yaratilgan) VALUES (?, ?, ?) RETURNING id", [ism, izoh, hozir()]);
  return { id: r!.id };
}

export async function ekspertTahrirlash(id: number, data: unknown) {
  await ekspertOlish(id);
  const { ism, izoh } = ekspertTekshir(data);
  if (await one("SELECT 1 FROM ekspertlar WHERE ism = ? AND id <> ?", [ism, id])) {
    throw new ApiError(409, "x.ekspertMavjud");
  }
  await run("UPDATE ekspertlar SET ism = ?, izoh = ? WHERE id = ?", [ism, izoh, id]);
  return { id };
}

export async function ekspertOchirish(id: number) {
  await ekspertOlish(id);
  await run("DELETE FROM ekspertlar WHERE id = ?", [id]);
  return { ok: true };
}

// ------------------------------------------------------------------ ekspert tahlillari

export interface EkspertTahlilJavobi {
  material: Material;
  ekspert: { id: number; ism: string };
  tahlil: Tahlil | null;
  belgilar: Belgi[];
  natija: Natija | null;
}

export async function ekspertTahlilOlish(materialId: number, ekspertId: number): Promise<EkspertTahlilJavobi> {
  const material = await materialOlish(materialId);
  const ekspert = await ekspertOlish(ekspertId);
  const row = await one<Tahlil & { id: number; sarlavha_turlari: string }>(
    "SELECT * FROM ekspert_tahlillari WHERE material_id = ? AND ekspert_id = ?",
    [materialId, ekspertId],
  );
  if (!row) return { material, ekspert, tahlil: null, belgilar: [], natija: null };
  const belgilar = await all<Belgi>(
    "SELECT id, kategoriya, qism, fragment, izoh FROM ekspert_belgilari WHERE ekspert_tahlil_id = ? ORDER BY id",
    [row.id],
  );
  const tahlil: Tahlil = { ...row, sarlavha_turlari: JSON.parse(row.sarlavha_turlari || "[]") };
  return { material, ekspert, tahlil, belgilar, natija: hisoblash(tahlil, belgilar, await metodikaniYuklash()) };
}

export async function ekspertTahlilSaqlash(materialId: number, ekspertId: number, data: TahlilSaqlash): Promise<Natija> {
  tahlilgaTayyormi(await materialOlish(materialId));
  await ekspertOlish(ekspertId);
  const { tahlil, belgilar } = await tahlilniTekshirish(data);
  return await transaction(async () => {
    await run(
      `INSERT INTO ekspert_tahlillari (material_id, ekspert_id, sarlavha_turlari, kompozitsiya, sar_lid, lid_matn,
                                       sar_matn, auditoriya, izoh, yangilangan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (material_id, ekspert_id) DO UPDATE SET
         sarlavha_turlari = excluded.sarlavha_turlari, kompozitsiya = excluded.kompozitsiya,
         sar_lid = excluded.sar_lid, lid_matn = excluded.lid_matn, sar_matn = excluded.sar_matn,
         auditoriya = excluded.auditoriya, izoh = excluded.izoh, yangilangan = excluded.yangilangan`,
      [
        materialId,
        ekspertId,
        JSON.stringify(tahlil.sarlavha_turlari),
        tahlil.kompozitsiya,
        tahlil.sar_lid,
        tahlil.lid_matn,
        tahlil.sar_matn,
        tahlil.auditoriya,
        tahlil.izoh,
        hozir(),
      ],
    );
    const { id } = (await one<{ id: number }>("SELECT id FROM ekspert_tahlillari WHERE material_id = ? AND ekspert_id = ?", [
      materialId,
      ekspertId,
    ]))!;
    await run("DELETE FROM ekspert_belgilari WHERE ekspert_tahlil_id = ?", [id]);
    for (const b of belgilar) {
      await run("INSERT INTO ekspert_belgilari (ekspert_tahlil_id, kategoriya, qism, fragment, izoh) VALUES (?, ?, ?, ?, ?)", [
        id,
        b.kategoriya,
        b.qism,
        b.fragment,
        b.izoh,
      ]);
    }
    return (await ekspertTahliliNatijasiniYangilash(id, await metodikaniYuklash()))!;
  });
}

export async function ekspertTahlilOchirish(materialId: number, ekspertId: number) {
  await materialOlish(materialId);
  await ekspertOlish(ekspertId);
  await run("DELETE FROM ekspert_tahlillari WHERE material_id = ? AND ekspert_id = ?", [materialId, ekspertId]);
  return { ok: true };
}

/** Tahlil sahifasidagi baholovchi tanlagichi uchun: har bir ekspert shu materialni tahlil qilganmi. */
export async function materialBaholovchilari(materialId: number) {
  return {
    asosiy_bor: !!await one("SELECT 1 FROM tahlillar WHERE material_id = ?", [materialId]),
    ekspertlar: await all<{ id: number; ism: string; bor: number }>(
      `SELECT e.id, e.ism, EXISTS (SELECT 1 FROM ekspert_tahlillari t WHERE t.ekspert_id = e.id AND t.material_id = ?) AS bor
       FROM ekspertlar e ORDER BY e.id`,
      [materialId],
    ),
  };
}

// ------------------------------------------------------------------ vaznlar so‘rovi

export interface EkspertVazni {
  ekspert_id: number;
  ism: string;
  vaznlar: Record<string, number>;
  izoh: string | null;
  yangilangan: string;
}

export interface MezonXulosasi {
  kod: string;
  nomi: string;
  joriy: number;
  ortacha: number | null;
  mediana: number | null;
  sd: number | null;
  cv: number | null;
  min: number | null;
  max: number | null;
  ortacha_rang: number | null;
  taklif: number | null;
}

export interface VaznTahlili {
  vaznlar: EkspertVazni[];
  mezonlar: MezonXulosasi[];
  kendall: KendallNatija | null;
  metodika_versiya: number;
}

export async function vaznTahlili(): Promise<VaznTahlili> {
  const mezonlar = await all<Mezon>("SELECT * FROM mezonlar ORDER BY kod");
  const vaznlar: EkspertVazni[] = (await all<{
    ekspert_id: number; ism: string; k1: number; k2: number; k3: number; k4: number; k5: number;
    izoh: string | null; yangilangan: string;
  }>(
    `SELECT v.*, e.ism FROM ekspert_vaznlari v JOIN ekspertlar e ON e.id = v.ekspert_id ORDER BY e.id`,
  )).map((r) => ({
    ekspert_id: r.ekspert_id,
    ism: r.ism,
    vaznlar: { K1: r.k1, K2: r.k2, K3: r.k3, K4: r.k4, K5: r.k5 },
    izoh: r.izoh,
    yangilangan: r.yangilangan,
  }));

  const matritsa = vaznlar.map((v) => MEZON_KODLARI.map((k) => v.vaznlar[k]));
  const kendall = kendallW(matritsa);
  const ortachalar = MEZON_KODLARI.map((_, i) => ortacha(matritsa.map((q) => q[i])));
  const taklif = ortachalar.every((x) => x != null) ? yarimgaYaxlitlash(ortachalar as number[]) : null;

  return {
    vaznlar,
    kendall,
    metodika_versiya: (await metodikaniYuklash()).versiya,
    mezonlar: MEZON_KODLARI.map((kod, i) => {
      const ustun = matritsa.map((q) => q[i]);
      const mz = mezonlar.find((m) => m.kod === kod);
      return {
        kod,
        nomi: mz?.nomi ?? kod,
        joriy: mz?.vazn ?? 0,
        ortacha: ortachalar[i],
        mediana: mediana(ustun),
        sd: sd(ustun),
        cv: cv(ustun),
        min: ustun.length ? Math.min(...ustun) : null,
        max: ustun.length ? Math.max(...ustun) : null,
        ortacha_rang: kendall ? kendall.ortachaRang[i] : null,
        taklif: taklif ? taklif[i] : null,
      };
    }),
  };
}

export async function ekspertVazniSaqlash(ekspertId: number, data: unknown) {
  await ekspertOlish(ekspertId);
  const d = (data ?? {}) as Record<string, unknown>;
  const v = (d.vaznlar ?? {}) as Record<string, unknown>;
  const sonlar = MEZON_KODLARI.map((k) => Number(v[k]));
  if (sonlar.some((x) => !Number.isFinite(x) || x < 0 || x > 100)) {
    throw new ApiError(422, "x.vaznOraliq");
  }
  const jami = sonlar.reduce((a, b) => a + b, 0);
  if (Math.abs(jami - 100) > 0.01) {
    throw new ApiError(422, "x.vaznYigindi", { v: Math.round(jami * 100) / 100 });
  }
  await run(
    `INSERT INTO ekspert_vaznlari (ekspert_id, k1, k2, k3, k4, k5, izoh, yangilangan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (ekspert_id) DO UPDATE SET k1 = excluded.k1, k2 = excluded.k2, k3 = excluded.k3,
       k4 = excluded.k4, k5 = excluded.k5, izoh = excluded.izoh, yangilangan = excluded.yangilangan`,
    [ekspertId, ...sonlar, matn(d.izoh), hozir()],
  );
  return { ok: true };
}

export async function ekspertVazniOchirish(ekspertId: number) {
  await ekspertOlish(ekspertId);
  await run("DELETE FROM ekspert_vaznlari WHERE ekspert_id = ?", [ekspertId]);
  return { ok: true };
}

/** Ekspertlar o‘rtacha vaznlarini metodikaga yangi versiya sifatida qo‘llaydi. */
export async function vaznlarniQollash(til: Til = "uz", muallif?: string | null) {
  const t = await vaznTahlili();
  if (t.vaznlar.length < 2 || t.mezonlar.some((m) => m.taklif == null)) {
    throw new ApiError(422, "x.qollashUchun2");
  }
  const m = await metodikaniYuklash();
  const tr = tarjimon(til);
  const w = t.kendall ? tr.son(t.kendall.W, 3) : "—";
  const p = t.kendall ? (t.kendall.p < 0.001 ? `< ${tr.son(0.001, 3)}` : tr.son(t.kendall.p, 3)) : "—";
  return await metodikaSaqlash({
    vaznlar: Object.fromEntries(t.mezonlar.map((mz) => [mz.kod, mz.taklif!])),
    muvofiqlik: m.muvofiqlik,
    kompozitsiya: m.kompozitsiya,
    kategoriyalar: Object.fromEntries(
      Object.values(m.kategoriyalar).map((k) => [k.kod, { mezon: k.mezon, jarima: k.jarima }]),
    ),
    shkala: m.shkala,
    izoh: tr.t("eks.qollashIzoh", { n: t.vaznlar.length, w, p }),
  }, muallif);
}

// ------------------------------------------------------------------ ekspert ish joyi

export interface Vazifa {
  id: number;
  nashr: string;
  turi: string;
  sana: string | null;
  sarlavha: string;
  bor: boolean;
  lpsi: number | null;
  yangilangan: string | null;
}

/** Ekspertga: barcha materiallar va faqat UNING o‘z tahlili holati (boshqalarning natijalari qaytarilmaydi). */
export async function ekspertVazifalari(ekspertId: number): Promise<{
  ekspert: { id: number; ism: string };
  vazifalar: Vazifa[];
  vaznlar: Record<string, number> | null;
  mezonlar: { kod: string; nomi: string; tavsif: string | null }[];
}> {
  const ekspert = await ekspertOlish(ekspertId);
  const vazifalar = await all<Vazifa>(
    `SELECT m.id, n.nomi AS nashr, n.turi, m.sana, m.sarlavha,
            et.id IS NOT NULL AS bor, et.lpsi, et.yangilangan
     FROM materiallar m
     JOIN nashrlar n ON n.id = m.nashr_id
     LEFT JOIN ekspert_tahlillari et ON et.material_id = m.id AND et.ekspert_id = ?
     WHERE ${hisobgaShart("m")}
     ORDER BY m.id DESC`,
    [ekspertId],
  );
  const v = await one<{ k1: number; k2: number; k3: number; k4: number; k5: number }>(
    "SELECT k1, k2, k3, k4, k5 FROM ekspert_vaznlari WHERE ekspert_id = ?",
    [ekspertId],
  );
  return {
    ekspert,
    vazifalar,
    vaznlar: v ? { K1: v.k1, K2: v.k2, K3: v.k3, K4: v.k4, K5: v.k5 } : null,
    mezonlar: await all<{ kod: string; nomi: string; tavsif: string | null }>("SELECT kod, nomi, tavsif FROM mezonlar ORDER BY kod"),
  };
}
