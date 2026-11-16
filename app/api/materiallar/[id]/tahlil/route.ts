import { tahlilniSaqlashAi } from "@/lib/ai/taklif";
import { handle, raqam } from "@/lib/route";
import { tahlilOchirish, tahlilOlish } from "@/lib/queries";
import { apiTalab } from "@/lib/sessiya";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export const GET = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(() => tahlilOlish(raqam(id)), 200, ["admin"]);
};

/** Tahlil + ko‘rib chiqilgan AI takliflari bo‘yicha qarorlar (bitta tranzaksiyada); kim tasdiqlagani yoziladi */
export const PUT = async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await req.json();
  return handle(async () => tahlilniSaqlashAi(raqam(id), body, (await apiTalab(["admin"])).ism), 200, ["admin"]);
};

export const DELETE = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(() => tahlilOchirish(raqam(id)), 200, ["admin"]);
};
