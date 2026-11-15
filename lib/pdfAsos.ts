/**
 * PDF hujjatlarning umumiy asosi (Tahlil kartasi va Nashr hisoboti): shriftlar, ranglar,
 * sarlavha lentasi, bo‘lim sarlavhasi, «kalit — qiymat» qatori, jadval va kolontitul.
 */
import path from "node:path";
import PDFDocument from "pdfkit";

const SHRIFT = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf", "DejaVuSans.ttf");
const SHRIFT_QALIN = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf", "DejaVuSans-Bold.ttf");

// Yorqin mavzu palitrasi (ilovadagi bilan bir xil)
export const RANG = {
  brand: "#0b2545",
  ink: "#07080a",
  ink2: "#212226",
  muted: "#44454a",
  line: "#cbcac1",
  surface2: "#f4f3ef",
  s1: "#0f5fc2",
  s2: "#c2410c",
  ok: "#0b6b2e",
  muammo: "#a4161a",
  vosita: "#0f5fc2",
  lvl: ["#a4161a", "#b45309", "#15803d", "#0b4f2a"],
};

export const CHAP = 48;
export const KENGLIK = 595.28 - CHAP * 2;

export interface Ustun {
  nomi: string;
  /** nisbiy kenglik (jami KENGLIK ga moslashtiriladi) */
  en: number;
  tekis?: "left" | "right" | "center";
}
export type Katak = string | { matn: string; rang?: string; qalin?: boolean };

export function yangiHujjat(nom: string) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 48, bottom: 60, left: CHAP, right: CHAP },
    bufferPages: true,
    info: { Title: nom, Author: "MediaPrag-Analytics" },
  });
  doc.registerFont("r", SHRIFT);
  doc.registerFont("b", SHRIFT_QALIN);

  const bolaklar: Buffer[] = [];
  doc.on("data", (c: Buffer) => bolaklar.push(c));
  const tayyor = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(bolaklar))));

  const pastkiChegara = () => doc.page.height - doc.page.margins.bottom;
  /** Kamida h pt joy qolmagan bo‘lsa — yangi sahifa */
  const joy = (h: number) => {
    if (doc.y + h > pastkiChegara()) doc.addPage();
  };

  /** Birinchi sahifaning to‘q rangli sarlavha lentasi */
  const lenta = (sarlavha: string, izoh: string, qoshimcha?: string) => {
    const balandlik = qoshimcha ? 104 : 92;
    doc.rect(0, 0, doc.page.width, balandlik).fill(RANG.brand);
    doc.font("b").fontSize(9).fillColor("#c2dbfc").text("MEDIAPRAG-ANALYTICS", CHAP, 24, { characterSpacing: 1.2 });
    doc.font("b").fontSize(22).fillColor("#ffffff").text(sarlavha, CHAP, 40, { width: KENGLIK, lineBreak: false, ellipsis: true });
    doc.font("r").fontSize(9).fillColor("#c2dbfc").text(izoh, CHAP, 68, { width: KENGLIK });
    if (qoshimcha) doc.font("r").fontSize(9).fillColor("#ffffff").text(qoshimcha, CHAP, 82, { width: KENGLIK });
    doc.y = balandlik + 20;
    doc.x = CHAP;
  };

  /** kamida — sarlavhadan keyin shu sahifada qolishi kerak bo‘lgan joy (sarlavha yolg‘iz qolmasligi uchun) */
  const bolim = (sarlavha: string, manba?: string, kamida = 90) => {
    joy(Math.max(90, kamida));
    doc.moveDown(0.9);
    const y = doc.y;
    doc.rect(CHAP, y, 4, 16).fill(RANG.brand);
    doc.font("b").fontSize(12.5).fillColor(RANG.ink).text(sarlavha, CHAP + 12, y + 1, { width: manba ? KENGLIK - 140 : KENGLIK - 12 });
    if (manba) doc.font("r").fontSize(8.5).fillColor(RANG.muted).text(manba, CHAP, y + 4, { width: KENGLIK, align: "right" });
    doc.y = Math.max(y + 24, doc.y + 6);
    doc.x = CHAP;
  };

  const kalitQiymat = (kalit: string, qiymat: string, kalitKengligi = 150) => {
    const h = Math.max(doc.font("r").fontSize(10).heightOfString(qiymat, { width: KENGLIK - kalitKengligi }), 14);
    joy(h + 6);
    const y = doc.y;
    doc.font("r").fontSize(9.5).fillColor(RANG.muted).text(kalit, CHAP, y, { width: kalitKengligi - 10 });
    doc.font("r").fontSize(10).fillColor(RANG.ink).text(qiymat, CHAP + kalitKengligi, y, { width: KENGLIK - kalitKengligi });
    doc.y = y + h + 5;
    doc.moveTo(CHAP, doc.y - 2).lineTo(CHAP + KENGLIK, doc.y - 2).lineWidth(0.5).strokeColor(RANG.line).stroke();
    doc.x = CHAP;
  };

  /** Oddiy matn xatboshisi (izohlar uchun) */
  const izoh = (matn: string, rang = RANG.muted, olcham = 8.5) => {
    const h = doc.font("r").fontSize(olcham).heightOfString(matn, { width: KENGLIK });
    joy(h + 4);
    doc.font("r").fontSize(olcham).fillColor(rang).text(matn, CHAP, doc.y, { width: KENGLIK, lineGap: 1 });
    doc.moveDown(0.3);
    doc.x = CHAP;
  };

  /** Jadval: sahifa almashsa sarlavha qatori takrorlanadi. */
  const jadval = (ustunlar: Ustun[], qatorlar: Katak[][], olcham = 9) => {
    const jami = ustunlar.reduce((s, u) => s + u.en, 0);
    const en = ustunlar.map((u) => (u.en / jami) * KENGLIK);
    const x = en.map((_, i) => CHAP + en.slice(0, i).reduce((s, v) => s + v, 0));
    const P = 4;
    const matn = (k: Katak) => (typeof k === "string" ? k : k.matn);
    const balandlik = (qator: Katak[], shrift: "r" | "b", o: number) =>
      Math.max(...qator.map((k, i) => doc.font(typeof k !== "string" && k.qalin ? "b" : shrift).fontSize(o).heightOfString(matn(k) || " ", { width: en[i] - P * 2 }))) + 7;

    const sarlavhaQatori = () => {
      const h = balandlik(ustunlar.map((u) => u.nomi), "b", olcham - 1);
      joy(h + 18);
      const y = doc.y;
      doc.rect(CHAP, y, KENGLIK, h).fill(RANG.surface2);
      ustunlar.forEach((u, i) =>
        doc.font("b").fontSize(olcham - 1).fillColor(RANG.muted).text(u.nomi, x[i] + P, y + 3.5, { width: en[i] - P * 2, align: u.tekis ?? "left" }),
      );
      doc.y = y + h;
    };

    sarlavhaQatori();
    for (const qator of qatorlar) {
      const h = balandlik(qator, "r", olcham);
      if (doc.y + h > pastkiChegara()) {
        doc.addPage();
        sarlavhaQatori();
      }
      const y = doc.y;
      qator.forEach((k, i) => {
        const kk = typeof k === "string" ? { matn: k } : k;
        doc
          .font(kk.qalin ? "b" : "r")
          .fontSize(olcham)
          .fillColor(kk.rang ?? RANG.ink)
          .text(kk.matn, x[i] + P, y + 3.5, { width: en[i] - P * 2, align: ustunlar[i].tekis ?? "left" });
      });
      doc.y = y + h;
      doc.moveTo(CHAP, doc.y).lineTo(CHAP + KENGLIK, doc.y).lineWidth(0.4).strokeColor(RANG.line).stroke();
    }
    doc.y += 6;
    doc.x = CHAP;
  };

  /** Har sahifa pastiga kolontitul va sahifa raqami; so‘ng hujjat yopiladi. */
  const yakunlash = (kolontitul: string) => {
    const sahifalar = doc.bufferedPageRange();
    for (let p = sahifalar.start; p < sahifalar.start + sahifalar.count; p++) {
      doc.switchToPage(p);
      // Kolontitul pastki maydon ichida joylashadi — aks holda pdfkit yangi sahifa ochib yuboradi
      const pastkiMaydon = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const y = doc.page.height - 38;
      doc.moveTo(CHAP, y - 6).lineTo(CHAP + KENGLIK, y - 6).lineWidth(0.5).strokeColor(RANG.line).stroke();
      doc.font("r").fontSize(8).fillColor(RANG.muted).text(kolontitul, CHAP, y, { width: (KENGLIK * 3) / 4, lineBreak: false });
      doc.text(`${p - sahifalar.start + 1} / ${sahifalar.count}`, CHAP + KENGLIK / 2, y, { width: KENGLIK / 2, align: "right", lineBreak: false });
      doc.page.margins.bottom = pastkiMaydon;
    }
    doc.end();
    return tayyor;
  };

  return { doc, joy, lenta, bolim, kalitQiymat, izoh, jadval, yakunlash, pastkiChegara };
}

export type Hujjat = ReturnType<typeof yangiHujjat>;
