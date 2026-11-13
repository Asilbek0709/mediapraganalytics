import { ekspertTahlilOchirish, ekspertTahlilOlish, ekspertTahlilSaqlash } from "@/lib/ekspert";
import { handle, raqam } from "@/lib/route";

type Ctx = { params: Promise<{ id: string; ekspertId: string }> };

export const dynamic = "force-dynamic";

export const GET = async (_req: Request, { params }: Ctx) => {
  const { id, ekspertId } = await params;
  return handle(() => ekspertTahlilOlish(raqam(id), raqam(ekspertId)));
};

export const PUT = async (req: Request, { params }: Ctx) => {
  const { id, ekspertId } = await params;
  const body = await req.json();
  return handle(() => ekspertTahlilSaqlash(raqam(id), raqam(ekspertId), body));
};

export const DELETE = async (_req: Request, { params }: Ctx) => {
  const { id, ekspertId } = await params;
  return handle(() => ekspertTahlilOchirish(raqam(id), raqam(ekspertId)));
};
