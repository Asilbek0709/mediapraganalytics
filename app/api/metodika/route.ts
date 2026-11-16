import { handle } from "@/lib/route";
import { metodikaSaqlash, metodikaTolik } from "@/lib/queries";
import { apiTalab } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => metodikaTolik(), 200, ["admin"]);
export const PUT = async (req: Request) => {
  const body = await req.json();
  // tarixda kim o‘zgartirgani saqlanadi
  return handle(async () => metodikaSaqlash(body, (await apiTalab(["admin"])).ism), 200, ["admin"]);
};
