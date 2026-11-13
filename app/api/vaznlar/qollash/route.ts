import { vaznlarniQollash } from "@/lib/ekspert";
import { joriyTil } from "@/lib/i18n/server";
import { handle } from "@/lib/route";

export const POST = async () => {
  const til = await joriyTil();
  return handle(() => vaznlarniQollash(til));
};
