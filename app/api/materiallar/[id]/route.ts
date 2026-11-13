import { handle, raqam } from "@/lib/route";
import { materialOchirish, materialOlish, materialTahrirlash } from "@/lib/queries";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export const GET = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(() => materialOlish(raqam(id)));
};

export const PUT = async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await req.json();
  return handle(() => materialTahrirlash(raqam(id), body));
};

export const DELETE = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(() => materialOchirish(raqam(id)));
};
