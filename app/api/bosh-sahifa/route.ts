import { boshMatnlarniSaqlash } from "@/lib/ochiq";
import { handle } from "@/lib/route";

export const dynamic = "force-dynamic";

/** Administrator: bosh sahifadagi dissertatsiya mavzusi (uz/ru/en) va muallif — { mavzu: { uz, ru, en }, muallif } */
export const PUT = async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  return handle(() => boshMatnlarniSaqlash(body), 200, ["admin"]);
};
