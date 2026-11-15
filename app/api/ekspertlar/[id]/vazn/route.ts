import { ekspertVazniOchirish, ekspertVazniSaqlash } from "@/lib/ekspert";
import { handle, raqam } from "@/lib/route";
import { apiTalab, ozQatlami } from "@/lib/sessiya";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/** Vaznlar so‘rovi: ekspert faqat o‘z javobini yuboradi; administrator — istalgan ekspertnikini */
export const PUT = async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await req.json();
  return handle(async () => ekspertVazniSaqlash(await ozQatlami(raqam(id)), body));
};

export const DELETE = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(async () => (await apiTalab(["admin"]), ekspertVazniOchirish(raqam(id))));
};
