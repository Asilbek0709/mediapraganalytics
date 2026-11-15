import { faylSarlavhasi, handle, xatoJavobi } from "@/lib/route";
import { zaxiraFayli, zaxiraniOchirish } from "@/lib/zaxira";
import { apiTalab } from "@/lib/sessiya";

type Ctx = { params: Promise<{ nom: string }> };

export const dynamic = "force-dynamic";

/** Nusxani yuklab olish (siqilgan JSON) */
export const GET = async (_req: Request, { params }: Ctx) => {
  const { nom } = await params;
  try {
    await apiTalab(["admin"]);
    const fayl = await zaxiraFayli(nom);
    return new Response(new Uint8Array(fayl), {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": faylSarlavhasi("attachment", nom),
        "Content-Length": String(fayl.length),
      },
    });
  } catch (e) {
    return xatoJavobi(e);
  }
};

export const DELETE = async (_req: Request, { params }: Ctx) => {
  const { nom } = await params;
  return handle(() => zaxiraniOchirish(nom), 200, ["admin"]);
};
