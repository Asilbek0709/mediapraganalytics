import { ekspertOchirish, ekspertTahrirlash } from "@/lib/ekspert";
import { handle, raqam } from "@/lib/route";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await req.json();
  return handle(() => ekspertTahrirlash(raqam(id), body));
};

export const DELETE = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(() => ekspertOchirish(raqam(id)));
};
