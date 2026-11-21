import { demoniSozlash } from "@/lib/auth";
import { handle } from "@/lib/route";

export const dynamic = "force-dynamic";

/** Administrator: demo rejimini yoqish/o‘chirish — { ochiq: boolean } */
export const PUT = async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  return handle(() => demoniSozlash(body), 200, ["admin"]);
};
