import fs from "node:fs";

import { faylSarlavhasi, handle, xatoJavobi } from "@/lib/route";
import { zaxiraniOchirish, zaxiraYoli } from "@/lib/zaxira";

type Ctx = { params: Promise<{ nom: string }> };

export const dynamic = "force-dynamic";

/** Nusxani yuklab olish */
export const GET = async (_req: Request, { params }: Ctx) => {
  const { nom } = await params;
  try {
    const fayl = fs.readFileSync(zaxiraYoli(nom));
    return new Response(new Uint8Array(fayl), {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
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
  return handle(() => zaxiraniOchirish(nom));
};
