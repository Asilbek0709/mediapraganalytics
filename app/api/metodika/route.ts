import { handle } from "@/lib/route";
import { metodikaSaqlash, metodikaTolik } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => metodikaTolik());
export const PUT = async (req: Request) => {
  const body = await req.json();
  return handle(() => metodikaSaqlash(body));
};
