import { idRaqami } from "@/lib/format";
import { joriyTil } from "@/lib/i18n/server";
import { tahlilKartasiPdf } from "@/lib/pdf";
import { faylSarlavhasi, raqam, xatoJavobi } from "@/lib/route";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const materialId = raqam(id);
    const pdf = await tahlilKartasiPdf(materialId, await joriyTil());
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": faylSarlavhasi("inline", `MediaPrag_${idRaqami(materialId)}.pdf`),
      },
    });
  } catch (e) {
    return xatoJavobi(e, "x.pdfXato");
  }
}
