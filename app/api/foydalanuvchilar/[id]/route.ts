import { foydalanuvchiOchirish, foydalanuvchiTahrirlash } from "@/lib/auth";
import { handle, raqam } from "@/lib/route";
import { apiTalab } from "@/lib/sessiya";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export const PUT = async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return handle(async () => foydalanuvchiTahrirlash(await apiTalab(["admin"]), raqam(id), body));
};

export const DELETE = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(async () => foydalanuvchiOchirish(await apiTalab(["admin"]), raqam(id)));
};
