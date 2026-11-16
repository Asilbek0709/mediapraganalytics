import { gzipSync } from "node:zlib";

import { ajratish, domen } from "@/lib/ajratish";
import { hozir } from "@/lib/db";
import { nashrlarRoyxati, takrorniTopish } from "@/lib/queries";
import { handle } from "@/lib/route";
import { sahifaniYuklash } from "@/lib/sahifaYuklash";

export const dynamic = "force-dynamic";
// sekin saytlar uchun (yuklash chegarasi — 20 s)
export const maxDuration = 30;

/**
 * Havola orqali qo‘shish (ТЗ v2, 3.1): sahifa yuklanadi, maydonlar ajratiladi va formaga qaytariladi.
 * Hech narsa saqlanmaydi — tadqiqotchi tekshirib «Saqlash»ni bosadi. Asl HTML (siqilgan) javob bilan
 * qaytadi va saqlashda material bilan birga arxivga yoziladi.
 */
export const POST = async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { url?: unknown };
  return handle(async () => {
    const sahifa = await sahifaniYuklash(String(body.url ?? ""));
    const olingan = hozir();
    const m = ajratish(sahifa.html, sahifa.url);
    const nashrlar = await nashrlarRoyxati();
    const d = domen(sahifa.url);
    const nashr =
      nashrlar.find((n) => m.nashr && n.nomi.toLowerCase() === m.nashr.toLowerCase()) ??
      nashrlar.find((n) => d && n.nomi.toLowerCase().replace(/^www\./, "") === d);
    return {
      ...m,
      nashr_id: nashr?.id ?? null,
      olingan_sana: olingan,
      arxiv: gzipSync(sahifa.html).toString("base64"),
      takror: await takrorniTopish({ havola: sahifa.url, sarlavha: m.sarlavha, lid: m.lid, matn: m.matn }),
    };
  }, 200, ["admin"]);
};
