import { materialArxivi } from "@/lib/queries";
import { faylSarlavhasi, raqam, xatoJavobi } from "@/lib/route";
import { apiTalab } from "@/lib/sessiya";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/**
 * Asl sahifa nusxasi — fayl sifatida yuklab beriladi, platforma ichida ochilmaydi:
 * begona saytning skriptlari bizning manzilimizda ishga tushmasligi uchun (sandbox, nosniff).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await apiTalab(["admin"]);
    const { id } = await params;
    const a = await materialArxivi(raqam(id));
    return new Response(new Uint8Array(a.html), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": faylSarlavhasi("attachment", `material-${String(id).padStart(5, "0")}-asl-sahifa.html`),
        "Content-Security-Policy": "sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return xatoJavobi(e);
  }
}
