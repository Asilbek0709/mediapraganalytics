/**
 * Materiallarni Excel (.xlsx) yoki CSV fayldan ommaviy import qilish.
 *
 * Ikki bosqich: 1) ko‘rib chiqish — fayl o‘qiladi, har bir qator tekshiriladi,
 * hech narsa yozilmaydi; 2) import — mijoz qatorlarni qaytaradi, server ularni
 * qayta tekshiradi va bitta tranzaksiyada yozadi.
 */
import ExcelJS from "exceljs";

import { all, hozir, one, run, transaction } from "./db.ts";
import {
  MAYDONLAR,
  csvTahlil,
  matnniDekodlash,
  nashrKaliti,
  sananiNormallash,
  sarlavhaKaliti,
  turniTanish,
  turTaxmini,
  ustunlarniAniqlash,
  type Maydon,
} from "./importParse.ts";
import { tarjimon, type Xabar } from "./i18n/index.ts";
import type { Til } from "./i18n/til.ts";
import { ApiError } from "./queries.ts";
import type { MediaTuri } from "./types.ts";

export const MAKS_QATOR = 5000;
export const MAKS_HAJM = 15 * 1024 * 1024;

export interface ImportQatori {
  qator: number;
  nashr: string;
  nashr_id: number | null;
  turi: MediaTuri | null;
  sana: string | null;
  janr: string | null;
  mavzu: string | null;
  havola: string | null;
  sarlavha: string;
  lid: string | null;
  matn: string | null;
  xatolar: Xabar[];
  ogohlantirishlar: Xabar[];
  takroriy: "baza" | "fayl" | null;
  /**
   * Fayldagi asl qiymatlar (satr ko‘rinishida). Import paytida aynan shular qaytariladi
   * va server ularni qayta tekshiradi — aks holda, masalan, noto‘g‘ri sana bo‘sh
   * qiymatga aylanib, xatosiz o‘tib ketgan bo‘lardi.
   */
  xom: Partial<Record<Maydon, string | null>>;
}

export interface KoribChiqish {
  fayl: string;
  varaq: string | null;
  kodirovka: string | null;
  ustunlar: { maydon: Maydon; ustun: string }[];
  tanilmagan: string[];
  qatorlar: ImportQatori[];
  yangiNashrlar: { nomi: string; turi: MediaTuri; qatorlar: number }[];
}

type XomQator = { qator: number; qiymatlar: Partial<Record<Maydon, unknown>> };

// ------------------------------------------------------------------ fayl o‘qish

function katakQiymati(v: ExcelJS.CellValue, havola: boolean): unknown {
  if (v == null) return null;
  if (v instanceof Date || typeof v !== "object") return v;
  const o = v as unknown as Record<string, unknown>;
  const matn = (x: unknown): string =>
    x && typeof x === "object" && "richText" in (x as object)
      ? ((x as { richText: { text: string }[] }).richText ?? []).map((t) => t.text).join("")
      : String(x ?? "");
  if ("richText" in o) return matn(o);
  if ("hyperlink" in o) return havola ? String(o.hyperlink ?? "") : matn(o.text ?? o.hyperlink);
  if ("formula" in o || "sharedFormula" in o) return (o.result as unknown) ?? null;
  if ("error" in o) return null;
  return null;
}

async function xlsxOqish(buf: Buffer): Promise<{ varaq: string; sarlavhalar: string[]; qatorlar: XomQator[]; xarita: Partial<Record<Maydon, number>>; tanilmagan: string[] }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new ApiError(422, "x.excelOqilmadi");
  }
  const varaqlar = wb.worksheets.filter((w) => w.actualRowCount > 0);
  const ws = varaqlar.find((w) => w.name.trim().toLowerCase() === "materiallar") ?? varaqlar[0];
  if (!ws) throw new ApiError(422, "x.faylBoshMalumot");

  // Sarlavha qatori — birinchi 10 qator ichida eng ko‘p ustun tanilgani (tepada nom bo‘lishi mumkin)
  let eng = { r: 0, xarita: {} as Partial<Record<Maydon, number>>, tanilmagan: [] as string[], sarlavhalar: [] as string[] };
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const qiymatlar = ws.getRow(r).values as ExcelJS.CellValue[];
    const sarlavhalar = Array.from({ length: Math.max(0, qiymatlar.length - 1) }, (_, i) =>
      String(katakQiymati(qiymatlar[i + 1], false) ?? ""),
    );
    const t = ustunlarniAniqlash(sarlavhalar);
    if (Object.keys(t.xarita).length > Object.keys(eng.xarita).length) eng = { r, ...t, sarlavhalar };
  }
  if (!eng.r) throw new ApiError(422, "x.sarlavhaQatoriXlsx");

  const qatorlar: XomQator[] = [];
  for (let r = eng.r + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const qiymatlar: Partial<Record<Maydon, unknown>> = {};
    for (const [maydon, ustun] of Object.entries(eng.xarita) as [Maydon, number][]) {
      qiymatlar[maydon] = katakQiymati(row.getCell(ustun + 1).value, maydon === "havola");
    }
    qatorlar.push({ qator: r, qiymatlar });
  }
  return { varaq: ws.name, sarlavhalar: eng.sarlavhalar, qatorlar, xarita: eng.xarita, tanilmagan: eng.tanilmagan };
}

function csvOqish(buf: Buffer) {
  const { matn, kodirovka } = matnniDekodlash(new Uint8Array(buf));
  const jadval = csvTahlil(matn);
  if (!jadval.length) throw new ApiError(422, "x.faylBoshMalumot");
  const { xarita, tanilmagan } = ustunlarniAniqlash(jadval[0]);
  if (!Object.keys(xarita).length) {
    throw new ApiError(422, "x.sarlavhaQatoriCsv");
  }
  const qatorlar: XomQator[] = jadval.slice(1).map((q, i) => ({
    qator: i + 2,
    qiymatlar: Object.fromEntries((Object.entries(xarita) as [Maydon, number][]).map(([m, u]) => [m, q[u] ?? null])),
  }));
  return { kodirovka, sarlavhalar: jadval[0], qatorlar, xarita, tanilmagan };
}

// ------------------------------------------------------------------ tekshirish

async function nashrXaritasi() {
  return new Map(
    (await all<{ id: number; nomi: string; turi: MediaTuri }>("SELECT id, nomi, turi FROM nashrlar")).map((n) => [nashrKaliti(n.nomi), n]),
  );
}

async function bazadagiKalitlar(): Promise<Set<string>> {
  return new Set(
    (await all<{ nashr: string; sarlavha: string }>(
      "SELECT n.nomi AS nashr, m.sarlavha FROM materiallar m JOIN nashrlar n ON n.id = m.nashr_id",
    )).map((r) => `${nashrKaliti(r.nashr)}|${sarlavhaKaliti(r.sarlavha)}`),
  );
}

const satr = (v: unknown): string | null => {
  if (v == null) return null;
  const s = (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)).replace(/\r\n/g, "\n").trim();
  return s || null;
};

async function qatorlarniTekshirish(xom: XomQator[]): Promise<{ qatorlar: ImportQatori[]; yangiNashrlar: KoribChiqish["yangiNashrlar"] }> {
  const nashrlar = await nashrXaritasi();
  const bazada = await bazadagiKalitlar();
  const faylda = new Set<string>();
  const yangi = new Map<string, { nomi: string; turi: MediaTuri; qatorlar: number }>();
  const qatorlar: ImportQatori[] = [];

  for (const { qator, qiymatlar: q } of xom) {
    if (MAYDONLAR.every((m) => satr(q[m]) == null)) continue; // bo‘sh qator
    const xatolar: Xabar[] = [];
    const ogoh: Xabar[] = [];

    const nashr = satr(q.nashr) ?? "";
    const sarlavha = satr(q.sarlavha) ?? "";
    if (!nashr) xatolar.push({ k: "imp.x.nashrYoq" });
    if (!sarlavha) xatolar.push({ k: "imp.x.sarlavhaBosh" });
    if (sarlavha.length > 1000) xatolar.push({ k: "imp.x.sarlavhaUzun" });

    const turiMatn = satr(q.turi);
    const turi = turiMatn ? turniTanish(turiMatn) : null;
    if (turiMatn && !turi) ogoh.push({ k: "imp.o.turTanilmadi", p: { v: turiMatn } });

    const mavjud = nashr ? nashrlar.get(nashrKaliti(nashr)) : undefined;
    if (nashr && !mavjud) {
      const k = nashrKaliti(nashr);
      const y = yangi.get(k) ?? { nomi: nashr, turi: turi ?? turTaxmini(nashr), qatorlar: 0 };
      y.qatorlar++;
      yangi.set(k, y);
      ogoh.push({ k: "imp.o.yangiNashr", p: { v: nashr } });
    } else if (mavjud && turi && turi !== mavjud.turi) {
      ogoh.push({ k: mavjud.turi === "bosma" ? "imp.o.turFarqBosma" : "imp.o.turFarqRaqamli", p: { v: mavjud.nomi } });
    }

    const s = sananiNormallash(q.sana);
    if (s.xato) xatolar.push({ k: "imp.x.sana", p: { v: satr(q.sana) } });

    let havola = satr(q.havola);
    if (havola && !/^https?:\/\//i.test(havola)) {
      if (/^www\.|^[\w-]+(\.[\w-]+)+\//i.test(havola)) {
        havola = `https://${havola}`;
        ogoh.push({ k: "imp.o.https" });
      } else {
        xatolar.push({ k: "imp.x.havola" });
      }
    }

    const janr = satr(q.janr);
    const mavzu = satr(q.mavzu);
    if (janr && janr.length > 100) xatolar.push({ k: "imp.x.janrUzun" });
    if (mavzu && mavzu.length > 200) xatolar.push({ k: "imp.x.mavzuUzun" });

    let takroriy: ImportQatori["takroriy"] = null;
    if (nashr && sarlavha) {
      const kalit = `${nashrKaliti(mavjud?.nomi ?? nashr)}|${sarlavhaKaliti(sarlavha)}`;
      if (bazada.has(kalit)) takroriy = "baza";
      else if (faylda.has(kalit)) takroriy = "fayl";
      faylda.add(kalit);
    }

    qatorlar.push({
      qator,
      nashr: mavjud?.nomi ?? nashr,
      nashr_id: mavjud?.id ?? null,
      turi,
      sana: s.sana,
      janr,
      mavzu,
      havola,
      sarlavha,
      lid: satr(q.lid),
      matn: satr(q.matn),
      xatolar,
      ogohlantirishlar: ogoh,
      takroriy,
      xom: Object.fromEntries(MAYDONLAR.map((m) => [m, satr(q[m])])),
    });
  }
  if (qatorlar.length > MAKS_QATOR) {
    throw new ApiError(422, "x.judaKopQator", { n: qatorlar.length, maks: MAKS_QATOR });
  }
  return { qatorlar, yangiNashrlar: [...yangi.values()] };
}

// ------------------------------------------------------------------ 1-bosqich: ko‘rib chiqish

export async function koribChiqish(buf: Buffer, faylNomi: string): Promise<KoribChiqish> {
  const kengaytma = faylNomi.toLowerCase().split(".").pop();
  if (kengaytma === "xls") throw new ApiError(422, "x.xlsEski");
  const oqilgan =
    kengaytma === "xlsx"
      ? { ...(await xlsxOqish(buf)), kodirovka: null }
      : kengaytma === "csv" || kengaytma === "txt"
        ? { ...csvOqish(buf), varaq: null }
        : (() => {
            throw new ApiError(422, "x.faqatXlsxCsv");
          })();

  if (oqilgan.xarita.sarlavha === undefined) {
    throw new ApiError(422, "x.sarlavhaUstuniYoq");
  }
  if (oqilgan.xarita.nashr === undefined) {
    throw new ApiError(422, "x.nashrUstuniYoq");
  }

  const { qatorlar, yangiNashrlar } = await qatorlarniTekshirish(oqilgan.qatorlar);
  return {
    fayl: faylNomi,
    varaq: oqilgan.varaq,
    kodirovka: oqilgan.kodirovka,
    ustunlar: (Object.entries(oqilgan.xarita) as [Maydon, number][])
      .sort((a, b) => a[1] - b[1])
      .map(([maydon, i]) => ({ maydon, ustun: String(oqilgan.sarlavhalar[i] ?? "").trim() })),
    tanilmagan: oqilgan.tanilmagan,
    qatorlar,
    yangiNashrlar,
  };
}

// ------------------------------------------------------------------ 2-bosqich: import

export interface ImportSorovi {
  qatorlar: Partial<Record<Maydon, unknown>> & { qator?: number }[];
  yangiNashrlar?: { nomi: string; turi: MediaTuri }[];
  takroriylarniOtkazish?: boolean;
}

export interface ImportNatijasi {
  qoshildi: number;
  xato_tufayli: number;
  takroriy_tufayli: number;
  yangi_nashrlar: string[];
  birinchi_id: number | null;
  oxirgi_id: number | null;
}

export async function importQilish(sorov: ImportSorovi): Promise<ImportNatijasi> {
  const kirish = Array.isArray(sorov?.qatorlar) ? sorov.qatorlar : [];
  if (!kirish.length) throw new ApiError(422, "x.importQatorYoq");
  if (kirish.length > MAKS_QATOR) throw new ApiError(422, "x.birMartada", { maks: MAKS_QATOR });

  // Mijozdan kelgan ma’lumot qayta tekshiriladi — ko‘rib chiqish natijasiga ishonilmaydi
  const { qatorlar } = await qatorlarniTekshirish(
    kirish.map((q, i) => ({
      qator: Number((q as { qator?: number }).qator) || i + 2,
      qiymatlar: Object.fromEntries(MAYDONLAR.map((m) => [m, (q as Record<string, unknown>)[m] ?? null])),
    })),
  );
  const otkazish = sorov.takroriylarniOtkazish !== false;
  const turlar = new Map(
    (sorov.yangiNashrlar ?? [])
      .filter((n) => n && (n.turi === "bosma" || n.turi === "raqamli"))
      .map((n) => [nashrKaliti(String(n.nomi)), n.turi]),
  );

  const yoziladi = qatorlar.filter((q) => !q.xatolar.length && !(otkazish && q.takroriy));
  const natija: ImportNatijasi = {
    qoshildi: 0,
    xato_tufayli: qatorlar.filter((q) => q.xatolar.length).length,
    takroriy_tufayli: otkazish ? qatorlar.filter((q) => !q.xatolar.length && q.takroriy).length : 0,
    yangi_nashrlar: [],
    birinchi_id: null,
    oxirgi_id: null,
  };

  await transaction(async () => {
    const yaratilgan = new Map<string, number>();
    const vaqt = hozir();
    for (const q of yoziladi) {
      let nashrId = q.nashr_id;
      if (nashrId == null) {
        const k = nashrKaliti(q.nashr);
        if (!yaratilgan.has(k)) {
          const turi = turlar.get(k) ?? q.turi ?? turTaxmini(q.nashr);
          const r = await one<{ id: number }>("INSERT INTO nashrlar (nomi, turi) VALUES (?, ?) RETURNING id", [q.nashr.trim(), turi]);
          yaratilgan.set(k, r!.id);
          natija.yangi_nashrlar.push(q.nashr.trim());
        }
        nashrId = yaratilgan.get(k)!;
      }
      const r = await one<{ id: number }>(
        `INSERT INTO materiallar (nashr_id, sana, janr, mavzu, havola, sarlavha, lid, matn, yaratilgan, yangilangan)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [nashrId, q.sana, q.janr, q.mavzu, q.havola, q.sarlavha, q.lid, q.matn, vaqt, vaqt],
      );
      const id = r!.id;
      natija.birinchi_id ??= id;
      natija.oxirgi_id = id;
      natija.qoshildi++;
    }
  });
  return natija;
}

// ------------------------------------------------------------------ shablon

export async function shablon(til: Til): Promise<{ buf: Buffer; fayl: string }> {
  const { t, mediaQ } = tarjimon(til);
  const nashrlar = await all<{ nomi: string; turi: string }>("SELECT nomi, turi FROM nashrlar ORDER BY turi, nomi");
  const janrlar = (await all<{ nomi: string }>("SELECT nomi FROM lugat WHERE turkum = 'janr' ORDER BY tartib")).map((j) => j.nomi);
  const wb = new ExcelJS.Workbook();
  wb.creator = "MediaPrag-Analytics";

  const ustunlar: [string, number][] = [
    [t("u.nashr"), 22], [t("u.mediaTuri"), 13], [t("u.sana"), 13], [t("u.janr"), 14], [t("u.mavzu"), 18],
    [t("u.havola"), 32], [t("u.sarlavha"), 50], [t("u.lid"), 50], [t("u.matn"), 70],
  ];
  const ws = wb.addWorksheet(t("imp.sh.materiallar"), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(ustunlar.map(([n]) => n));
  ustunlar.forEach(([, w], i) => {
    ws.getColumn(i + 1).width = w;
  });
  const bosh = ws.getRow(1);
  bosh.font = { bold: true, color: { argb: "FFFFFFFF" } };
  bosh.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B2545" } };
  bosh.height = 24;
  ws.getColumn(3).numFmt = "dd.mm.yyyy";
  for (const c of [7, 8, 9]) ws.getColumn(c).alignment = { wrapText: true, vertical: "top" };

  const oxirgi = 1 + MAKS_QATOR;
  // exceljs tiplarida yo‘q, lekin kutubxonada bor: butun ustun uchun bitta qoida yoziladi
  const tekshiruv = (ws as unknown as {
    dataValidations: { add(manzil: string, qoida: ExcelJS.DataValidation): void };
  }).dataValidations;
  const nashrVaraq = t("imp.sh.nashrlar");
  // Ro‘yxatdan tanlash qulayligi uchun; ro‘yxatda yo‘q yangi nashr yozilsa ham qabul qilinadi
  tekshiruv.add(`A2:A${oxirgi}`, {
    type: "list",
    allowBlank: true,
    formulae: [`'${nashrVaraq}'!$A$2:$A$${Math.max(2, nashrlar.length + 1)}`],
    showErrorMessage: false,
  });
  tekshiruv.add(`B2:B${oxirgi}`, { type: "list", allowBlank: true, formulae: [`"${t("imp.sh.turlar")}"`] });
  if (janrlar.length) {
    tekshiruv.add(`D2:D${oxirgi}`, {
      type: "list",
      allowBlank: true,
      formulae: [`"${janrlar.join(",")}"`],
      showErrorMessage: false,
    });
  }

  const k = wb.addWorksheet(t("imp.sh.korsatma"));
  k.addRow([t("imp.sh.ustun"), t("imp.sh.majburiy"), t("imp.sh.tavsif"), t("imp.sh.namuna")]).font = { bold: true };
  const ha = t("imp.sh.ha");
  const yoq = t("imp.sh.yoq");
  const korsatma: [string, string, string, string][] = [
    [t("u.nashr"), ha, t("imp.sh.d.nashr"), "Kun.uz"],
    [t("u.mediaTuri"), yoq, t("imp.sh.d.turi"), mediaQ("raqamli")],
    [t("u.sana"), yoq, t("imp.sh.d.sana"), "15.03.2025"],
    [t("u.janr"), yoq, t("imp.sh.d.janr"), "xabar"],
    [t("u.mavzu"), yoq, t("imp.sh.d.mavzu"), t("imp.sh.n.mavzu")],
    [t("u.havola"), yoq, t("imp.sh.d.havola"), "https://kun.uz/…"],
    [t("u.sarlavha"), ha, t("imp.sh.d.sarlavha"), t("imp.sh.n.sarlavha")],
    [t("u.lid"), yoq, t("imp.sh.d.lid"), "…"],
    [t("u.matn"), yoq, t("imp.sh.d.matn"), "…"],
  ];
  korsatma.forEach((q) => k.addRow(q));
  k.addRow([]);
  k.addRow([t("imp.sh.eslatma1")]);
  k.addRow([t("imp.sh.eslatma2")]);
  k.addRow([t("imp.sh.eslatma3", { maks: MAKS_QATOR })]);
  [[16], [12], [80], [32]].forEach(([w], i) => {
    k.getColumn(i + 1).width = w;
  });
  k.getColumn(3).alignment = { wrapText: true, vertical: "top" };

  const n = wb.addWorksheet(nashrVaraq);
  n.addRow([t("u.nashr"), t("u.mediaTuri")]).font = { bold: true };
  nashrlar.forEach((x) => n.addRow([x.nomi, mediaQ(x.turi)]));
  n.getColumn(1).width = 28;
  n.getColumn(2).width = 14;

  return { buf: Buffer.from(await wb.xlsx.writeBuffer()), fayl: `${t("imp.sh.fayl")}.xlsx` };
}
