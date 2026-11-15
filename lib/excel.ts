/** Excel hisobot: dissertatsiyaning II–III boblari uchun tayyor jadvallar (foydalanuvchi tilida). */
import ExcelJS from "exceljs";

import type { Ahamiyat, KopGuruhBolimi, Korsatkich } from "./ahamiyat.ts";
import { analitika, type Granulyatsiya } from "./analitika.ts";
import { JANR_YOQ, kesim, materialQatorlari, muammolarChastotasi } from "./analytics.ts";
import { all, hozir } from "./db.ts";
import { vaznTahlili } from "./ekspert.ts";
import { tarjimon, type Tarjimon } from "./i18n/index.ts";
import type { Til } from "./i18n/til.ts";
import { umumiyKelishuv } from "./kelishuv.ts";
import { guruhNomi, korsatkichNomi } from "./kelishuvNomlari.ts";
import { davrNomi, KORSATKICHLAR as DAVR_KORSATKICHLARI, type AnalitikaMateriali, type DavrTaqqos } from "./davrlar.ts";
import type { Misol } from "./misollar.ts";
import { materialReytingi, MIN_REYTING, nashrReytingi } from "./reyting.ts";
import { metodikaniYuklash } from "./scoring.ts";
import type { Kesim, Metodika } from "./types.ts";

const SARLAVHA_RANGI = "FF1B3A5C";

function bezash(ws: ExcelJS.Worksheet, kengliklar: number[]) {
  const qator = ws.getRow(1);
  qator.font = { bold: true, color: { argb: "FFFFFFFF" } };
  qator.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SARLAVHA_RANGI } };
  qator.alignment = { wrapText: true, vertical: "middle" };
  qator.height = 42;
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
  kengliklar.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

async function kesimUstunlari(m: Metodika, birinchi: string, tr: Tarjimon) {
  const { t, atama } = tr;
  const muammolar = Object.values(m.kategoriyalar).filter((k) => k.guruh === "muammo");
  const mezonNomi = Object.fromEntries(
    (await all<{ kod: string; nomi: string }>("SELECT kod, nomi FROM mezonlar")).map((r) => [r.kod, atama.mezon(r.kod, r.nomi)]),
  );
  const head = [
    birinchi,
    t("xl.materiallarSoni"),
    ...["K1", "K2", "K3", "K4", "K5"].map((k) => `${k}. ${mezonNomi[k]}`),
    t("xl.lpsiOrtacha"),
    t("u.daraja"),
    ...muammolar.map((k) => t("xl.foizMat", { v: atama.kategoriya(k.kod, k.nomi) })),
  ];
  const qator = (r: Kesim, nomi: string) => [
    nomi,
    r.soni,
    r.k1,
    r.k2,
    r.k3,
    r.k4,
    r.k5,
    r.lpsi,
    atama.daraja(r.daraja),
    ...muammolar.map((k) => r.ulushlar[k.kod] ?? 0),
  ];
  const kengliklar = [26, 16, ...Array(7).fill(14), 14, ...muammolar.map(() => 18)];
  return { head, qator, kengliklar };
}

function reytingVaragi(ws: ExcelJS.Worksheet, nashrlar: Kesim[], materiallar: AnalitikaMateriali[], tr: Tarjimon) {
  const { t, atama, media } = tr;
  const ks = ["k1", "k2", "k3", "k4", "k5"] as const;
  ws.addRow([
    `${t("ry.orin")} (LPSI)`, t("u.nashr"), t("u.mediaTuri"), t("xl.materiallarSoni"), "LPSI", t("u.daraja"),
    ...ks.flatMap((k) => [k.toUpperCase(), t("ry.x.orinK", { k: k.toUpperCase() })]),
  ]);
  const orinlar = Object.fromEntries(ks.map((k) => [k, new Map(nashrReytingi(nashrlar, k).map((r) => [r.nomi, r.orin]))]));
  const asosiy = nashrReytingi(nashrlar, "lpsi");
  if (!asosiy.length) ws.addRow([t("xl.hozirchaYoq")]);
  for (const r of asosiy) {
    const n = nashrlar.find((x) => x.nomi === r.nomi)!;
    ws.addRow([
      r.orin, r.kam ? `${r.nomi}*` : r.nomi, media(r.media_turi), r.soni, r.qiymat, atama.daraja(r.daraja),
      ...ks.flatMap((k) => [n[k], orinlar[k].get(r.nomi) ?? null]),
    ]);
  }
  bezash(ws, [12, 22, 13, 14, 10, 14, ...ks.flatMap(() => [9, 11])]);
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

  const SONI = 10;
  const mr = materialReytingi(materiallar, "lpsi", SONI);
  if (mr.yuqori.length) {
    ws.addRow([]);
    ws.addRow([t("ry.x.materiallar", { n: SONI })]).font = { bold: true, size: 12 };
    const h = ws.addRow([t("ry.orin"), "LPSI", t("u.daraja"), t("u.sarlavha"), t("u.nashr"), t("u.sana"), "ID"]);
    h.font = { bold: true, color: { argb: "FFFFFFFF" } };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SARLAVHA_RANGI } };
    const qator = (x: (typeof mr.yuqori)[number]) =>
      ws.addRow([x.orin, x.qiymat, atama.daraja(x.m.daraja), x.m.sarlavha, x.m.nashr, x.m.sana, String(x.m.id).padStart(5, "0")]);
    mr.yuqori.forEach(qator);
    if (!mr.toliq) {
      ws.addRow(["…"]);
      [...mr.past].reverse().forEach(qator);
    }
  }
  ws.addRow([]);
  ws.addRow([t("ry.x.kamIzoh", { m: MIN_REYTING })]).font = { italic: true };
}

async function ahamiyatVaragi(ws: ExcelJS.Worksheet, ah: Ahamiyat, tr: Tarjimon) {
  const { t, atama, son } = tr;
  const mezonNomi = Object.fromEntries(
    (await all<{ kod: string; nomi: string }>("SELECT kod, nomi FROM mezonlar")).map((r) => [r.kod, atama.mezon(r.kod, r.nomi)]),
  );
  const kNomi = (k: Korsatkich) => (k === "lpsi" ? "LPSI" : `${k.toUpperCase()}. ${mezonNomi[k.toUpperCase()]}`);
  const xulosa = (ahamiyatli: boolean, yuqori?: string) =>
    ahamiyatli ? t("ah.ahamiyatli") + (yuqori ? ` (${t("ah.yuqori", { g: yuqori })})` : "") : t("ah.ahamiyatsiz");
  const bolim = (matn: string) => {
    if (ws.rowCount > 0) ws.addRow([]);
    ws.addRow([matn]).font = { bold: true, size: 12 };
  };
  const sarlavha = (ustunlar: string[]) => {
    const r = ws.addRow(ustunlar);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SARLAVHA_RANGI } };
    r.alignment = { wrapText: true, vertical: "middle" };
  };

  ws.addRow([t("ah.excelIzoh", { a: son(ah.alfa, 2) })]).font = { italic: true };

  // Bosma va raqamli: Mann–Whitney U
  bolim(`${t("ah.t.media")} — Mann–Whitney U`);
  if (ah.media.holat !== "ok") ws.addRow([t(ah.media.holat === "filtr" ? "ah.filtrMedia" : "ah.kamMedia")]);
  else {
    sarlavha([
      t("ah.korsatkich"), `${t("u.bosma")}: n`, `${t("u.bosma")}: Me`, `${t("u.raqamli")}: n`, `${t("u.raqamli")}: Me`,
      "U", "z", "p", t("ah.aniqUstun"), "r", t("ah.effekt"), t("ah.xulosa"),
    ]);
    for (const q of ah.media.qatorlar) {
      const x = q.test;
      ws.addRow([
        kNomi(q.korsatkich), q.bosma.n, q.bosma.mediana, q.raqamli.n, q.raqamli.mediana,
        x?.U ?? null, x?.z ?? null, x?.p ?? null, x ? t(x.aniq ? "ah.ha" : "ah.yoq") : null, x?.r ?? null,
        q.effekt ? t(`ah.e.${q.effekt}`) : null,
        x ? xulosa(x.p < ah.alfa, t(x.r > 0 ? "u.bosma" : "u.raqamli")) : null,
      ]);
    }
    ws.addRow([t("ah.izohMedia")]);

    // Muammolar ulushi: Fisher
    bolim(`${t("ah.t.muammo")} — Fisher`);
    sarlavha([
      t("u.kategoriya"), `${t("u.bosma")}: k`, `${t("u.bosma")}: n`, `${t("u.bosma")}: %`,
      `${t("u.raqamli")}: k`, `${t("u.raqamli")}: n`, `${t("u.raqamli")}: %`, "p", t("ah.pHolm"), t("ah.xulosa"),
    ]);
    for (const q of ah.media.muammolar) {
      ws.addRow([
        atama.kategoriya(q.kod, q.nomi), q.bosma.bor, q.bosma.n, q.bosma.ulush, q.raqamli.bor, q.raqamli.n, q.raqamli.ulush,
        q.p, q.pHolm, xulosa(q.pHolm < ah.alfa, t(q.bosma.ulush > q.raqamli.ulush ? "u.bosma" : "u.raqamli")),
      ]);
    }
    ws.addRow([t("ah.izohMuammo")]);
  }

  // Nashrlar va janrlar: Kruskal–Wallis H
  const kopGuruh = (nomi: string, b: KopGuruhBolimi, guruhNomi: (n: string) => string) => {
    bolim(`${nomi} — Kruskal–Wallis H`);
    const royxat = (gs: { nomi: string; n: number }[]) => gs.map((g) => `${guruhNomi(g.nomi)} (${g.n})`).join(", ");
    if (b.guruhlar.length) ws.addRow([t("ah.taqqoslangan", { v: royxat(b.guruhlar) })]);
    if (b.chiqarilgan.length) ws.addRow([t("ah.chiqarilgan", { m: ah.minGuruh, v: royxat(b.chiqarilgan) })]);
    if (b.holat !== "ok") {
      ws.addRow([b.holat === "kam" ? t("ah.kamGuruh", { m: ah.minGuruh }) : "—"]);
      return;
    }
    sarlavha([t("ah.korsatkich"), t("ah.guruhlarSoni"), "N", "H", "df", "p", "ε²", t("ah.effekt"), t("ah.xulosa"), t("ah.juftlar")]);
    for (const q of b.qatorlar) {
      const x = q.test;
      ws.addRow([
        kNomi(q.korsatkich), b.guruhlar.length, x?.N ?? null, x?.H ?? null, x?.df ?? null, x?.p ?? null, x?.epsilon2 ?? null,
        q.effekt ? t(`ah.e.${q.effekt}`) : null,
        x ? xulosa(x.p < ah.alfa) : null,
        q.juftlar
          .map((j) => `${guruhNomi(j.yuqori)} > ${guruhNomi(j.past)} (p ${j.pHolm < 0.0001 ? `< ${son(0.0001, 4)}` : `= ${son(j.pHolm, 4)}`})`)
          .join("; ") ||
          (x && x.p < ah.alfa ? t("ah.juftYoq") : ""),
      ]);
    }
  };
  kopGuruh(t("ah.t.nashr"), ah.nashr, (n) => n);
  kopGuruh(t("ah.t.janr"), ah.janr, (n) => atama.janr(n));
  kopGuruh(t("ah.t.yil"), ah.yil, (n) => n);
  ws.addRow([t("ah.izohYil")]);
  ws.addRow([t("ah.izohKop")]);

  [34, 14, 12, 14, 12, 12, 12, 14, 14, 12, 16, 40].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

/**
 * `ekspertUchun` — ekspert yuklaganda: asosiy tahlilning har bir material bo‘yicha varag‘i va
 * boshqa ekspertlarning shaxsiy vaznlari kiritilmaydi (mustaqil baholash uchun); umumiy natijalar qoladi.
 */
export async function excelHisobot(til: Til, { ekspertUchun = false }: { ekspertUchun?: boolean } = {}): Promise<{ buf: Buffer; fayl: string }> {
  const tr = tarjimon(til);
  const { t, atama, media, son } = tr;
  const m = await metodikaniYuklash();
  const qatorlar = await materialQatorlari();
  const wb = new ExcelJS.Workbook();
  wb.creator = "MediaPrag-Analytics";
  wb.created = new Date();
  const janr = (j: string | null) => (j == null || j === JANR_YOQ ? t("u.janrYoq") : atama.janr(j));

  // 1. Materiallar
  const materiallar = await all<{
    id: number; nashr: string; media_turi: string; sana: string | null; janr: string | null;
    mavzu: string | null; havola: string | null; sarlavha: string; lid: string | null;
    lpsi: number | null; tahlil_bor: number;
  }>(
    `SELECT m.id, n.nomi AS nashr, n.turi AS media_turi, m.sana, m.janr, m.mavzu, m.havola, m.sarlavha, m.lid,
            t.lpsi, t.material_id IS NOT NULL AS tahlil_bor
     FROM materiallar m JOIN nashrlar n ON n.id = m.nashr_id
     LEFT JOIN tahlillar t ON t.material_id = m.id ORDER BY m.id`,
  );
  const ws1 = wb.addWorksheet(t("xl.v.materiallar"));
  ws1.addRow([
    "ID", t("u.nashr"), t("u.mediaTuri"), t("u.sana"), t("u.janr"), t("u.mavzu"), t("u.havola"),
    t("u.sarlavha"), t("u.lid"), t("xl.holat"),
  ]);
  for (const r of materiallar) {
    ws1.addRow([
      String(r.id).padStart(5, "0"),
      r.nashr,
      media(r.media_turi),
      r.sana,
      r.janr ? atama.janr(r.janr) : null,
      r.mavzu,
      r.havola,
      r.sarlavha,
      r.lid,
      r.lpsi != null ? t("xl.h.qilingan") : r.tahlil_bor ? t("u.toliqEmas") : t("u.tahlilQilinmagan"),
    ]);
  }
  bezash(ws1, [10, 20, 13, 12, 14, 18, 30, 50, 50, 18]);

  // 2. Tahlil natijalari
  const kategoriyalar = Object.values(m.kategoriyalar);
  if (!ekspertUchun) {
  const tahlillar = await all<{
    id: number; nashr: string; media_turi: string; janr: string | null; sarlavha_turlari: string;
    sar_lid: string | null; lid_matn: string | null; sar_matn: string | null; kompozitsiya: string | null;
    auditoriya: number | null; izoh: string | null; k1: number | null; k2: number | null; k3: number | null;
    k4: number | null; k5: number | null; lpsi: number | null; daraja: string | null; metodika_versiya: number | null;
  }>(
    `SELECT m.id, n.nomi AS nashr, n.turi AS media_turi, m.janr, t.sarlavha_turlari, t.sar_lid, t.lid_matn,
            t.sar_matn, t.kompozitsiya, t.auditoriya, t.izoh, t.k1, t.k2, t.k3, t.k4, t.k5, t.lpsi, t.daraja,
            t.metodika_versiya
     FROM tahlillar t JOIN materiallar m ON m.id = t.material_id
     JOIN nashrlar n ON n.id = m.nashr_id ORDER BY m.id`,
  );
  const ws2 = wb.addWorksheet(t("xl.v.tahlil"));
  ws2.addRow([
    "ID", t("u.nashr"), t("u.mediaTuri"), t("u.janr"), t("xl.sarlavhaTuri"), t("iz.sar_lid"), t("iz.lid_matn"),
    t("iz.sar_matn"), t("iz.kompozitsiya"), t("xl.auditoriya"),
    ...kategoriyalar.map((k) => t("xl.soniQavs", { v: atama.kategoriya(k.kod, k.nomi) })),
    "K1", "K2", "K3", "K4", "K5", "LPSI", t("u.daraja"), t("xl.metodikaVersiyasi"), t("u.izoh"),
  ]);
  const sanoqlar = new Map<number, Record<string, number>>();
  for (const q of qatorlar) sanoqlar.set(q.id, q.sanoq);
  for (const r of tahlillar) {
    const sanoq = sanoqlar.get(r.id) ?? {};
    ws2.addRow([
      String(r.id).padStart(5, "0"),
      r.nashr,
      media(r.media_turi),
      r.janr ? atama.janr(r.janr) : null,
      (JSON.parse(r.sarlavha_turlari || "[]") as string[]).map((k) => atama.lugat("sarlavha_turi", k)).join("; "),
      r.sar_lid ? atama.lugat("muvofiqlik", r.sar_lid) : null,
      r.lid_matn ? atama.lugat("muvofiqlik", r.lid_matn) : null,
      r.sar_matn ? atama.lugat("muvofiqlik", r.sar_matn) : null,
      r.kompozitsiya ? atama.lugat("kompozitsiya", r.kompozitsiya) : null,
      r.auditoriya,
      ...kategoriyalar.map((k) => sanoq[k.kod] ?? 0),
      r.k1, r.k2, r.k3, r.k4, r.k5, r.lpsi, atama.daraja(r.daraja), r.metodika_versiya, r.izoh,
    ]);
  }
  bezash(ws2, [10, 20, 13, 14, 26, 16, 16, 18, 20, 16, ...kategoriyalar.map(() => 16), 10, 10, 10, 10, 10, 10, 14, 14, 40]);
  }

  // 3–5. Kesimlar
  const kesimlar: [string, string, Kesim[], (k: Kesim) => string][] = [
    [t("xl.v.nashrlar"), t("u.nashr"), kesim(qatorlar, m, (q) => q.nashr), (k) => k.nomi],
    [t("xl.v.media"), t("u.mediaTuri"), kesim(qatorlar, m, (q) => q.media_turi), (k) => media(k.nomi)],
    [t("xl.v.janrlar"), t("u.janr"), kesim(qatorlar, m, (q) => q.janr ?? JANR_YOQ), (k) => janr(k.nomi)],
  ];
  for (const [nomi, birinchi, rows, nom] of kesimlar) {
    const ws = wb.addWorksheet(nomi);
    const { head, qator, kengliklar } = await kesimUstunlari(m, birinchi, tr);
    ws.addRow(head);
    if (rows.length) for (const r of rows) ws.addRow(qator(r, nom(r)));
    else ws.addRow([t("xl.hozirchaYoq")]);
    bezash(ws, kengliklar);
  }

  // Reyting: nashrlar o‘rni (LPSI va K1–K5), eng yuqori va eng past materiallar
  const a = await analitika();
  reytingVaragi(wb.addWorksheet(t("xl.v.reyting")), a.kesimlar.nashr, a.materiallar, tr);

  // 6. Muammolar chastotasi
  const ws6 = wb.addWorksheet(t("xl.v.muammolar"));
  ws6.addRow([
    t("u.kategoriya"), t("u.guruh"), t("u.mezon"), t("xl.jamiBirliklar"), t("xl.sarlavhada"), t("xl.lidda"),
    t("xl.matnda"), t("xl.materiallarSoni"), t("u.foizMateriallar"),
  ]);
  for (const q of await muammolarChastotasi(qatorlar, m)) {
    ws6.addRow([
      atama.kategoriya(q.kod, q.nomi),
      q.guruh === "muammo" ? t("u.muammo") : t("u.vosita"),
      q.mezon ?? "—",
      q.birliklar,
      q.qismlar.sarlavha,
      q.qismlar.lid,
      q.qismlar.matn,
      q.materiallar,
      q.ulush,
    ]);
  }
  bezash(ws6, [30, 22, 10, 16, 14, 12, 16, 18, 16]);

  // 7–8. Sarlavha turlari va dinamika
  const wsS = wb.addWorksheet(t("xl.v.sarlavha"));
  wsS.addRow([t("xl.sarlavhaTuri"), t("xl.materiallarSoni"), t("u.foizMateriallar"), t("xl.bosmaFoiz"), t("xl.raqamliFoiz")]);
  for (const s of a.sarlavhaTurlari) wsS.addRow([atama.lugat("sarlavha_turi", s.kod, s.nomi), s.soni, s.ulush, s.bosma, s.raqamli]);
  bezash(wsS, [30, 18, 16, 14, 14]);

  const wsD = wb.addWorksheet(t("xl.v.dinamika"));
  wsD.addRow([t("xl.davrTuri"), t("xl.davr"), t("xl.media"), t("xl.materiallarSoni"), "K1", "K2", "K3", "K4", "K5", "LPSI"]);
  const davrTurlari: Granulyatsiya[] = ["oy", "chorak", "yil"];
  for (const g of davrTurlari) {
    const d = a.dinamika[g];
    d.davrlar.forEach((davr, i) => {
      for (const s of d.seriyalar) {
        const p = s.nuqtalar[i];
        if (p) {
          wsD.addRow([t(`xl.g.${g}`), tr.davr(davr.kalit), t(`an.seriya.${s.kalit}`), p.soni, p.k1, p.k2, p.k3, p.k4, p.k5, p.lpsi]);
        }
      }
    });
  }
  if (wsD.rowCount === 1) wsD.addRow([t("xl.sanaliYoq")]);
  bezash(wsD, [12, 16, 16, 18, 10, 10, 10, 10, 10, 10]);

  // 9. Statistik ahamiyat (butun tanlanma bo‘yicha)
  await ahamiyatVaragi(wb.addWorksheet(t("xl.v.ahamiyat")), a.ahamiyat, tr);

  // 10–11. Ekspertlar: kodlash kelishuvi va vaznlar so‘rovi
  const kel = await umumiyKelishuv(true);
  const wsK = wb.addWorksheet(t("xl.v.kelishuv"));
  wsK.addRow([
    t("xl.korsatkich"), t("u.guruh"), t("xl.olchov"), "Krippendorff α", t("xl.talqin"),
    t("xl.mosJuftlar"), t("xl.ortachaFarq"), t("u.materiallar"), t("xl.juftlanuvchi"),
  ]);
  for (const q of [...kel.qatorlar, ...kel.kategoriyalar]) {
    wsK.addRow([
      korsatkichNomi(q.kalit, tr),
      guruhNomi(q.guruh, tr),
      t(`eks.d.${q.daraja}`),
      q.alpha,
      q.talqin ? t(`eks.t.${q.talqin}`) : t("xl.aniqlanmaydi"),
      q.kelishuv,
      q.farq,
      q.birliklar,
      q.qiymatlar,
    ]);
  }
  wsK.addRow([]);
  wsK.addRow([t("xl.baholovchilarIzoh", { b: kel.baholovchilar, m: kel.materiallar })]);
  wsK.addRow([t("xl.alphaTalqin")]);
  bezash(wsK, [32, 26, 16, 16, 14, 16, 14, 14, 20]);

  const vz = await vaznTahlili();
  const wsV = wb.addWorksheet(t("xl.v.vaznlar"));
  if (!ekspertUchun) {
    wsV.addRow([t("xl.ekspert"), "K1", "K2", "K3", "K4", "K5", t("u.izoh")]);
    for (const v of vz.vaznlar) wsV.addRow([v.ism, v.vaznlar.K1, v.vaznlar.K2, v.vaznlar.K3, v.vaznlar.K4, v.vaznlar.K5, v.izoh]);
  }
  bezash(wsV, [30, 12, 12, 12, 12, 12, 30]);
  if (!ekspertUchun) wsV.addRow([]);
  const jSarlavha = wsV.addRow([
    t("u.mezon"), t("xl.joriy"), t("xl.ortacha"), t("xl.mediana"), "SD", "CV, %", "Min", "Max", t("xl.ortRang"), t("xl.taklif"),
  ]);
  jSarlavha.font = { bold: true };
  for (const mz of vz.mezonlar) {
    wsV.addRow([`${mz.kod}. ${atama.mezon(mz.kod, mz.nomi)}`, mz.joriy, mz.ortacha, mz.mediana, mz.sd, mz.cv, mz.min, mz.max, mz.ortacha_rang, mz.taklif]);
  }
  wsV.addRow([]);
  if (vz.kendall) {
    const kw = vz.kendall;
    wsV.addRow(["Kendall W", kw.W]);
    wsV.addRow(["χ²", kw.chi2]);
    wsV.addRow(["df", kw.df]);
    wsV.addRow(["p", kw.p]);
    wsV.addRow([t("xl.ekspertlarM"), kw.m]);
  } else {
    wsV.addRow([t("xl.kendallKam")]);
  }

  // 12. Metodika
  const wsM = wb.addWorksheet(t("xl.v.metodika"));
  const sarlavhaQator = (matn: string) => {
    wsM.addRow([]);
    const r = wsM.addRow([matn]);
    r.font = { bold: true, size: 12 };
  };
  const jadvalSarlavha = (ustunlar: string[]) => {
    const r = wsM.addRow(ustunlar);
    r.font = { bold: true };
  };
  const birinchi = wsM.addRow([t("xl.m.sarlavha", { v: m.versiya })]);
  birinchi.font = { bold: true, size: 14 };
  wsM.addRow([t("xl.m.sana", { v: hozir().replace("T", " ") })]);
  wsM.addRow([t("xl.m.formula")]);

  sarlavhaQator(t("xl.m.mezonlar"));
  jadvalSarlavha([t("xl.m.kod"), t("u.mezon"), t("xl.m.vazn"), t("xl.m.hisoblash")]);
  for (const r of await all<{ kod: string; nomi: string; vazn: number; tavsif: string }>("SELECT * FROM mezonlar ORDER BY kod")) {
    wsM.addRow([r.kod, atama.mezon(r.kod, r.nomi), r.vazn, atama.mezonTavsif(r.kod, r.tavsif)]);
  }

  sarlavhaQator(t("xl.m.muvofiqlik"));
  jadvalSarlavha([t("xl.m.holat"), t("xl.m.qiymat")]);
  for (const [kod, qiymat] of Object.entries(m.muvofiqlik)) wsM.addRow([atama.lugat("muvofiqlik", kod), qiymat]);

  sarlavhaQator(t("xl.m.kompozitsiya"));
  jadvalSarlavha([t("iz.kompozitsiya"), t("xl.m.ball")]);
  for (const [kod, qiymat] of Object.entries(m.kompozitsiya)) wsM.addRow([atama.lugat("kompozitsiya", kod), qiymat]);

  sarlavhaQator(t("xl.m.kategoriyalar"));
  jadvalSarlavha([t("u.kategoriya"), t("u.guruh"), t("u.mezon"), t("xl.m.jarima")]);
  for (const kat of kategoriyalar) {
    wsM.addRow([
      atama.kategoriya(kat.kod, kat.nomi),
      kat.guruh === "muammo" ? t("u.muammo") : t("u.vosita"),
      kat.mezon ?? "—",
      kat.jarima,
    ]);
  }

  sarlavhaQator(t("xl.m.shkala"));
  jadvalSarlavha([t("xl.m.oraliq"), t("u.daraja")]);
  let quyi = 0;
  for (const oraliq of m.shkala) {
    wsM.addRow([`${son(quyi)}–${son(oraliq.gacha)}`, atama.daraja(oraliq.nomi)]);
    quyi = oraliq.gacha;
  }
  [34, 30, 22, 70].forEach((w, i) => {
    wsM.getColumn(i + 1).width = w;
  });

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return { buf, fayl: `${t("xl.fayl", { d: new Date().toISOString().slice(0, 10) })}.xlsx` };
}

/** Misollar korpusi (sahifadagi filtr bo‘yicha): har qatorda fragment, uning gapi (fragment qalin) va manba. */
export async function misollarExcel(til: Til, misollar: Misol[]): Promise<{ buf: Buffer; fayl: string }> {
  const { t, atama, media, qism } = tarjimon(til);
  const wb = new ExcelJS.Workbook();
  wb.creator = "MediaPrag-Analytics";
  wb.created = new Date();
  const ws = wb.addWorksheet(t("ms.x.varaq"));
  ws.addRow([
    "№", t("u.kategoriya"), t("u.guruh"), t("u.qism"), t("ms.x.fragment"), t("ms.x.kontekst"), t("u.izoh"),
    t("u.nashr"), t("u.mediaTuri"), t("u.sana"), t("u.janr"), t("ms.x.materialSarlavhasi"), "ID",
    t("ms.x.tasdiq"), t("ms.x.tanlangan"), t("xl.holat"), t("u.havola"),
  ]);
  misollar.forEach((m, i) => {
    const k = m.kontekst;
    const kontekst: ExcelJS.CellValue = k
      ? { richText: [{ text: k.oldin }, { text: k.fragment, font: { bold: true } }, { text: k.keyin }].filter((r) => r.text) }
      : t("ms.x.topilmadi");
    const r = ws.addRow([
      i + 1,
      atama.kategoriya(m.kategoriya, m.kategoriya_nomi),
      m.guruh === "muammo" ? t("u.muammo") : t("u.vosita"),
      qism(m.qism),
      m.fragment,
      kontekst,
      m.izoh,
      m.nashr,
      media(m.turi),
      m.sana,
      m.janr === JANR_YOQ ? t("u.janrYoq") : atama.janr(m.janr),
      m.sarlavha,
      String(m.material_id).padStart(5, "0"),
      m.ekspertlar ? `${m.tasdiq}/${m.ekspertlar}` : "—",
      m.tanlangan ? "★" : "",
      m.toliq ? t("xl.h.qilingan") : t("u.toliqEmas"),
      m.havola,
    ]);
    r.alignment = { wrapText: true, vertical: "top" };
  });
  bezash(ws, [6, 24, 16, 13, 40, 60, 30, 18, 12, 12, 14, 40, 9, 12, 10, 16, 30]);
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 17 } };
  ws.addRow([]);
  ws.addRow([t("ms.x.izoh")]).font = { italic: true };

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return { buf, fayl: `${t("ms.x.fayl", { d: new Date().toISOString().slice(0, 10) })}.xlsx` };
}

/** Ikki davrni taqqoslash (Analitika kartasidagi bilan bir xil hisob): ko‘rsatkichlar va muammolar ulushi. */
export async function davrlarExcel(til: Til, d: DavrTaqqos, filtrMatni: string | null): Promise<{ buf: Buffer; fayl: string }> {
  const tr = tarjimon(til);
  const { t, atama } = tr;
  const wb = new ExcelJS.Workbook();
  wb.creator = "MediaPrag-Analytics";
  wb.created = new Date();
  const ws = wb.addWorksheet(t("dv.x.varaq"));
  const mezonNomi = Object.fromEntries(
    (await all<{ kod: string; nomi: string }>("SELECT kod, nomi FROM mezonlar")).map((r) => [r.kod, atama.mezon(r.kod, r.nomi)]),
  );
  const kNomi = (k: string) => (k === "lpsi" ? "LPSI" : `${k.toUpperCase()}. ${mezonNomi[k.toUpperCase()]}`);
  const sarlavha = (ustunlar: string[]) => {
    const r = ws.addRow(ustunlar);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SARLAVHA_RANGI } };
    r.alignment = { wrapText: true, vertical: "middle" };
  };
  const xulosa = (ahamiyatli: boolean, yuqori?: string) =>
    ahamiyatli ? t("ah.ahamiyatli") + (yuqori ? ` (${t("ah.yuqori", { g: yuqori })})` : "") : t("ah.ahamiyatsiz");

  ws.addRow([t("dv.sarlavha")]).font = { bold: true, size: 13 };
  ws.addRow([t("dv.x.davr", { g: "A", v: davrNomi(d.a.oraliq, tr.davr), n: d.a.n })]);
  ws.addRow([t("dv.x.davr", { g: "B", v: davrNomi(d.b.oraliq, tr.davr), n: d.b.n })]);
  if (filtrMatni) ws.addRow([t("dv.x.filtr", { v: filtrMatni })]);
  if (d.sanasiz) ws.addRow([t("dv.sanasiz", { n: d.sanasiz })]);
  if (d.kesishadi) ws.addRow([t("dv.kesishadi")]).font = { bold: true, color: { argb: "FFA4161A" } };
  else if (d.a.n < 2 || d.b.n < 2) ws.addRow([t("dv.kam")]).font = { bold: true, color: { argb: "FFA4161A" } };

  ws.addRow([]);
  ws.addRow([t("dv.korsatkichlar")]).font = { bold: true, size: 12 };
  sarlavha([
    t("ah.korsatkich"), "A: n", "A: M", "A: Me", "B: n", "B: M", "B: Me", t("dv.farq"),
    "U", "z", "p", t("ah.aniqUstun"), "r", t("ah.effekt"), t("ah.xulosa"),
  ]);
  for (const k of DAVR_KORSATKICHLARI) {
    const q = d.qatorlar.find((x) => x.korsatkich === k)!;
    const x = q.test;
    ws.addRow([
      kNomi(k), q.a.n, q.a.ortacha, q.a.mediana, q.b.n, q.b.ortacha, q.b.mediana, q.farq,
      x?.U ?? null, x?.z ?? null, x?.p ?? null, x ? t(x.aniq ? "ah.ha" : "ah.yoq") : null, x?.r ?? null,
      q.effekt ? t(`ah.e.${q.effekt}`) : null,
      x ? xulosa(x.p < 0.05, x.r > 0 ? "B" : "A") : null,
    ]);
  }

  ws.addRow([]);
  ws.addRow([t("dv.muammolar")]).font = { bold: true, size: 12 };
  sarlavha([t("u.kategoriya"), "A: k", "A: n", "A: %", "B: k", "B: n", "B: %", t("dv.farqPp"), "p", t("ah.pHolm"), t("ah.xulosa")]);
  const testlar = !d.kesishadi && d.a.n >= 2 && d.b.n >= 2;
  for (const q of d.muammolar) {
    ws.addRow([
      atama.kategoriya(q.kod, q.nomi), q.a.bor, q.a.n, q.a.ulush, q.b.bor, q.b.n, q.b.ulush, q.farq,
      testlar ? q.p : null, testlar ? q.pHolm : null,
      testlar ? xulosa(q.pHolm < 0.05, q.b.ulush > q.a.ulush ? "B" : "A") : null,
    ]);
  }
  ws.addRow([]);
  ws.addRow([t("dv.izohUsul")]).font = { italic: true };
  [34, 9, 10, 10, 9, 10, 10, 16, 10, 10, 10, 12, 10, 14, 30].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return { buf, fayl: `${t("dv.x.fayl", { d: new Date().toISOString().slice(0, 10) })}.xlsx` };
}
