import { ekspertTahlilOchirish, ekspertTahlilOlish, ekspertTahlilSaqlash } from "@/lib/ekspert";
import { handle, raqam } from "@/lib/route";
import { ozQatlami } from "@/lib/sessiya";

type Ctx = { params: Promise<{ id: string; ekspertId: string }> };

export const dynamic = "force-dynamic";

// Ekspert faqat o‘z qatlamini ko‘radi va o‘zgartiradi; administrator — har qandayini
export const GET = async (_req: Request, { params }: Ctx) => {
  const { id, ekspertId } = await params;
  return handle(async () => ekspertTahlilOlish(raqam(id), await ozQatlami(raqam(ekspertId))));
};

export const PUT = async (req: Request, { params }: Ctx) => {
  const { id, ekspertId } = await params;
  const body = await req.json();
  return handle(async () => ekspertTahlilSaqlash(raqam(id), await ozQatlami(raqam(ekspertId)), body));
};

export const DELETE = async (_req: Request, { params }: Ctx) => {
  const { id, ekspertId } = await params;
  return handle(async () => ekspertTahlilOchirish(raqam(id), await ozQatlami(raqam(ekspertId))));
};
