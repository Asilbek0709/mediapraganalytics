/**
 * v3: ekspertlar, ularning mustaqil tahlillari va mezon vaznlari bo‘yicha so‘rov.
 *
 * Ekspert tahlillari asosiy statistikaga (Bosh panel, Analitika, Excel kesimlari)
 * kirmaydi — ular faqat kodlash ishonchliligini (kelishuvni) baholash uchun.
 */
import { all, hozir, one, run, transaction } from "./db";
import { ApiError, materialOlish, metodikaSaqlash, tahlilniTekshirish, type TahlilSaqlash } from "./queries";
import { ekspertTahliliNatijasiniYangilash, hisoblash, MEZON_KODLARI, metodikaniYuklash } from "./scoring";
import { tarjimon } from "./i18n";
import type { Til } from "./i18n/til";
import { cv, kendallW, mediana, ortacha, sd, yarimgaYaxlitlash, type KendallNatija } from "./statistika";
import type { Belgi, Material, Mezon, Natija, Tahlil } from "./types";

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

export function ekspertlarRoyxati(): Ekspert[] {
  return all<Ekspert>(
    `SELECT e.id, e.ism, e.izoh, e.yaratilgan,
            (SELECT COUNT(*) FROM ekspert_tahlillari t WHERE t.ekspert_id = e.id) AS tahlillar_soni,
            EXISTS (SELECT 1 FROM ekspert_vaznlari v WHERE v.ekspert_id = e.id) AS vazn_bor
     FROM ekspertlar e ORDER BY e.id`,
  );
}

function ekspertOlish(id: number): { id: number; ism: string } {
  const e = one<{ id: number; ism: string }>("SELECT id, ism FROM ekspertlar WHERE id = ?", [id]);
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

export function ekspertQoshish(data: unknown) {
  const { ism, izoh } = ekspertTekshir(data);
  if (one("SELECT 1 FROM ekspertlar WHERE ism = ?", [ism])) throw new ApiError(409, "x.ekspertMavjud");
  const r = run("INSERT INTO ekspertlar (ism, izoh, yaratilgan) VALUES (?, ?, ?)", [ism, izoh, hozir()]);
  return { id: Number(r.lastInsertRowid) };
}

export function ekspertTahrirlash(id: number, data: unknown) {
  ekspertOlish(id);
  const { ism, izoh } = ekspertTekshir(data);
  if (one("SELECT 1 FROM ekspertlar WHERE ism = ? AND id <> ?", [ism, id])) {
    throw new ApiError(409, "x.ekspertMavjud");
  }
  run("UPDATE ekspertlar SET ism = ?, izoh = ? WHERE id = ?", [ism, izoh, id]);
  return { id };
}

export function ekspertOchirish(id: number) {
  ekspertOlish(id);
  run("DELETE FROM ekspertlar WHERE id = ?", [id]);
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

export function ekspertTahlilOlish(materialId: number, ekspertId: number): EkspertTahlilJavobi {
  const material = materialOlish(materialId);
  const ekspert = ekspertOlish(ekspertId);
  const row = one<Tahlil & { id: number; sarlavha_turlari: string }>(
    "SELECT * FROM ekspert_tahlillari WHERE material_id = ? AND ekspert_id = ?",
    [materialId, ekspertId],
  );
  if (!row) return { material, ekspert, tahlil: null, belgilar: [], natija: null };
  const belgilar = all<Belgi>(
    "SELECT id, kategoriya, qism, fragment, izoh FROM ekspert_belgilari WHERE ekspert_tahlil_id = ? ORDER BY id",
    [row.id],
  );
  const tahlil: Tahlil = { ...row, sarlavha_turlari: JSON.parse(row.sarlavha_turlari || "[]") };
  return { material, ekspert, tahlil, belgilar, natija: hisoblash(tahlil, belgilar, metodikaniYuklash()) };
}

export function ekspertTahlilSaqlash(materialId: number, ekspertId: number, data: TahlilSaqlash): Natija {
  materialOlish(materialId);
  ekspertOlish(ekspertId);
  const { tahlil, belgilar } = tahlilniTekshirish(data);
  return transaction(() => {
    run(
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
    const { id } = one<{ id: number }>("SELECT id FROM ekspert_tahlillari WHERE material_id = ? AND ekspert_id = ?", [
      materialId,
      ekspertId,
    ])!;
    run("DELETE FROM ekspert_belgilari WHERE ekspert_tahlil_id = ?", [id]);
    for (const b of belgilar) {
      run("INSERT INTO ekspert_belgilari (ekspert_tahlil_id, kategoriya, qism, fragment, izoh) VALUES (?, ?, ?, ?, ?)", [
        id,
        b.kategoriya,
        b.qism,
        b.fragment,
        b.izoh,
      ]);
    }
    return ekspertTahliliNatijasiniYangilash(id, metodikaniYuklash())!;
  });
}

export function ekspertTahlilOchirish(materialId: number, ekspertId: number) {
  materialOlish(materialId);
  ekspertOlish(ekspertId);
  run("DELETE FROM ekspert_tahlillari WHERE material_id = ? AND ekspert_id = ?", [materialId, ekspertId]);
  return { ok: true };
}

/** Tahlil sahifasidagi baholovchi tanlagichi uchun: har bir ekspert shu materialni tahlil qilganmi. */
export function materialBaholovchilari(materialId: number) {
  return {
    asosiy_bor: !!one("SELECT 1 FROM tahlillar WHERE material_id = ?", [materialId]),
    ekspertlar: all<{ id: number; ism: string; bor: number }>(
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

export function vaznTahlili(): VaznTahlili {
  const mezonlar = all<Mezon>("SELECT * FROM mezonlar ORDER BY kod");
  const vaznlar: EkspertVazni[] = all<{
    ekspert_id: number; ism: string; k1: number; k2: number; k3: number; k4: number; k5: number;
    izoh: string | null; yangilangan: string;
  }>(
    `SELECT v.*, e.ism FROM ekspert_vaznlari v JOIN ekspertlar e ON e.id = v.ekspert_id ORDER BY e.id`,
  ).map((r) => ({
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
    metodika_versiya: metodikaniYuklash().versiya,
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

export function ekspertVazniSaqlash(ekspertId: number, data: unknown) {
  ekspertOlish(ekspertId);
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
  run(
    `INSERT INTO ekspert_vaznlari (ekspert_id, k1, k2, k3, k4, k5, izoh, yangilangan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (ekspert_id) DO UPDATE SET k1 = excluded.k1, k2 = excluded.k2, k3 = excluded.k3,
       k4 = excluded.k4, k5 = excluded.k5, izoh = excluded.izoh, yangilangan = excluded.yangilangan`,
    [ekspertId, ...sonlar, matn(d.izoh), hozir()],
  );
  return { ok: true };
}

export function ekspertVazniOchirish(ekspertId: number) {
  ekspertOlish(ekspertId);
  run("DELETE FROM ekspert_vaznlari WHERE ekspert_id = ?", [ekspertId]);
  return { ok: true };
}

/** Ekspertlar o‘rtacha vaznlarini metodikaga yangi versiya sifatida qo‘llaydi. */
export function vaznlarniQollash(til: Til = "uz") {
  const t = vaznTahlili();
  if (t.vaznlar.length < 2 || t.mezonlar.some((m) => m.taklif == null)) {
    throw new ApiError(422, "x.qollashUchun2");
  }
  const m = metodikaniYuklash();
  const tr = tarjimon(til);
  const w = t.kendall ? tr.son(t.kendall.W, 3) : "—";
  const p = t.kendall ? (t.kendall.p < 0.001 ? `< ${tr.son(0.001, 3)}` : tr.son(t.kendall.p, 3)) : "—";
  return metodikaSaqlash({
    vaznlar: Object.fromEntries(t.mezonlar.map((mz) => [mz.kod, mz.taklif!])),
    muvofiqlik: m.muvofiqlik,
    kompozitsiya: m.kompozitsiya,
    kategoriyalar: Object.fromEntries(
      Object.values(m.kategoriyalar).map((k) => [k.kod, { mezon: k.mezon, jarima: k.jarima }]),
    ),
    shkala: m.shkala,
    izoh: tr.t("eks.qollashIzoh", { n: t.vaznlar.length, w, p }),
  });
}
