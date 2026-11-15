import { NextResponse } from "next/server";

import { MAKS_HAJM, koribChiqish } from "@/lib/importlash";
import { ApiError } from "@/lib/queries";
import { xatoJavobi } from "@/lib/route";
import { apiTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await apiTalab(["admin"]);
    const form = await req.formData();
    const fayl = form.get("fayl");
    if (!fayl || typeof fayl === "string") throw new ApiError(422, "x.faylTanlanmagan");
    if (fayl.size === 0) throw new ApiError(422, "x.faylBosh");
    if (fayl.size > MAKS_HAJM) throw new ApiError(422, "x.faylKatta");
    const buf = Buffer.from(await fayl.arrayBuffer());
    return NextResponse.json(await koribChiqish(buf, fayl.name));
  } catch (e) {
    return xatoJavobi(e, "x.faylOqishXato");
  }
}
