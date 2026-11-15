import { parolniAlmashtirish } from "@/lib/auth";
import { handle } from "@/lib/route";
import { apiTalab, sessiyaTokeni } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

/** Joriy foydalanuvchi o‘z parolini almashtiradi: { eski, yangi } */
export const POST = async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  return handle(async () => parolniAlmashtirish(await apiTalab(), (await sessiyaTokeni())!, body));
};
