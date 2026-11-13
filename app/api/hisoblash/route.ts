import { handle } from "@/lib/route";
import { oldindanHisoblash } from "@/lib/queries";

export const POST = async (req: Request) => {
  const body = await req.json();
  return handle(() => oldindanHisoblash(body));
};
