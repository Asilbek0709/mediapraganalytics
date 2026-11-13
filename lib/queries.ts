/** Baza bilan ishlovchi amallar: mediabaza, tahlil va metodika. */
import { all, hozir, one, run, transaction } from "./db";
import { hammasiniQaytaHisoblash, hisoblash, metodikaniYuklash, tahlilNatijasiniYangilash, MEZON_KODLARI } from "./scoring";
import type { Kalit, Param, Xabar } from "./i18n";
import type {
  Belgi,
  Holat,
  Kategoriya,
  Material,
  MediaTuri,
  Metodika,
  MetodikaTarix,
  MetodikaTolik,
  Mezon,
  Natija,
  Qism,
  ShkalaOraliq,
  Tahlil,
  TahlilKirish,
} from "./types";

/** Foydalanuvchiga ko‘rsatiladigan xato: matn o‘rniga tarjima kaliti (javobda foydalanuvchi tiliga o‘giriladi). */
export class ApiError extends Error {
  status: number;
  xabarlar: Xabar[];
  constructor(status: number, xabar: Kalit | Xabar[], p?: Param) {
    const xabarlar = Array.isArray(xabar) ? xabar : [{ k: xabar, p }];
    super(xabarlar.map((x) => x.k).join("; "));
    this.status = status;
    this.xabarlar = xabarlar;
  }
}

/** Takrorlanuvchi xabarlarni olib tashlaydi. */
const yagona = (xabarlar: Xabar[]) => [...new Map(xabarlar.map((x) => [JSON.stringify(x), x])).values()];

const matn = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
  return s ? s : null;
};

// ------------------------------------------------------------------ nashrlar

export function nashrlarRoyxati() {
  return all<{ id: number; nomi: string; turi: MediaTuri; materiallar_soni: number }>(
    `SELECT n.id, n.nomi, n.turi, COUNT(m.id) AS materiallar_soni
     FROM nashrlar n LEFT JOIN materiallar m ON m.nashr_id = n.id
     GROUP BY n.id ORDER BY n.turi, n.nomi`,
  );
}

function nashrTekshir(nomi: unknown, turi: unknown): { nomi: string; turi: MediaTuri } {
  const n = matn(nomi);
  if (!n) throw new ApiError(422, "x.nashrNomi");
  if (turi !== "bosma" && turi !== "raqamli") throw new ApiError(422, "x.mediaTuri");
  return { nomi: n, turi };
}

export function nashrQoshish(data: unknown) {
  const { nomi, turi } = nashrTekshir((data as Record<string, unknown>)?.nomi, (data as Record<string, unknown>)?.turi);
  if (one("SELECT 1 FROM nashrlar WHERE nomi = ?", [nomi])) {
    throw new ApiError(409, "x.nashrMavjud");
  }
  const r = run("INSERT INTO nashrlar (nomi, turi) VALUES (?, ?)", [nomi, turi]);
  return { id: Number(r.lastInsertRowid) };
}

export function nashrTahrirlash(id: number, data: unknown) {
  const { nomi, turi } = nashrTekshir((data as Record<string, unknown>)?.nomi, (data as Record<string, unknown>)?.turi);
  if (one("SELECT 1 FROM nashrlar WHERE nomi = ? AND id <> ?", [nomi, id])) {
    throw new ApiError(409, "x.nashrMavjud");
  }
  const r = run("UPDATE nashrlar SET nomi = ?, turi = ? WHERE id = ?", [nomi, turi, id]);
  if (!r.changes) throw new ApiError(404, "x.nashrTopilmadi");
  return { id };
}

export function nashrOchirish(id: number) {
  if (one("SELECT 1 FROM materiallar WHERE nashr_id = ? LIMIT 1", [id])) {
    throw new ApiError(409, "x.nashrdaMateriallar");
  }
  const r = run("DELETE FROM nashrlar WHERE id = ?", [id]);
  if (!r.changes) throw new ApiError(404, "x.nashrTopilmadi");
  return { ok: true };
}

// --------------------------------------------------------------- materiallar

const MATERIAL_SELECT = `
  SELECT m.*, n.nomi AS nashr, n.turi,
         t.lpsi, t.daraja, t.material_id IS NOT NULL AS tahlil_bor
  FROM materiallar m
  JOIN nashrlar n ON n.id = m.nashr_id
  LEFT JOIN tahlillar t ON t.material_id = m.id`;

export interface MaterialFiltr {
  q?: string;
  nashr_id?: number;
  turi?: MediaTuri;
  janr?: string;
  dan?: string;
  gacha?: string;
  holat?: Holat;
}

export function materiallarRoyxati(f: MaterialFiltr = {}): Material[] {
  const shartlar: string[] = [];
  const params: unknown[] = [];
  if (f.q) {
    shartlar.push("(m.sarlavha LIKE ? OR m.lid LIKE ? OR m.matn LIKE ? OR m.mavzu LIKE ?)");
    params.push(...Array(4).fill(`%${f.q}%`));
  }
  if (f.nashr_id) {
    shartlar.push("m.nashr_id = ?");
    params.push(f.nashr_id);
  }
  if (f.turi) {
    shartlar.push("n.turi = ?");
    params.push(f.turi);
  }
  if (f.janr) {
    shartlar.push("m.janr = ?");
    params.push(f.janr);
  }
  if (f.dan) {
    shartlar.push("m.sana >= ?");
    params.push(f.dan);
  }
  if (f.gacha) {
    shartlar.push("m.sana <= ?");
    params.push(f.gacha);
  }
  if (f.holat === "tahlil_qilingan") shartlar.push("t.lpsi IS NOT NULL");
  else if (f.holat === "toliq_emas") shartlar.push("t.material_id IS NOT NULL AND t.lpsi IS NULL");
  else if (f.holat === "tahlil_qilinmagan") shartlar.push("t.material_id IS NULL");

  const sql = `${MATERIAL_SELECT}${shartlar.length ? ` WHERE ${shartlar.join(" AND ")}` : ""} ORDER BY m.id DESC`;
  return all<Material>(sql, params);
}

export function materialOlish(id: number): Material {
  const row = one<Material>(`${MATERIAL_SELECT} WHERE m.id = ?`, [id]);
  if (!row) throw new ApiError(404, "x.materialTopilmadi");
  return row;
}

interface MaterialKirish {
  nashr_id: number;
  sana: string | null;
  janr: string | null;
  mavzu: string | null;
  havola: string | null;
  sarlavha: string;
  lid: string | null;
  matn: string | null;
}

function materialTekshir(data: unknown): MaterialKirish {
  const d = (data ?? {}) as Record<string, unknown>;
  const nashrId = Number(d.nashr_id);
  if (!nashrId || !one("SELECT 1 FROM nashrlar WHERE id = ?", [nashrId])) {
    throw new ApiError(422, "x.nashrniTanlang");
  }
  const sarlavha = matn(d.sarlavha);
  if (!sarlavha) throw new ApiError(422, "x.sarlavhaniKiriting");
  const havola = matn(d.havola);
  if (havola && !/^https?:\/\//i.test(havola)) {
    throw new ApiError(422, "x.havolaHttp");
  }
  const sana = matn(d.sana);
  if (sana && !/^\d{4}-\d{2}-\d{2}$/.test(sana)) throw new ApiError(422, "x.sanaFormat");
  return {
    nashr_id: nashrId,
    sana,
    janr: matn(d.janr),
    mavzu: matn(d.mavzu),
    havola,
    sarlavha,
    lid: matn(d.lid),
    matn: matn(d.matn),
  };
}

export function materialQoshish(data: unknown) {
  const m = materialTekshir(data);
  const vaqt = hozir();
  const r = run(
    `INSERT INTO materiallar (nashr_id, sana, janr, mavzu, havola, sarlavha, lid, matn, yaratilgan, yangilangan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [m.nashr_id, m.sana, m.janr, m.mavzu, m.havola, m.sarlavha, m.lid, m.matn, vaqt, vaqt],
  );
  return { id: Number(r.lastInsertRowid) };
}

export function materialTahrirlash(id: number, data: unknown) {
  materialOlish(id);
  const m = materialTekshir(data);
  run(
    `UPDATE materiallar SET nashr_id = ?, sana = ?, janr = ?, mavzu = ?, havola = ?, sarlavha = ?,
            lid = ?, matn = ?, yangilangan = ? WHERE id = ?`,
    [m.nashr_id, m.sana, m.janr, m.mavzu, m.havola, m.sarlavha, m.lid, m.matn, hozir(), id],
  );
  return { id };
}

export function materialOchirish(id: number) {
  const r = run("DELETE FROM materiallar WHERE id = ?", [id]);
  if (!r.changes) throw new ApiError(404, "x.materialTopilmadi");
  return { ok: true };
}

// -------------------------------------------------------------------- tahlil

function kodlar(turkum: string): Set<string> {
  return new Set(all<{ kod: string }>("SELECT kod FROM lugat WHERE turkum = ?", [turkum]).map((r) => r.kod));
}

export interface TahlilSaqlash extends TahlilKirish {
  belgilar?: Belgi[];
}

export function tahlilniTekshirish(data: TahlilSaqlash): {
  tahlil: Required<Omit<TahlilKirish, "sarlavha_turlari">> & { sarlavha_turlari: string[] };
  belgilar: Belgi[];
} {
  const xatolar: Xabar[] = [];
  const turlari = Array.isArray(data.sarlavha_turlari) ? data.sarlavha_turlari : [];
  const sarlavhaKodlari = kodlar("sarlavha_turi");
  const notogri = turlari.filter((t) => !sarlavhaKodlari.has(t));
  if (notogri.length) xatolar.push({ k: "x.nomalumSarlavhaTuri", p: { v: notogri.join(", ") } });

  const muvofiqlik = kodlar("muvofiqlik");
  for (const maydon of ["sar_lid", "lid_matn", "sar_matn"] as const) {
    const v = data[maydon];
    if (v != null && v !== "" && !muvofiqlik.has(v)) xatolar.push({ k: "x.nomalumMuvofiqlik", p: { v } });
  }
  if (data.kompozitsiya && !kodlar("kompozitsiya").has(data.kompozitsiya)) {
    xatolar.push({ k: "x.nomalumKompozitsiya", p: { v: data.kompozitsiya } });
  }
  const auditoriya = data.auditoriya == null || data.auditoriya === ("" as unknown) ? null : Number(data.auditoriya);
  if (auditoriya != null && (!Number.isInteger(auditoriya) || auditoriya < 1 || auditoriya > 5)) {
    xatolar.push({ k: "x.auditoriya15" });
  }

  const katKodlari = new Set(all<{ kod: string }>("SELECT kod FROM kategoriyalar").map((r) => r.kod));
  const qismlar: Qism[] = ["sarlavha", "lid", "matn"];
  const belgilar: Belgi[] = (data.belgilar ?? []).map((b) => {
    if (!katKodlari.has(b.kategoriya)) xatolar.push({ k: "x.nomalumKategoriya", p: { v: b.kategoriya } });
    if (!qismlar.includes(b.qism)) xatolar.push({ k: "x.nomalumQism", p: { v: b.qism } });
    return { kategoriya: b.kategoriya, qism: b.qism, fragment: matn(b.fragment), izoh: matn(b.izoh) };
  });

  if (xatolar.length) throw new ApiError(422, yagona(xatolar));

  return {
    tahlil: {
      sarlavha_turlari: turlari,
      kompozitsiya: matn(data.kompozitsiya),
      sar_lid: matn(data.sar_lid),
      lid_matn: matn(data.lid_matn),
      sar_matn: matn(data.sar_matn),
      auditoriya,
      izoh: matn(data.izoh),
    },
    belgilar,
  };
}

export function tahlilOlish(materialId: number) {
  const material = materialOlish(materialId);
  const row = one<Tahlil & { sarlavha_turlari: string }>("SELECT * FROM tahlillar WHERE material_id = ?", [materialId]);
  const belgilar = all<Belgi>(
    "SELECT id, kategoriya, qism, fragment, izoh FROM belgilar WHERE material_id = ? ORDER BY id",
    [materialId],
  );
  let tahlil: Tahlil | null = null;
  let natija: Natija | null = null;
  if (row) {
    tahlil = { ...row, sarlavha_turlari: JSON.parse(row.sarlavha_turlari || "[]") };
    natija = hisoblash(tahlil, belgilar, metodikaniYuklash());
  }
  return { material, tahlil, belgilar, natija };
}

export function tahlilSaqlash(materialId: number, data: TahlilSaqlash): Natija {
  materialOlish(materialId);
  const { tahlil, belgilar } = tahlilniTekshirish(data);
  return transaction(() => {
    run(
      `INSERT INTO tahlillar (material_id, sarlavha_turlari, kompozitsiya, sar_lid, lid_matn, sar_matn,
                              auditoriya, izoh, yangilangan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (material_id) DO UPDATE SET
         sarlavha_turlari = excluded.sarlavha_turlari, kompozitsiya = excluded.kompozitsiya,
         sar_lid = excluded.sar_lid, lid_matn = excluded.lid_matn, sar_matn = excluded.sar_matn,
         auditoriya = excluded.auditoriya, izoh = excluded.izoh, yangilangan = excluded.yangilangan`,
      [
        materialId,
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
    run("DELETE FROM belgilar WHERE material_id = ?", [materialId]);
    for (const b of belgilar) {
      run("INSERT INTO belgilar (material_id, kategoriya, qism, fragment, izoh) VALUES (?, ?, ?, ?, ?)", [
        materialId,
        b.kategoriya,
        b.qism,
        b.fragment,
        b.izoh,
      ]);
    }
    eskiTanlovlarniTozalash(materialId);
    return tahlilNatijasiniYangilash(materialId, metodikaniYuklash())!;
  });
}

/** Belgilar qayta yozilgach, endi mavjud bo‘lmagan fragmentlarning ★ tanlovlari o‘chiriladi. */
function eskiTanlovlarniTozalash(materialId: number) {
  run(
    `DELETE FROM tanlangan_misollar
     WHERE material_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM belgilar b
         WHERE b.material_id = tanlangan_misollar.material_id AND b.kategoriya = tanlangan_misollar.kategoriya
           AND b.qism = tanlangan_misollar.qism AND b.fragment = tanlangan_misollar.fragment)`,
    [materialId],
  );
}

export function tahlilOchirish(materialId: number) {
  materialOlish(materialId);
  transaction(() => {
    run("DELETE FROM belgilar WHERE material_id = ?", [materialId]);
    run("DELETE FROM tahlillar WHERE material_id = ?", [materialId]);
    run("DELETE FROM tanlangan_misollar WHERE material_id = ?", [materialId]);
  });
  return { ok: true };
}

export function oldindanHisoblash(data: TahlilSaqlash): Natija {
  const { tahlil, belgilar } = tahlilniTekshirish(data);
  return hisoblash(tahlil, belgilar, metodikaniYuklash());
}

// ------------------------------------------------------------------ metodika

export function janrlar(): string[] {
  const lugatJanr = all<{ nomi: string }>("SELECT nomi FROM lugat WHERE turkum = 'janr' ORDER BY tartib");
  const mavjud = all<{ janr: string }>("SELECT DISTINCT janr FROM materiallar WHERE janr IS NOT NULL AND janr <> ''");
  return [...new Set([...lugatJanr.map((j) => j.nomi), ...mavjud.map((m) => m.janr)])].sort();
}

export function metodikaTolik(): MetodikaTolik {
  const m = metodikaniYuklash();
  const lugat: Record<string, { kod: string; nomi: string; qiymat: number | null }[]> = {};
  for (const r of all<{ turkum: string; kod: string; nomi: string; qiymat: number | null }>(
    "SELECT turkum, kod, nomi, qiymat FROM lugat ORDER BY turkum, tartib",
  )) {
    (lugat[r.turkum] ??= []).push({ kod: r.kod, nomi: r.nomi, qiymat: r.qiymat });
  }
  return {
    versiya: m.versiya,
    mezonlar: all<Mezon>("SELECT * FROM mezonlar ORDER BY kod"),
    kategoriyalar: all<Kategoriya>("SELECT * FROM kategoriyalar ORDER BY tartib"),
    lugat,
    shkala: m.shkala,
    janrlar: janrlar(),
    tahlillar_soni: all<{ n: number }>("SELECT COUNT(*) AS n FROM tahlillar")[0]?.n ?? 0,
  };
}

export function metodikaTarixi(): MetodikaTarix[] {
  return all<{ versiya: number; sana: string; izoh: string | null; snapshot: string }>(
    "SELECT * FROM metodika_tarixi ORDER BY versiya DESC",
  ).map((r) => ({ ...r, snapshot: JSON.parse(r.snapshot) as Partial<Metodika> }));
}

export interface MetodikaKirish {
  vaznlar: Record<string, number>;
  muvofiqlik: Record<string, number>;
  kompozitsiya: Record<string, number>;
  kategoriyalar: Record<string, { mezon: string | null; jarima: number }>;
  shkala: ShkalaOraliq[];
  izoh?: string | null;
}

export function metodikaSaqlash(data: MetodikaKirish) {
  const joriy = metodikaniYuklash();
  const xatolar: Xabar[] = [];
  const sonlar = (o: Record<string, number>) => Object.values(o).map(Number);

  const vaznKodlari = Object.keys(data.vaznlar ?? {});
  if (MEZON_KODLARI.some((k) => !vaznKodlari.includes(k))) {
    xatolar.push({ k: "x.vaznlarK1K5" });
  } else if (sonlar(data.vaznlar).some((v) => !Number.isFinite(v) || v < 0)) {
    xatolar.push({ k: "x.vaznManfiy" });
  } else if (Math.abs(sonlar(data.vaznlar).reduce((a, b) => a + b, 0) - 100) > 0.01) {
    const jami = sonlar(data.vaznlar).reduce((a, b) => a + b, 0);
    xatolar.push({ k: "x.vaznYigindi", p: { v: Math.round(jami * 100) / 100 } });
  }

  const kalitlarMos = (a: object, b: object) =>
    Object.keys(a).length === Object.keys(b).length && Object.keys(b).every((k) => k in a);

  if (!kalitlarMos(data.muvofiqlik ?? {}, joriy.muvofiqlik) || sonlar(data.muvofiqlik).some((v) => v < 0 || v > 1)) {
    xatolar.push({ k: "x.muvofiqlikOraliq" });
  }
  if (
    !kalitlarMos(data.kompozitsiya ?? {}, joriy.kompozitsiya) ||
    sonlar(data.kompozitsiya).some((v) => v < 0 || v > 100)
  ) {
    xatolar.push({ k: "x.kompozitsiyaOraliq" });
  }
  if (!kalitlarMos(data.kategoriyalar ?? {}, joriy.kategoriyalar)) {
    xatolar.push({ k: "x.kategoriyalarMos" });
  } else if (
    Object.values(data.kategoriyalar).some(
      (k) => k.jarima < 0 || k.jarima > 100 || (k.mezon != null && k.mezon !== "" && !MEZON_KODLARI.includes(k.mezon as never)),
    )
  ) {
    xatolar.push({ k: "x.jarimaOraliq" });
  }

  const shkala = (data.shkala ?? []).map((o) => ({ gacha: Number(o.gacha), nomi: matn(o.nomi) ?? "" }));
  if (!shkala.length || shkala.some((o) => !o.nomi || !Number.isFinite(o.gacha))) {
    xatolar.push({ k: "x.shkalaToliq" });
  } else if (
    shkala.some((o, i) => i > 0 && o.gacha <= shkala[i - 1].gacha) ||
    shkala[shkala.length - 1].gacha !== 100
  ) {
    xatolar.push({ k: "x.shkalaOsish" });
  }

  if (xatolar.length) throw new ApiError(422, yagona(xatolar));

  return transaction(() => {
    for (const [kod, vazn] of Object.entries(data.vaznlar)) {
      run("UPDATE mezonlar SET vazn = ? WHERE kod = ?", [Number(vazn), kod]);
    }
    for (const [kod, qiymat] of Object.entries(data.muvofiqlik)) {
      run("UPDATE lugat SET qiymat = ? WHERE turkum = 'muvofiqlik' AND kod = ?", [Number(qiymat), kod]);
    }
    for (const [kod, qiymat] of Object.entries(data.kompozitsiya)) {
      run("UPDATE lugat SET qiymat = ? WHERE turkum = 'kompozitsiya' AND kod = ?", [Number(qiymat), kod]);
    }
    for (const [kod, sozlama] of Object.entries(data.kategoriyalar)) {
      run("UPDATE kategoriyalar SET mezon = ?, jarima = ? WHERE kod = ?", [
        sozlama.mezon || null,
        Number(sozlama.jarima),
        kod,
      ]);
    }
    const yangi = joriy.versiya + 1;
    run("UPDATE sozlamalar SET qiymat = ? WHERE kalit = 'metodika_versiya'", [String(yangi)]);
    run("UPDATE sozlamalar SET qiymat = ? WHERE kalit = 'shkala'", [JSON.stringify(shkala)]);
    const m = metodikaniYuklash();
    run("INSERT INTO metodika_tarixi (versiya, sana, izoh, snapshot) VALUES (?, ?, ?, ?)", [
      yangi,
      hozir(),
      matn(data.izoh),
      JSON.stringify(m),
    ]);
    return { versiya: yangi, qayta_hisoblangan: hammasiniQaytaHisoblash(m) };
  });
}
