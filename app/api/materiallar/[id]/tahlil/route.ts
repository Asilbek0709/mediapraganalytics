import { handle, raqam } from "@/lib/route";
import { tahlilOchirish, tahlilOlish, tahlilSaqlash } from "@/lib/queries";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export const GET = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(() => tahlilOlish(raqam(id)));
};

export const PUT = async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await req.json();
  return handle(() => tahlilSaqlash(raqam(id), body));
};

export const DELETE = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(() => tahlilOchirish(raqam(id)));
};
