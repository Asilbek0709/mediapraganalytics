import { excelHisobot } from "@/lib/excel";
import { joriyTil } from "@/lib/i18n/server";
import { faylSarlavhasi, xatoJavobi } from "@/lib/route";
import { apiTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await apiTalab(["admin", "kuzatuvchi"]);
    const { buf, fayl } = await excelHisobot(await joriyTil());
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
