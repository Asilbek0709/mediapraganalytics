import { royxatniSozlash } from "@/lib/auth";
import { handle } from "@/lib/route";

export const dynamic = "force-dynamic";

/** Administrator: ochiq ro‘yxatdan o‘tishni yoqish/o‘chirish — { ochiq: boolean } */
export const PUT = async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  return handle(() => royxatniSozlash(body), 200, ["admin"]);
};
