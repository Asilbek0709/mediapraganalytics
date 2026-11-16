/** «Nashr hisoboti» — bitta nashr bo‘yicha redaksion tahlil uchun PDF (foydalanuvchi tilida). */
import { all, hozir } from "./db.ts";
import { darajaIndeks, idRaqami, sana } from "./format.ts";
import { tarjimon } from "./i18n/index.ts";
import type { Til } from "./i18n/til.ts";
import { CHEGARA_BALL, CHEGARA_FP, nashrHisoboti, type Xulosa } from "./nashrHisoboti.ts";
import { izohQatorlari, metodologikIzoh } from "./metodologikIzoh.ts";
import { CHAP, KENGLIK, RANG, yangiHujjat, type Katak } from "./pdfAsos.ts";
import type { Korsatkich } from "./davrlar.ts";

const ALFA = 0.05;
const yulduz = (p: number) => (p < 0.001 ? "***" : p < 0.01 ? "**" : p < 0.05 ? "*" : "");

export async function nashrHisobotiPdf(
  nashrId: number,
  davr: { dan?: string; gacha?: string },
  til: Til,
): Promise<{ pdf: Buffer; fayl: string }> {
  const tr = tarjimon(til);
  const { t, son, atama, media } = tr;
  const h = await nashrHisoboti(nashrId, davr);
  const mezonNomi = Object.fromEntries(
    (await all<{ kod: string; nomi: string }>("SELECT kod, nomi FROM mezonlar")).map((r) => [r.kod, atama.mezon(r.kod, r.nomi)]),
  );
  const kNomi = (k: Korsatkich) => (k === "lpsi" ? "LPSI" : `${k.toUpperCase()}. ${mezonNomi[k.toUpperCase()]}`);
  const ishorali = (v: number | null, kasr = 1) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${son(Math.abs(v), kasr)}`);
  const pMatn = (p: number) => (p < 0.001 ? `< ${son(0.001, 3)}` : son(p, 3));
  const davrMatni =
    h.davr.dan || h.davr.gacha
      ? `${h.davr.dan ? sana(h.davr.dan) : "…"}–${h.davr.gacha ? sana(h.davr.gacha) : "…"}`
      : h.sanalar.min
        ? `${t("nh.butunDavr")} (${sana(h.sanalar.min)}–${sana(h.sanalar.max)})`
        : t("nh.butunDavr");

  const sarlavha = t("nh.sarlavha", { v: h.nashr.nomi });
  const { doc, joy, lenta, bolim, izoh, jadval, yakunlash } = yangiHujjat(sarlavha);
  lenta(sarlavha, t("nh.ost"), `${media(h.nashr.turi)} · ${t("nh.davr", { v: davrMatni })}`);

  // ------------------------------------------------------------------ umumiy ko‘rsatkichlar
  bolim(t("nh.umumiy"), t("u.metodikaV", { v: h.metodika_versiya }));
  const lpsiQatori = h.korsatkichlar.find((q) => q.k === "lpsi")!;
  {
    joy(84);
    const y0 = doc.y;
    const i = darajaIndeks(h.daraja, h.shkala);
    doc.roundedRect(CHAP, y0, 150, 72, 8).fill(RANG.surface2);
    doc.font("b").fontSize(30).fillColor(RANG.ink).text(son(h.lpsi), CHAP + 14, y0 + 8, { width: 124 });
    doc.font("r").fontSize(8.5).fillColor(RANG.muted).text(t("pdf.lpsiBalldan"), CHAP + 14, y0 + 44, { width: 124 });
    if (h.daraja) {
      doc.roundedRect(CHAP + 14, y0 + 56 - 2, 110, 15, 7.5).fill(i == null ? RANG.muted : RANG.lvl[i]);
      doc.font("b").fontSize(8.5).fillColor("#ffffff").text(atama.daraja(h.daraja), CHAP + 14, y0 + 56, { width: 110, align: "center" });
    }
    const x = CHAP + 166;
    const w = KENGLIK - 166;
    const satrlar = [
      lpsiQatori.orin != null ? t("nh.orin", { o: `${lpsiQatori.teng ? "=" : ""}${lpsiQatori.orin}`, n: h.soni.nashrlar }) : null,
      lpsiQatori.korpus != null ? t("nh.korpusOrtacha", { v: son(lpsiQatori.korpus), f: ishorali(lpsiQatori.farq) }) : null,
      lpsiQatori.turdagi != null && h.soni.turdagiNashrlar > 1
        ? t(`nh.turdagi.${h.nashr.turi}`, { v: son(lpsiQatori.turdagi), f: ishorali(lpsiQatori.nashr != null ? lpsiQatori.nashr - lpsiQatori.turdagi : null) })
        : null,
      t("nh.tahlilQilingan", { a: h.soni.toliq, b: h.soni.jami }),
      t("nh.korpusHajmi", { n: h.soni.korpus, k: h.soni.nashrlar }),
    ].filter((s): s is string => !!s);
    let y = y0 + 2;
    satrlar.forEach((s, j) => {
      doc.font(j === 0 ? "b" : "r").fontSize(j === 0 ? 11 : 9.5).fillColor(j === 0 ? RANG.ink : RANG.ink2).text(s, x, y, { width: w });
      y = doc.y + 3;
    });
    doc.y = Math.max(y0 + 84, y + 6);
    doc.x = CHAP;
  }

  if (h.soni.toliq === 0) {
    izoh(t("nh.malumotYoq"), RANG.muammo, 10.5);
    return { pdf: await yakunlash(kolontitul()), fayl: faylNomi() };
  }
  if (h.soni.toliq < 5) izoh(t("nh.kamMaterial", { n: h.soni.toliq }), RANG.muammo, 9);

  // ------------------------------------------------------------------ mezonlar
  bolim(t("nh.mezonlar"), undefined, 80);
  for (const q of h.korsatkichlar) {
    joy(38);
    const y = doc.y;
    const lpsimi = q.k === "lpsi";
    doc.font("b").fontSize(10).fillColor(RANG.ink).text(kNomi(q.k), CHAP, y, { width: 230 });
    const bx = CHAP + 240;
    const bw = 190;
    doc.roundedRect(bx, y + 3, bw, 8, 4).fill(RANG.surface2);
    if (q.nashr != null && q.nashr > 0) doc.roundedRect(bx, y + 3, (bw * Math.min(100, q.nashr)) / 100, 8, 4).fill(lpsimi ? RANG.brand : RANG.s1);
    if (q.korpus != null) {
      const kx = bx + (bw * Math.min(100, q.korpus)) / 100;
      doc.moveTo(kx, y).lineTo(kx, y + 14).lineWidth(1.6).strokeColor(RANG.ink).stroke();
    }
    doc.font("b").fontSize(11).fillColor(RANG.ink).text(son(q.nashr), bx + bw + 8, y, { width: KENGLIK - (bx + bw + 8 - CHAP), align: "right" });
    const ahamiyatli = !!q.test && q.test.p < ALFA;
    const tafsilot = [
      t("nh.mezonIzoh", {
        k: son(q.korpus),
        f: ishorali(q.farq),
        o: q.orin == null ? "—" : `${q.teng ? "=" : ""}${q.orin}`,
        n: h.soni.nashrlar,
      }),
      q.test ? `p = ${pMatn(q.test.p)}${yulduz(q.test.p)}${q.effekt ? ` (${t(`ah.e.${q.effekt}`)})` : ""}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    doc.y = y + 16;
    doc.font(ahamiyatli ? "b" : "r").fontSize(8).fillColor(ahamiyatli ? (q.farq != null && q.farq < 0 ? RANG.muammo : RANG.ok) : RANG.muted);
    doc.text(tafsilot, CHAP, doc.y, { width: KENGLIK });
    doc.y += 6;
  }
  izoh(t("nh.chiziqIzoh"));

  // ------------------------------------------------------------------ kuchli va zaif tomonlar
  const xulosaMatni = (x: Xulosa) => {
    if (x.tur === "korsatkich") {
      return t("nh.xK", { k: `${x.kod}. ${atama.mezon(x.kod, x.nomi)}`, v: son(x.qiymat), kp: son(x.korpus), f: ishorali(x.farq) });
    }
    const p = { k: atama.kategoriya(x.kod, x.nomi), v: son(x.qiymat), kp: son(x.korpus), f: ishorali(x.farq) };
    return x.farq < 0 ? t("nh.kamUchraydi", p) : t("nh.kopUchraydi", p);
  };
  const royxat = (nomi: string, xs: Xulosa[], rang: string) => {
    bolim(nomi);
    if (!xs.length) {
      izoh(t("nh.yoqXulosa"), RANG.muted, 9.5);
      return;
    }
    for (const x of xs) {
      const matn = xulosaMatni(x);
      const qosh = x.ahamiyatli ? ` — ${t("nh.ahamiyatli")}` : "";
      const bal = doc.font("r").fontSize(10).heightOfString(matn + qosh, { width: KENGLIK - 16 });
      joy(bal + 6);
      const y = doc.y;
      doc.circle(CHAP + 4, y + 6, 2.6).fill(rang);
      doc.font("r").fontSize(10).fillColor(RANG.ink).text(matn, CHAP + 14, y, { width: KENGLIK - 16, continued: !!qosh });
      if (qosh) doc.font("b").fillColor(rang).text(qosh);
      doc.y = Math.max(doc.y, y + bal) + 4;
      doc.x = CHAP;
    }
  };
  royxat(t("nh.kuchli"), h.kuchli, RANG.ok);
  royxat(t("nh.zaif"), h.zaif, RANG.muammo);
  izoh(t("nh.qoida", { b: CHEGARA_BALL, p: CHEGARA_FP }));

  // ------------------------------------------------------------------ muammolar profili
  bolim(t("nh.muammolar"), undefined, 110);
  const farqKatak = (farq: number, yaxshiKamaysa: boolean): Katak =>
    Math.abs(farq) >= CHEGARA_FP
      ? { matn: ishorali(farq), qalin: true, rang: (farq < 0) === yaxshiKamaysa ? RANG.ok : RANG.muammo }
      : ishorali(farq);
  jadval(
    [
      { nomi: t("u.kategoriya"), en: 27 },
      { nomi: t("u.mezon"), en: 12, tekis: "center" },
      { nomi: t("nh.u.nashrFoiz"), en: 16, tekis: "right" },
      { nomi: t("nh.u.korpus"), en: 11, tekis: "right" },
      { nomi: t("dv.farqPp"), en: 12, tekis: "right" },
      { nomi: t("nh.u.birliklar"), en: 10, tekis: "right" },
      { nomi: t("ah.pHolm"), en: 12, tekis: "right" },
    ],
    h.muammolar.map((q) => [
      atama.kategoriya(q.kod, q.nomi),
      q.mezon ?? "—",
      `${son(q.ulush)} (${q.bor}/${h.soni.toliq})`,
      son(q.korpusUlush),
      farqKatak(q.farq, true),
      String(q.birliklar),
      q.pHolm == null ? "—" : { matn: `${pMatn(q.pHolm)}${yulduz(q.pHolm)}`, qalin: q.pHolm < ALFA },
    ]),
  );
  bolim(t("kel.g.vosita"));
  jadval(
    [
      { nomi: t("u.kategoriya"), en: 39 },
      { nomi: t("nh.u.nashrFoiz"), en: 22, tekis: "right" },
      { nomi: t("nh.u.korpus"), en: 17, tekis: "right" },
      { nomi: t("dv.farqPp"), en: 12, tekis: "right" },
      { nomi: t("nh.u.birliklar"), en: 10, tekis: "right" },
    ],
    h.vositalar.map((q) => [
      atama.kategoriya(q.kod, q.nomi),
      `${son(q.ulush)} (${q.bor}/${h.soni.toliq})`,
      son(q.korpusUlush),
      ishorali(q.farq),
      String(q.birliklar),
    ]),
  );

  // ------------------------------------------------------------------ matn qismlari va muvofiqlik
  bolim(t("nh.qismlar"));
  jadval(
    [
      { nomi: t("u.qism"), en: 50 },
      { nomi: t("nh.u.nashrFoiz"), en: 25, tekis: "right" },
      { nomi: t("nh.u.korpus"), en: 25, tekis: "right" },
    ],
    (["sarlavha", "lid", "matn"] as const).map((q) => [tr.qism(q), son(h.qismlar.nashr[q]), son(h.qismlar.korpus[q])]),
  );
  izoh(t("nh.qismIzoh", { n: h.qismlar.jami }));

  bolim(t("nh.muvofiqlik"));
  const muvNomi = (k: "mos" | "qisman" | "mos_emas") => atama.lugat("muvofiqlik", k);
  jadval(
    [
      { nomi: "", en: 34 },
      { nomi: muvNomi("mos"), en: 22, tekis: "right" },
      { nomi: muvNomi("qisman"), en: 22, tekis: "right" },
      { nomi: muvNomi("mos_emas"), en: 22, tekis: "right" },
    ],
    h.muvofiqlik.map((q) => [
      t(`iz.${q.munosabat}`),
      `${son(q.nashr.mos)} (${son(q.korpus.mos)})`,
      `${son(q.nashr.qisman)} (${son(q.korpus.qisman)})`,
      q.nashr.mos_emas - q.korpus.mos_emas >= CHEGARA_FP
        ? { matn: `${son(q.nashr.mos_emas)} (${son(q.korpus.mos_emas)})`, qalin: true, rang: RANG.muammo }
        : `${son(q.nashr.mos_emas)} (${son(q.korpus.mos_emas)})`,
    ]),
  );
  izoh(t("nh.muvIzoh"));

  // ------------------------------------------------------------------ sarlavha turlari va dinamika
  if (h.sarlavhaTurlari.length) {
    bolim(t("an.turlar"));
    jadval(
      [
        { nomi: t("xl.sarlavhaTuri"), en: 50 },
        { nomi: t("nh.u.nashrFoiz"), en: 25, tekis: "right" },
        { nomi: t("nh.u.korpus"), en: 25, tekis: "right" },
      ],
      h.sarlavhaTurlari.map((s) => [atama.lugat("sarlavha_turi", s.kod, s.nomi), son(s.ulush), son(s.korpusUlush)]),
    );
  }

  bolim(t("an.dinamika"), t(`xl.g.${h.dinamika.granulyatsiya}`));
  if (h.dinamika.davrlar.length < 2) izoh(t("nh.dinamikaYoq"), RANG.muted, 9.5);
  else
    jadval(
      [
        { nomi: t("an.davr"), en: 34 },
        { nomi: t("u.soni"), en: 18, tekis: "right" },
        { nomi: t("nh.u.lpsiNashr"), en: 24, tekis: "right" },
        { nomi: t("nh.u.lpsiKorpus"), en: 24, tekis: "right" },
      ],
      h.dinamika.davrlar.map((d) => [tr.davr(d.kalit), String(d.soni), son(d.lpsi), son(d.korpus)]),
    );

  // ------------------------------------------------------------------ tipik misollar
  bolim(t("nh.misollar"));
  if (!h.misollar.length) izoh(t("nh.misolYoq"), RANG.muted, 9.5);
  else {
    izoh(t("nh.misolIzoh"));
    const [och, yop] = til === "en" ? ["“", "”"] : ["«", "»"];
    for (const g of h.misollar) {
      joy(40);
      doc.moveDown(0.3);
      doc.font("b").fontSize(10).fillColor(RANG.ink).text(t("nh.misolGuruh", { k: atama.kategoriya(g.kod, g.nomi), v: son(g.ulush) }), CHAP, doc.y, { width: KENGLIK });
      doc.moveDown(0.2);
      for (const x of g.royxat) {
        const k = x.kontekst;
        const belgilar = [x.tanlangan ? t("nh.tanlangan") : null, x.ekspertlar ? t("nh.tasdiq", { a: x.tasdiq, b: x.ekspertlar }) : null]
          .filter(Boolean)
          .join(" · ");
        const manba = `${x.sana ? sana(x.sana) : "—"} · ${och}${x.sarlavha}${yop} · ${tr.qism(x.qism)}${belgilar ? ` · ${belgilar}` : ""}`;
        const matn = k ? `${och}${k.oldin}${k.fragment}${k.keyin}${yop}` : `${och}${x.fragment}${yop}`;
        const bal =
          doc.font("r").fontSize(9.5).heightOfString(matn, { width: KENGLIK - 14 }) +
          doc.font("r").fontSize(8).heightOfString(manba, { width: KENGLIK - 14 }) +
          4;
        joy(bal + 8);
        const y = doc.y;
        doc.rect(CHAP, y, 2.5, bal).fill(RANG.muammo);
        // Gap ichida fragment qalin
        if (k) {
          doc.font("r").fontSize(9.5).fillColor(RANG.ink2).text(`${och}${k.oldin}`, CHAP + 12, y, { width: KENGLIK - 14, continued: true });
          doc.font("b").fillColor(RANG.ink).text(k.fragment, { continued: true });
          doc.font("r").fillColor(RANG.ink2).text(`${k.keyin}${yop}`);
        } else {
          doc.font("b").fontSize(9.5).fillColor(RANG.ink).text(matn, CHAP + 12, y, { width: KENGLIK - 14 });
        }
        doc.font("r").fontSize(8).fillColor(RANG.muted).text(manba, CHAP + 12, doc.y + 2, { width: KENGLIK - 14 });
        doc.y = Math.max(doc.y, y + bal) + 7;
        doc.x = CHAP;
      }
    }
  }

  // ------------------------------------------------------------------ eng yuqori va eng past materiallar
  if (h.eng.yuqori.length) {
    bolim(t("nh.eng"), undefined, 120);
    const qator = (m: (typeof h.eng.yuqori)[number]): Katak[] => [
      { matn: son(m.lpsi), qalin: true },
      atama.daraja(m.daraja),
      m.sarlavha,
      sana(m.sana),
      idRaqami(m.id),
    ];
    const ustunlar = [
      { nomi: "LPSI", en: 9, tekis: "right" as const },
      { nomi: t("u.daraja"), en: 16 },
      { nomi: t("u.sarlavha"), en: 51 },
      { nomi: t("u.sana"), en: 13 },
      { nomi: "ID", en: 11, tekis: "right" as const },
    ];
    doc.font("b").fontSize(9.5).fillColor(RANG.ok).text(t("nh.engYuqori"), CHAP, doc.y);
    doc.moveDown(0.2);
    jadval(ustunlar, h.eng.yuqori.map(qator));
    joy(40);
    doc.font("b").fontSize(9.5).fillColor(RANG.muammo).text(t("nh.engPast"), CHAP, doc.y);
    doc.moveDown(0.2);
    jadval(ustunlar, h.eng.past.map(qator));
  }

  // ------------------------------------------------------------------ uslub
  const usul = t("nh.usulMatni", { b: CHEGARA_BALL, p: CHEGARA_FP });
  bolim(t("nh.usul"), undefined, doc.font("r").fontSize(9).heightOfString(usul, { width: KENGLIK }) + 40);
  izoh(usul, RANG.ink2, 9);

  // ТЗ v2, 7: metodologik izoh — materiallar soni, davr, AI yordami va AI–tadqiqotchi mosligi
  bolim(t("mi.sarlavha"));
  for (const satr of izohQatorlari(await metodologikIzoh(nashrId), tr)) izoh(satr, RANG.ink2, 9);

  return { pdf: await yakunlash(kolontitul()), fayl: faylNomi() };

  function kolontitul() {
    return t("nh.kolontitul", { v: h.nashr.nomi, m: h.metodika_versiya, d: hozir().replace("T", " ").slice(0, 16) });
  }
  function faylNomi() {
    const nom = h.nashr.nomi.replace(/[\\/:*?"<>|\s]+/g, "_");
    return `${t("nh.fayl", { v: nom, d: hozir().slice(0, 10) })}.pdf`;
  }
}
