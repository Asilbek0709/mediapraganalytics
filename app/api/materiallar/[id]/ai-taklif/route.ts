import { aiTaklifOlish, kutilayotganTakliflar } from "@/lib/ai/taklif";
import { materialOlish } from "@/lib/queries";
import { handle, raqam } from "@/lib/route";
import { apiTalab } from "@/lib/sessiya";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
// Claude uzun matnni o‘qib, o‘ylab javob beradi — bir daqiqadan oshishi mumkin (Vercel Fluid compute)
export const maxDuration = 300;

/** Hali ko‘rib chiqilmagan oxirgi takliflar */
export const GET = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(() => kutilayotganTakliflar(raqam(id)), 200, ["admin"]);
};

/** Yangi AI taklifi (ТЗ v2, 4.2): hech narsa tahlilga yozilmaydi — faqat takliflar qaytadi */
export const POST = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(async () => {
    const f = await apiTalab(["admin"]);
    const materialId = raqam(id);
    return aiTaklifOlish(materialId, f.ism, await materialOlish(materialId));
  }, 200, ["admin"]);
};
