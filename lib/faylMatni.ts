/**
 * Bosma nashr faylidan matn olish (ТЗ v2, 3.2) — faqat brauzerda ishlaydi, fayl serverga yuborilmaydi.
 *
 *  - matnli PDF: matn PDF’ning o‘zidan (pdf.js);
 *  - skanerlangan PDF sahifasi yoki rasm: OCR (Tesseract, o‘zbek lotin/kirill modellari).
 * Kutubxonalar faqat kerak bo‘lganda yuklanadi; til modellari bir marta yuklanib, brauzerda saqlanadi.
 */

export type OcrTil = "uzb" | "uzb_cyrl" | "uzb+uzb_cyrl" | "rus";

export interface Jarayon {
  bosqich: "oqish" | "model" | "ocr";
  sahifa?: number;
  jami?: number;
  foiz?: number;
}

export interface FaylNatijasi {
  matn: string;
  sahifalar: number;
  /** OCR orqali tanib olingan sahifalar soni (0 — OCR ishlatilmadi) */
  ocrSahifalar: number;
}

export const MAKS_FAYL = 40 * 1024 * 1024;
const MAKS_SAHIFA = 40;
/** Sahifada shundan kam harf bo‘lsa — skan deb hisoblanadi */
const MATN_CHEGARASI = 40;

export const pdfmi = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
export const rasmmi = (f: File) => /^image\/(png|jpe?g|webp|bmp|gif|tiff)$/.test(f.type) || /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(f.name);

/**
 * Qatorlarni xatboshilarga yig‘ish: xatboshi ichidagi qator ko‘chishlari bo‘shliqqa, so‘z bo‘g‘in ko‘chirishi
 * («maqo-\nla») — qo‘shib yoziladi; bo‘sh qator — xatboshilar chegarasi.
 */
export function qatorlarniBirlashtir(matn: string): string {
  const bloklar = matn.replace(/\r/g, "").trim().split(/\n\s*\n/);
  // Sahifaning birinchi qatori — odatda sarlavha: nuqtasiz va keyingi qator bosh harf bilan boshlansa,
  // u alohida xatboshi bo‘ladi (OCR sarlavhani matn bilan bitta blokka qo‘shib yuboradi)
  if (bloklar.length) {
    const [birinchi, ...qolgan] = bloklar[0].split("\n");
    const keyingi = qolgan.find((q) => q.trim());
    if (birinchi.trim() && keyingi && !/[.!?…:;,»”"-]$/.test(birinchi.trim()) && /^[\p{Lu}«“"]/u.test(keyingi.trim())) {
      bloklar.splice(0, 1, birinchi, qolgan.join("\n"));
    }
  }
  return bloklar
    .map((x) =>
      x
        .split("\n")
        .map((q) => q.trim())
        .filter(Boolean)
        .reduce((acc, q) => {
          if (!acc) return q;
          if (/[-‐‑]$/.test(acc) && /^\p{Ll}/u.test(q)) return acc.slice(0, -1) + q;
          return `${acc} ${q}`;
        }, ""),
    )
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Matnni forma maydonlariga bo‘lish: 1-xatboshi — sarlavha, 2-si — lid, qolgani — asosiy matn. */
export function formagaBolish(matn: string): { sarlavha: string; lid: string; matn: string } {
  const x = matn
    .split(/\n\s*\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return { sarlavha: x[0] ?? "", lid: x[1] ?? "", matn: x.slice(2).join("\n") };
}

type TextItem = { str: string; hasEOL: boolean; transform: number[]; height: number };

/** pdf.js matn elementlaridan qatorlar; qatorlar orasidagi katta bo‘shliq — yangi xatboshi */
function sahifaMatni(items: TextItem[]): string {
  let natija = "";
  let oldingiY: number | null = null;
  let balandlik = 0;
  for (const it of items) {
    if (!("str" in it)) continue;
    const y = it.transform[5];
    const h = it.height || Math.abs(it.transform[3]) || 10;
    if (oldingiY != null && it.str.trim()) {
      const dy = Math.abs(oldingiY - y);
      const qator = Math.max(h, balandlik);
      // katta bo‘shliq — yangi xatboshi; balandlik o‘zgarsa — yangi qator (PDF hasEOL ni har doim qo‘ymaydi)
      if (dy > qator * 1.8) natija = `${natija.replace(/\s+$/, "")}\n\n`;
      else if (dy > qator * 0.5 && !natija.endsWith("\n")) natija += "\n";
    }
    natija += it.str;
    if (it.hasEOL) natija += "\n";
    oldingiY = y;
    balandlik = h;
  }
  return natija;
}

export async function faylMatni(fayl: File, til: OcrTil, jarayon: (j: Jarayon) => void, signal?: AbortSignal): Promise<FaylNatijasi> {
  type Ocr = { recognize: (img: HTMLCanvasElement | File) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> };
  let ocr: Ocr | null = null;
  // OCR jarayoni xabarlarida qaysi sahifa ekani ko‘rinishi uchun
  const joriy = { i: 1, n: 1 };
  const ocrOl = async (): Promise<Ocr> => {
    if (ocr) return ocr;
    jarayon({ bosqich: "model", foiz: 0 });
    const { createWorker } = await import("tesseract.js");
    ocr = (await createWorker(til, 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") jarayon({ bosqich: "ocr", foiz: Math.round(m.progress * 100), sahifa: joriy.i, jami: joriy.n });
        else if (/load|initializ/i.test(m.status)) jarayon({ bosqich: "model", foiz: Math.round(m.progress * 100) });
      },
    })) as unknown as Ocr;
    return ocr;
  };
  const toxtat = () => {
    if (signal?.aborted) throw new DOMException("bekor", "AbortError");
  };

  try {
    if (rasmmi(fayl)) {
      const w = await ocrOl();
      toxtat();
      const { data } = await w.recognize(fayl);
      return { matn: qatorlarniBirlashtir(data.text), sahifalar: 1, ocrSahifalar: 1 };
    }

    jarayon({ bosqich: "oqish" });
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const vazifa = pdfjs.getDocument({ data: new Uint8Array(await fayl.arrayBuffer()) });
    const doc = await vazifa.promise;
    const n = Math.min(doc.numPages, MAKS_SAHIFA);
    const qismlar: string[] = [];
    let ocrSoni = 0;
    for (let i = 1; i <= n; i++) {
      toxtat();
      jarayon({ bosqich: "oqish", sahifa: i, jami: n });
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      let matn = sahifaMatni(tc.items as TextItem[]);
      if (matn.replace(/\s/g, "").length < MATN_CHEGARASI) {
        // skan: sahifani rasmga chizib, OCR
        const viewport = page.getViewport({ scale: 2.5 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        joriy.i = i;
        joriy.n = n;
        const w = await ocrOl();
        toxtat();
        matn = (await w.recognize(canvas)).data.text;
        ocrSoni++;
        canvas.width = canvas.height = 0;
      }
      qismlar.push(qatorlarniBirlashtir(matn));
      page.cleanup();
    }
    await vazifa.destroy();
    return { matn: qismlar.filter(Boolean).join("\n\n"), sahifalar: n, ocrSahifalar: ocrSoni };
  } finally {
    const w = ocr as Ocr | null;
    if (w) await w.terminate().catch(() => {});
  }
}
