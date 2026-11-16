/** Baza bilan ishlovchi amallar: mediabaza, tahlil va metodika. */
import { gunzipSync } from "node:zlib";

import { all, hozir, matnHeshi, one, run, transaction } from "./db.ts";
import { idRaqami } from "./format.ts";
import { havolaKaliti, manbaTurimi, type ManbaTuri } from "./manba.ts";
import { hammasiniQaytaHisoblash, hisoblash, metodikaniYuklash, tahlilNatijasiniYangilash, MEZON_KODLARI } from "./scoring.ts";
import type { Kalit, Param, Xabar } from "./i18n/index.ts";
import type {
  Belgi,
  BelgiHolati,
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
} from "./types.ts";

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

export async function nashrlarRoyxati() {
  return await all<{ id: number; nomi: string; turi: MediaTuri; materiallar_soni: number }>(
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

export async function nashrQoshish(data: unknown) {
  const { nomi, turi } = nashrTekshir((data as Record<string, unknown>)?.nomi, (data as Record<string, unknown>)?.turi);
  if (await one("SELECT 1 FROM nashrlar WHERE nomi = ?", [nomi])) {
    throw new ApiError(409, "x.nashrMavjud");
  }
  const r = await one<{ id: number }>("INSERT INTO nashrlar (nomi, turi) VALUES (?, ?) RETURNING id", [nomi, turi]);
  return { id: r!.id };
}

export async function nashrTahrirlash(id: number, data: unknown) {
  const { nomi, turi } = nashrTekshir((data as Record<string, unknown>)?.nomi, (data as Record<string, unknown>)?.turi);
  if (await one("SELECT 1 FROM nashrlar WHERE nomi = ? AND id <> ?", [nomi, id])) {
    throw new ApiError(409, "x.nashrMavjud");
  }
  const r = await run("UPDATE nashrlar SET nomi = ?, turi = ? WHERE id = ?", [nomi, turi, id]);
  if (!r.changes) throw new ApiError(404, "x.nashrTopilmadi");
  return { id };
}

export async function nashrOchirish(id: number) {
  if (await one("SELECT 1 FROM materiallar WHERE nashr_id = ? LIMIT 1", [id])) {
    throw new ApiError(409, "x.nashrdaMateriallar");
  }
  const r = await run("DELETE FROM nashrlar WHERE id = ?", [id]);
  if (!r.changes) throw new ApiError(404, "x.nashrTopilmadi");
  return { ok: true };
}

// --------------------------------------------------------------- materiallar

const MATERIAL_SELECT = `
  SELECT m.*, n.nomi AS nashr, n.turi,
         t.lpsi, t.daraja, t.material_id IS NOT NULL AS tahlil_bor,
         EXISTS (SELECT 1 FROM manba_arxivi a WHERE a.material_id = m.id) AS arxiv_bor
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
  manba?: ManbaTuri;
  /** «yoq» — faqat tekshirilmaganlar */
  tekshirilgan?: "ha" | "yoq";
}

export async function materiallarRoyxati(f: MaterialFiltr = {}): Promise<Material[]> {
  const shartlar: string[] = [];
  const params: unknown[] = [];
  if (f.q) {
    shartlar.push("(m.sarlavha ILIKE ? OR m.lid ILIKE ? OR m.matn ILIKE ? OR m.mavzu ILIKE ?)");
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
  if (f.manba && manbaTurimi(f.manba)) {
    shartlar.push("m.manba_turi = ?");
    params.push(f.manba);
  }
  if (f.tekshirilgan === "yoq") shartlar.push("NOT m.tekshirilgan");
  else if (f.tekshirilgan === "ha") shartlar.push("m.tekshirilgan");

  const sql = `${MATERIAL_SELECT}${shartlar.length ? ` WHERE ${shartlar.join(" AND ")}` : ""} ORDER BY m.id DESC`;
  return await all<Material>(sql, params);
}

export async function materialOlish(id: number): Promise<Material> {
  const row = await one<Material>(`${MATERIAL_SELECT} WHERE m.id = ?`, [id]);
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
  manba_turi: ManbaTuri;
  olingan_sana: string | null;
  /** berilmagan bo‘lsa — null (tahrirlashda o‘zgarmaydi; yangi materialda — OCR dan boshqasi tekshirilgan) */
  tekshirilgan: boolean | null;
  /** asl HTML, gzip (faqat havoladan olinganda) */
  arxiv: Buffer | null;
}

const ARXIV_MAKS = 3 * 1024 * 1024;

/** Brauzerdan qaytgan asl HTML nusxasi: base64 → gzip; buzilgan yoki juda katta bo‘lsa — rad */
function arxivniOqish(v: unknown): Buffer | null {
  if (typeof v !== "string" || !v) return null;
  const buf = Buffer.from(v, "base64");
  if (!buf.length || buf.length > ARXIV_MAKS) throw new ApiError(413, "x.arxivKatta");
  try {
    gunzipSync(buf, { maxOutputLength: 8 * 1024 * 1024 });
  } catch {
    throw new ApiError(422, "x.arxivBuzilgan");
  }
  return buf;
}

/** Takroriy material: bir xil havola (kuzatish parametrlarisiz) yoki bir xil matn xeshi. */
export async function takrorniTopish(
  m: { havola?: string | null; sarlavha?: string | null; lid?: string | null; matn?: string | null },
  istisno?: number,
): Promise<{ id: number; sarlavha: string; sabab: "havola" | "matn" } | null> {
  const kalit = havolaKaliti(m.havola);
  if (kalit) {
    for (const q of await all<{ id: number; sarlavha: string; havola: string }>(
      "SELECT id, sarlavha, havola FROM materiallar WHERE havola IS NOT NULL AND havola <> ''",
    )) {
      if (q.id !== istisno && havolaKaliti(q.havola) === kalit) return { id: q.id, sarlavha: q.sarlavha, sabab: "havola" };
    }
  }
  const hesh = matnHeshi(m);
  if (hesh) {
    const q = await one<{ id: number; sarlavha: string }>(
      `SELECT id, sarlavha FROM materiallar WHERE matn_hash = ?${istisno ? " AND id <> ?" : ""} LIMIT 1`,
      istisno ? [hesh, istisno] : [hesh],
    );
    if (q) return { ...q, sabab: "matn" };
  }
  return null;
}

async function takrorBolmasin(m: MaterialKirish, istisno?: number) {
  const t = await takrorniTopish(m, istisno);
  if (t) throw new ApiError(409, t.sabab === "havola" ? "x.takrorHavola" : "x.takrorMatn", { id: idRaqami(t.id), v: t.sarlavha });
}

async function materialTekshir(data: unknown): Promise<MaterialKirish> {
  const d = (data ?? {}) as Record<string, unknown>;
  const nashrId = Number(d.nashr_id);
  if (!nashrId || !await one("SELECT 1 FROM nashrlar WHERE id = ?", [nashrId])) {
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
  const manbaTuri: ManbaTuri = manbaTurimi(d.manba_turi) ? d.manba_turi : "qolda";
  const olingan = matn(d.olingan_sana);
  if (olingan && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(olingan)) throw new ApiError(422, "x.sanaFormat");
  return {
    nashr_id: nashrId,
    sana,
    janr: matn(d.janr),
    mavzu: matn(d.mavzu),
    havola,
    sarlavha,
    lid: matn(d.lid),
    matn: matn(d.matn),
    manba_turi: manbaTuri,
    olingan_sana: olingan,
    tekshirilgan: typeof d.tekshirilgan === "boolean" ? d.tekshirilgan : null,
    arxiv: manbaTuri === "havola" ? arxivniOqish(d.arxiv) : null,
  };
}

export async function materialQoshish(data: unknown) {
  const m = await materialTekshir(data);
  await takrorBolmasin(m);
  const vaqt = hozir();
  // OCR natijasi tadqiqotchi tasdiqlamaguncha «tekshirilmagan» — tahlil va statistikaga o‘tmaydi
  const tekshirilgan = m.tekshirilgan ?? m.manba_turi !== "ocr";
  return await transaction(async () => {
    const r = await one<{ id: number }>(
      `INSERT INTO materiallar (nashr_id, sana, janr, mavzu, havola, sarlavha, lid, matn, yaratilgan, yangilangan,
                                manba_turi, olingan_sana, matn_hash, tekshirilgan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [m.nashr_id, m.sana, m.janr, m.mavzu, m.havola, m.sarlavha, m.lid, m.matn, vaqt, vaqt,
       m.manba_turi, m.olingan_sana ?? (m.manba_turi === "havola" ? vaqt : null), matnHeshi(m), tekshirilgan],
    );
    if (m.arxiv) {
      await run(
        `INSERT INTO manba_arxivi (material_id, url, olingan_sana, material_yaratilgan, html, hajm) VALUES (?, ?, ?, ?, ?, ?)`,
        [r!.id, m.havola, m.olingan_sana ?? vaqt, vaqt, m.arxiv, gunzipSync(m.arxiv).length],
      );
    }
    return { id: r!.id };
  });
}

export async function materialTahrirlash(id: number, data: unknown) {
  await materialOlish(id);
  const m = await materialTekshir(data);
  await takrorBolmasin(m, id);
  await run(
    `UPDATE materiallar SET nashr_id = ?, sana = ?, janr = ?, mavzu = ?, havola = ?, sarlavha = ?,
            lid = ?, matn = ?, matn_hash = ?, tekshirilgan = COALESCE(?, tekshirilgan), yangilangan = ? WHERE id = ?`,
    [m.nashr_id, m.sana, m.janr, m.mavzu, m.havola, m.sarlavha, m.lid, m.matn, matnHeshi(m), m.tekshirilgan, hozir(), id],
  );
  return { id };
}

/** «Matn asl nusxa bilan solishtirildi» — tekshirilgan belgisini qo‘yish yoki olib tashlash */
export async function materialTekshiruvi(id: number, data: unknown) {
  const d = (data ?? {}) as Record<string, unknown>;
  if (typeof d.tekshirilgan !== "boolean") throw new ApiError(422, "x.notogriSorov");
  const r = await run("UPDATE materiallar SET tekshirilgan = ?, yangilangan = ? WHERE id = ?", [d.tekshirilgan, hozir(), id]);
  if (!r.changes) throw new ApiError(404, "x.materialTopilmadi");
  return { id, tekshirilgan: d.tekshirilgan };
}

/** Asl HTML nusxasi (faqat havoladan olingan materiallar) */
export async function materialArxivi(id: number): Promise<{ html: Buffer; url: string | null; olingan_sana: string }> {
  const r = await one<{ html: Uint8Array; url: string | null; olingan_sana: string }>(
    "SELECT html, url, olingan_sana FROM manba_arxivi WHERE material_id = ?",
    [id],
  );
  if (!r) throw new ApiError(404, "x.arxivYoq");
  return { html: gunzipSync(Buffer.from(r.html)), url: r.url, olingan_sana: r.olingan_sana };
}

export async function materialOchirish(id: number) {
  return await transaction(async () => {
    const r = await run("DELETE FROM materiallar WHERE id = ?", [id]);
    if (!r.changes) throw new ApiError(404, "x.materialTopilmadi");
    await run("DELETE FROM manba_arxivi WHERE material_id = ?", [id]);
    return { ok: true };
  });
}

// -------------------------------------------------------------------- tahlil

async function kodlar(turkum: string): Promise<Set<string>> {
  return new Set((await all<{ kod: string }>("SELECT kod FROM lugat WHERE turkum = ?", [turkum])).map((r) => r.kod));
}

export interface TahlilSaqlash extends TahlilKirish {
  belgilar?: Belgi[];
}

export async function tahlilniTekshirish(data: TahlilSaqlash): Promise<{
  tahlil: Required<Omit<TahlilKirish, "sarlavha_turlari">> & { sarlavha_turlari: string[] };
  belgilar: Belgi[];
}> {
  const xatolar: Xabar[] = [];
  const turlari = Array.isArray(data.sarlavha_turlari) ? data.sarlavha_turlari : [];
  const sarlavhaKodlari = await kodlar("sarlavha_turi");
  const notogri = turlari.filter((t) => !sarlavhaKodlari.has(t));
  if (notogri.length) xatolar.push({ k: "x.nomalumSarlavhaTuri", p: { v: notogri.join(", ") } });

  const muvofiqlik = await kodlar("muvofiqlik");
  for (const maydon of ["sar_lid", "lid_matn", "sar_matn"] as const) {
    const v = data[maydon];
    if (v != null && v !== "" && !muvofiqlik.has(v)) xatolar.push({ k: "x.nomalumMuvofiqlik", p: { v } });
  }
  if (data.kompozitsiya && !(await kodlar("kompozitsiya")).has(data.kompozitsiya)) {
    xatolar.push({ k: "x.nomalumKompozitsiya", p: { v: data.kompozitsiya } });
  }
  const auditoriya = data.auditoriya == null || data.auditoriya === ("" as unknown) ? null : Number(data.auditoriya);
  if (auditoriya != null && (!Number.isInteger(auditoriya) || auditoriya < 1 || auditoriya > 5)) {
    xatolar.push({ k: "x.auditoriya15" });
  }

  const katKodlari = new Set((await all<{ kod: string }>("SELECT kod FROM kategoriyalar")).map((r) => r.kod));
  const qismlar: Qism[] = ["sarlavha", "lid", "matn"];
  const belgilar: Belgi[] = (data.belgilar ?? []).map((b) => {
    if (!katKodlari.has(b.kategoriya)) xatolar.push({ k: "x.nomalumKategoriya", p: { v: b.kategoriya } });
    if (!qismlar.includes(b.qism)) xatolar.push({ k: "x.nomalumQism", p: { v: b.qism } });
    const holat: BelgiHolati = b.holat === "ai_tasdiqlangan" || b.holat === "ai_ozgartirilgan" ? b.holat : "qolda";
    return {
      kategoriya: b.kategoriya,
      qism: b.qism,
      fragment: matn(b.fragment),
      izoh: matn(b.izoh),
      holat,
      tasdiqlagan: holat === "qolda" ? null : matn(b.tasdiqlagan),
      tasdiq_sanasi: holat === "qolda" ? null : matn(b.tasdiq_sanasi),
    };
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

export async function tahlilOlish(materialId: number) {
  const material = await materialOlish(materialId);
  const row = await one<Tahlil & { sarlavha_turlari: string }>("SELECT * FROM tahlillar WHERE material_id = ?", [materialId]);
  const belgilar = await all<Belgi>(
    "SELECT id, kategoriya, qism, fragment, izoh, holat, tasdiqlagan, tasdiq_sanasi FROM belgilar WHERE material_id = ? ORDER BY id",
    [materialId],
  );
  let tahlil: Tahlil | null = null;
  let natija: Natija | null = null;
  if (row) {
    tahlil = { ...row, sarlavha_turlari: JSON.parse(row.sarlavha_turlari || "[]") };
    natija = hisoblash(tahlil, belgilar, await metodikaniYuklash());
  }
  return { material, tahlil, belgilar, natija };
}

/** ТЗ v2, 3.2: tekshirilmagan (masalan, OCR) material tahlilga o‘tmaydi */
export function tahlilgaTayyormi(m: Pick<Material, "tekshirilgan">) {
  if (m.tekshirilgan === false) throw new ApiError(409, "x.tekshirilmagan");
}

/** foydalanuvchi — AI taklifidan olingan belgini kim tasdiqlagani (ТЗ v2, 6) */
export async function tahlilSaqlash(materialId: number, data: TahlilSaqlash, foydalanuvchi?: string | null): Promise<Natija> {
  tahlilgaTayyormi(await materialOlish(materialId));
  const { tahlil, belgilar } = await tahlilniTekshirish(data);
  return await transaction(async () => {
    await run(
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
    await run("DELETE FROM belgilar WHERE material_id = ?", [materialId]);
    for (const b of belgilar) {
      const ai = b.holat && b.holat !== "qolda";
      await run(
        "INSERT INTO belgilar (material_id, kategoriya, qism, fragment, izoh, holat, tasdiqlagan, tasdiq_sanasi) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          materialId, b.kategoriya, b.qism, b.fragment, b.izoh, b.holat ?? "qolda",
          ai ? (b.tasdiqlagan ?? foydalanuvchi ?? null) : null,
          ai ? (b.tasdiq_sanasi ?? hozir()) : null,
        ],
      );
    }
    await eskiTanlovlarniTozalash(materialId);
    return (await tahlilNatijasiniYangilash(materialId, await metodikaniYuklash()))!;
  });
}

/** Belgilar qayta yozilgach, endi mavjud bo‘lmagan fragmentlarning ★ tanlovlari o‘chiriladi. */
async function eskiTanlovlarniTozalash(materialId: number) {
  await run(
    `DELETE FROM tanlangan_misollar
     WHERE material_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM belgilar b
         WHERE b.material_id = tanlangan_misollar.material_id AND b.kategoriya = tanlangan_misollar.kategoriya
           AND b.qism = tanlangan_misollar.qism AND b.fragment = tanlangan_misollar.fragment)`,
    [materialId],
  );
}

export async function tahlilOchirish(materialId: number) {
  await materialOlish(materialId);
  await transaction(async () => {
    await run("DELETE FROM belgilar WHERE material_id = ?", [materialId]);
    await run("DELETE FROM tahlillar WHERE material_id = ?", [materialId]);
    await run("DELETE FROM tanlangan_misollar WHERE material_id = ?", [materialId]);
  });
  return { ok: true };
}

export async function oldindanHisoblash(data: TahlilSaqlash): Promise<Natija> {
  const { tahlil, belgilar } = await tahlilniTekshirish(data);
  return hisoblash(tahlil, belgilar, await metodikaniYuklash());
}

// ------------------------------------------------------------------ metodika

export async function janrlar(): Promise<string[]> {
  const lugatJanr = await all<{ nomi: string }>("SELECT nomi FROM lugat WHERE turkum = 'janr' ORDER BY tartib");
  const mavjud = await all<{ janr: string }>("SELECT DISTINCT janr FROM materiallar WHERE janr IS NOT NULL AND janr <> ''");
  return [...new Set([...lugatJanr.map((j) => j.nomi), ...mavjud.map((m) => m.janr)])].sort();
}

export async function metodikaTolik(): Promise<MetodikaTolik> {
  const m = await metodikaniYuklash();
  const lugat: Record<string, { kod: string; nomi: string; qiymat: number | null }[]> = {};
  for (const r of await all<{ turkum: string; kod: string; nomi: string; qiymat: number | null }>(
    "SELECT turkum, kod, nomi, qiymat FROM lugat ORDER BY turkum, tartib",
  )) {
    (lugat[r.turkum] ??= []).push({ kod: r.kod, nomi: r.nomi, qiymat: r.qiymat });
  }
  return {
    versiya: m.versiya,
    mezonlar: await all<Mezon>("SELECT * FROM mezonlar ORDER BY kod"),
    kategoriyalar: await all<Kategoriya>("SELECT * FROM kategoriyalar ORDER BY tartib"),
    lugat,
    shkala: m.shkala,
    janrlar: await janrlar(),
    tahlillar_soni: (await one<{ n: number }>("SELECT COUNT(*) AS n FROM tahlillar"))?.n ?? 0,
  };
}

export async function metodikaTarixi(): Promise<MetodikaTarix[]> {
  return (await all<{ versiya: number; sana: string; izoh: string | null; snapshot: string; muallif: string | null }>(
    "SELECT * FROM metodika_tarixi ORDER BY versiya DESC",
  )).map((r) => ({ ...r, snapshot: JSON.parse(r.snapshot) as Partial<Metodika> }));
}

export interface MetodikaKirish {
  vaznlar: Record<string, number>;
  muvofiqlik: Record<string, number>;
  kompozitsiya: Record<string, number>;
  kategoriyalar: Record<string, { mezon: string | null; jarima: number }>;
  shkala: ShkalaOraliq[];
  izoh?: string | null;
}

/** muallif — o‘zgartirgan foydalanuvchi ismi (ТЗ v2, 7: kim, qachon, eski va yangi qiymat) */
export async function metodikaSaqlash(data: MetodikaKirish, muallif?: string | null) {
  const joriy = await metodikaniYuklash();
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

  return await transaction(async () => {
    for (const [kod, vazn] of Object.entries(data.vaznlar)) {
      await run("UPDATE mezonlar SET vazn = ? WHERE kod = ?", [Number(vazn), kod]);
    }
    for (const [kod, qiymat] of Object.entries(data.muvofiqlik)) {
      await run("UPDATE lugat SET qiymat = ? WHERE turkum = 'muvofiqlik' AND kod = ?", [Number(qiymat), kod]);
    }
    for (const [kod, qiymat] of Object.entries(data.kompozitsiya)) {
      await run("UPDATE lugat SET qiymat = ? WHERE turkum = 'kompozitsiya' AND kod = ?", [Number(qiymat), kod]);
    }
    for (const [kod, sozlama] of Object.entries(data.kategoriyalar)) {
      await run("UPDATE kategoriyalar SET mezon = ?, jarima = ? WHERE kod = ?", [
        sozlama.mezon || null,
        Number(sozlama.jarima),
        kod,
      ]);
    }
    const yangi = joriy.versiya + 1;
    await run("UPDATE sozlamalar SET qiymat = ? WHERE kalit = 'metodika_versiya'", [String(yangi)]);
    await run("UPDATE sozlamalar SET qiymat = ? WHERE kalit = 'shkala'", [JSON.stringify(shkala)]);
    const m = await metodikaniYuklash();
    await run("INSERT INTO metodika_tarixi (versiya, sana, izoh, snapshot, muallif) VALUES (?, ?, ?, ?, ?)", [
      yangi,
      hozir(),
      matn(data.izoh),
      JSON.stringify(m),
      muallif ?? null,
    ]);
    return { versiya: yangi, qayta_hisoblangan: await hammasiniQaytaHisoblash(m) };
  });
}
