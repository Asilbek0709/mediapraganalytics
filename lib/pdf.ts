/** «Tahlil kartasi» — bitta material bo‘yicha PDF hujjat (foydalanuvchi tilida). */
import { all, hozir } from "./db";
import { darajaIndeks, idRaqami, sana } from "./format";
import { tarjimon } from "./i18n";
import type { Til } from "./i18n/til";
import { tahlilOlish } from "./queries";
import { CHAP, KENGLIK, RANG, yangiHujjat } from "./pdfAsos";
import { metodikaniYuklash } from "./scoring";
import type { Belgi, Mezon } from "./types";

export async function tahlilKartasiPdf(materialId: number, til: Til): Promise<Buffer> {
  const tr = tarjimon(til);
  const { t, son, atama } = tr;
  const { material, tahlil, belgilar, natija } = tahlilOlish(materialId);
  const m = metodikaniYuklash();
  const mezonlar = all<Mezon>("SELECT * FROM mezonlar ORDER BY kod");

  const { doc, joy, lenta, bolim, kalitQiymat, yakunlash } = yangiHujjat(t("pdf.sarlavha", { id: idRaqami(material.id) }));

  // ------------------------------------------------------------ sarlavha lentasi
  lenta(t("pdf.sarlavha", { id: idRaqami(material.id) }), t("nav.brendSub"));

  // ------------------------------------------------------------ metama’lumot
  kalitQiymat(t("u.nashr"), `${material.nashr} · ${tr.mediaQ(material.turi)}`);
  kalitQiymat(t("u.sana"), sana(material.sana));
  kalitQiymat(t("u.janr"), material.janr ? atama.janr(material.janr) : "—");
  kalitQiymat(t("u.mavzu"), material.mavzu ?? "—");
  if (material.havola) kalitQiymat(t("u.havola"), material.havola);

  bolim(t("pdf.mediamatn"));
  doc.font("b").fontSize(12).fillColor(RANG.ink).text(material.sarlavha, { width: KENGLIK });
  if (material.lid) {
    doc.moveDown(0.4);
    doc.font("r").fontSize(10).fillColor(RANG.ink2).text(material.lid, { width: KENGLIK, lineGap: 1.5 });
  }

  if (!tahlil || !natija) {
    bolim(t("pdf.tahlil"));
    doc.font("r").fontSize(10.5).fillColor(RANG.muted).text(t("pdf.tahlilYoq"));
  } else {
    // ---------------------------------------------------------- yakuniy baho
    bolim(t("pdf.yakuniy"), t("u.metodikaV", { v: natija.metodika_versiya }));
    joy(70);
    const y0 = doc.y;
    const i = darajaIndeks(natija.daraja, m.shkala);
    const lvlRang = i == null ? RANG.muted : RANG.lvl[i];
    doc.roundedRect(CHAP, y0, 150, 64, 8).fill(RANG.surface2);
    doc.font("b").fontSize(30).fillColor(RANG.ink).text(natija.lpsi == null ? "—" : son(natija.lpsi), CHAP + 14, y0 + 8, { width: 120 });
    doc.font("r").fontSize(8.5).fillColor(RANG.muted).text(t("pdf.lpsiBalldan"), CHAP + 14, y0 + 44);
    if (natija.daraja) {
      doc.roundedRect(CHAP + 164, y0 + 6, 130, 22, 11).fill(lvlRang);
      doc.font("b").fontSize(10.5).fillColor("#ffffff").text(atama.daraja(natija.daraja), CHAP + 164, y0 + 11.5, { width: 130, align: "center" });
    }
    let quyi = 0;
    const shkalaMatni = m.shkala
      .map((s) => {
        const matn = `${son(quyi)}–${son(s.gacha)} ${atama.daraja(s.nomi)}`;
        quyi = s.gacha;
        return matn;
      })
      .join(" · ");
    doc.font("r").fontSize(8.5).fillColor(RANG.muted).text(shkalaMatni, CHAP + 164, y0 + 36, { width: KENGLIK - 164 });
    if (!natija.toliq) {
      doc
        .font("r")
        .fontSize(8.5)
        .fillColor(RANG.muammo)
        .text(t("pdf.toliqEmas", { v: natija.yetishmaydi.map((y) => t(`iz.${y}`)).join(", ") }), CHAP + 164, y0 + 50, {
          width: KENGLIK - 164,
        });
    }
    doc.y = y0 + 78;

    for (const mz of mezonlar) {
      joy(40);
      const y = doc.y;
      const ball = natija[mz.kod.toLowerCase() as "k1"];
      doc.font("b").fontSize(10).fillColor(RANG.ink).text(`${mz.kod}. ${atama.mezon(mz.kod, mz.nomi)}`, CHAP, y, { width: 230 });
      doc.font("r").fontSize(8.5).fillColor(RANG.muted).text(t("u.vazn", { v: son(mz.vazn) }), CHAP + 232, y + 1.5, { width: 64 });
      doc.roundedRect(CHAP + 300, y + 3, 150, 7, 3.5).fill(RANG.surface2);
      if (ball != null && ball > 0) doc.roundedRect(CHAP + 300, y + 3, (150 * ball) / 100, 7, 3.5).fill(RANG.s1);
      doc.font("b").fontSize(10.5).fillColor(RANG.ink).text(son(ball), CHAP + 456, y, { width: KENGLIK - 456, align: "right" });
      const izoh = tr.izohMatni(natija.izohlar[mz.kod]);
      doc.y = y + 15;
      if (izoh) doc.font("r").fontSize(8).fillColor(RANG.muted).text(`${mz.kod} = ${izoh}`, CHAP, doc.y, { width: KENGLIK });
      doc.y += 6;
    }

    // ---------------------------------------------------------- pragmatik tahlil
    bolim(t("pdf.bolim1"), t("pdf.manba1"));
    kalitQiymat(
      t("xl.sarlavhaTuri"),
      tahlil.sarlavha_turlari.length ? tahlil.sarlavha_turlari.map((k) => atama.lugat("sarlavha_turi", k)).join(", ") : "—",
      190,
    );
    const muv = (v: string | null | undefined) => (v ? atama.lugat("muvofiqlik", v) : "—");
    kalitQiymat(t("iz.sar_lid"), muv(tahlil.sar_lid), 190);
    kalitQiymat(t("iz.lid_matn"), muv(tahlil.lid_matn), 190);
    kalitQiymat(t("iz.sar_matn"), muv(tahlil.sar_matn), 190);
    kalitQiymat(t("iz.kompozitsiya"), tahlil.kompozitsiya ? atama.lugat("kompozitsiya", tahlil.kompozitsiya) : "—", 190);
    kalitQiymat(t("kel.auditoriya"), tahlil.auditoriya == null ? "—" : String(tahlil.auditoriya), 190);

    // ---------------------------------------------------------- belgilar
    const guruhlar: ["muammo" | "vosita", string, string][] = [
      ["muammo", t("th.bC"), t("th.mC")],
      ["vosita", t("th.bD"), t("th.mD")],
    ];
    for (const [guruh, nomi, manba] of guruhlar) {
      bolim(nomi, manba);
      const royxat = belgilar.filter((b) => m.kategoriyalar[b.kategoriya]?.guruh === guruh);
      if (!royxat.length) {
        doc.font("r").fontSize(10).fillColor(RANG.muted).text(t("pdf.belgilarYoq"));
        continue;
      }
      const sanoq = new Map<string, number>();
      royxat.forEach((b) => sanoq.set(b.kategoriya, (sanoq.get(b.kategoriya) ?? 0) + 1));
      doc
        .font("r")
        .fontSize(9.5)
        .fillColor(RANG.ink2)
        .text(
          Object.values(m.kategoriyalar)
            .filter((k) => sanoq.get(k.kod))
            .map((k) => t("pdf.nTa", { v: atama.kategoriya(k.kod, k.nomi), n: sanoq.get(k.kod) }))
            .join("   ·   "),
          { width: KENGLIK },
        );
      doc.moveDown(0.5);
      for (const b of royxat) belgiQatori(b, guruh);
    }

    if (tahlil.izoh) {
      bolim(t("pdf.tadqiqotchiIzohi"));
      doc.font("r").fontSize(10).fillColor(RANG.ink).text(tahlil.izoh, { width: KENGLIK, lineGap: 1.5 });
    }
  }

  function belgiQatori(b: Belgi, guruh: "muammo" | "vosita") {
    const kat = m.kategoriyalar[b.kategoriya];
    const sarlavha = `${atama.kategoriya(b.kategoriya, kat?.nomi)} · ${tr.qism(b.qism)}${
      kat?.mezon && kat.jarima ? ` · ${kat.mezon} −${son(kat.jarima)}` : ""
    }`;
    const matn = [b.fragment ? `«${b.fragment}»` : null, b.izoh ? t("pdf.izohPrefix", { v: b.izoh }) : null]
      .filter(Boolean)
      .join("\n");
    const h =
      doc.font("b").fontSize(9.5).heightOfString(sarlavha, { width: KENGLIK - 14 }) +
      (matn ? doc.font("r").fontSize(9).heightOfString(matn, { width: KENGLIK - 14 }) + 2 : 0);
    joy(h + 10);
    const y = doc.y;
    doc.rect(CHAP, y, 2.5, h + 2).fill(guruh === "muammo" ? RANG.muammo : RANG.vosita);
    doc.font("b").fontSize(9.5).fillColor(RANG.ink).text(sarlavha, CHAP + 12, y, { width: KENGLIK - 14 });
    if (matn) doc.font("r").fontSize(9).fillColor(RANG.ink2).text(matn, CHAP + 12, doc.y + 1, { width: KENGLIK - 14 });
    doc.y = y + h + 9;
    doc.x = CHAP;
  }

  // ------------------------------------------------------------ sahifa pastki qismi
  return yakunlash(t("pdf.kolontitul", { v: m.versiya, d: hozir().replace("T", " ").slice(0, 16) }));
}
