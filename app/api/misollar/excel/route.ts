import { misollarExcel } from "@/lib/excel";
import { joriyTil } from "@/lib/i18n/server";
import { misolFiltriniOqish, misollarniFiltrlash } from "@/lib/misollar";
import { misollarKorpusi } from "@/lib/misollarBaza";
import { faylSarlavhasi, xatoJavobi } from "@/lib/route";
import { apiTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

/** Sahifadagi bilan bir xil filtr va tartib (URL parametrlari) bo‘yicha Excel. */
export async function GET(req: Request) {
  try {
    await apiTalab(["admin", "kuzatuvchi"]);
    const filtr = misolFiltriniOqish(new URL(req.url).searchParams);
    const misollar = misollarniFiltrlash((await misollarKorpusi()).misollar, filtr);
    const { buf, fayl } = await misollarExcel(await joriyTil(), misollar);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": faylSarlavhasi("attachment", fayl),
      },
    });
  } catch (e) {
    return xatoJavobi(e);
  }
}
