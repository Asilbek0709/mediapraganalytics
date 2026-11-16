import { vaznlarniQollash } from "@/lib/ekspert";
import { joriyTil } from "@/lib/i18n/server";
import { handle } from "@/lib/route";
import { apiTalab } from "@/lib/sessiya";

export const POST = async () => {
  const til = await joriyTil();
  return handle(async () => vaznlarniQollash(til, (await apiTalab(["admin"])).ism), 200, ["admin"]);
};
