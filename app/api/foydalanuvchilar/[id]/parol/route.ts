import { parolniTiklash } from "@/lib/auth";
import { handle, raqam } from "@/lib/route";
import { apiTalab } from "@/lib/sessiya";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/** Administrator parolni tiklaydi → yangi vaqtinchalik parol */
export const POST = async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return handle(async () => (await apiTalab(["admin"]), parolniTiklash(raqam(id))));
};
