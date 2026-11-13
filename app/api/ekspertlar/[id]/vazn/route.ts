import { ekspertVazniOchirish, ekspertVazniSaqlash } from "@/lib/ekspert";
import { handle, raqam } from "@/lib/route";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await req.json();
  return handle(() => ekspertVazniSaqlash(raqam(id), body));
};

export const DELETE = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(() => ekspertVazniOchirish(raqam(id)));
};
