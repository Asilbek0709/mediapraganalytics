import { joriyTil } from "@/lib/i18n/server";
import { nashrHisobotiPdf } from "@/lib/pdfNashr";
import { faylSarlavhasi, raqam, xatoJavobi } from "@/lib/route";
import { apiTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

const sanami = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/** Nashr hisoboti (PDF): ?dan=YYYY-MM-DD&gacha=YYYY-MM-DD — ixtiyoriy davr */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await apiTalab(["admin", "ekspert", "kuzatuvchi"]);
    const sp = new URL(req.url).searchParams;
    const { pdf, fayl } = await nashrHisobotiPdf(raqam(id), { dan: sanami(sp.get("dan")), gacha: sanami(sp.get("gacha")) }, await joriyTil());
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": faylSarlavhasi("inline", fayl) },
    });
  } catch (e) {
    return xatoJavobi(e, "x.pdfXato");
  }
}
