import { handle, raqam } from "@/lib/route";
import { nashrOchirish, nashrTahrirlash } from "@/lib/queries";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await req.json();
  return handle(() => nashrTahrirlash(raqam(id), body));
};

export const DELETE = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(() => nashrOchirish(raqam(id)));
};
