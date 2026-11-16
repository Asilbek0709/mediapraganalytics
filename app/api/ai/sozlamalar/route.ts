import { aiHolati, aiSozlash } from "@/lib/ai/taklif";
import { handle } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => aiHolati(), 200, ["admin"]);

export const PUT = async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  return handle(() => aiSozlash(body), 200, ["admin"]);
};
