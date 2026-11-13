import { excelHisobot } from "@/lib/excel";
import { joriyTil } from "@/lib/i18n/server";
import { faylSarlavhasi } from "@/lib/route";

export const dynamic = "force-dynamic";

export async function GET() {
  const { buf, fayl } = await excelHisobot(await joriyTil());
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": faylSarlavhasi("attachment", fayl),
    },
  });
}
