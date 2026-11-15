import { foydalanuvchilar, foydalanuvchiQoshish } from "@/lib/auth";
import { handle } from "@/lib/route";
import { apiTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => (await apiTalab(["admin"]), foydalanuvchilar()));

/** Yangi hisob: { email, ism, rol, ekspert_id? } → vaqtinchalik parol (bir marta ko‘rsatiladi) */
export const POST = async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  return handle(async () => (await apiTalab(["admin"]), foydalanuvchiQoshish(body)), 201);
};
