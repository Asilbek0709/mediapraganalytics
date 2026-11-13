import { importQilish } from "@/lib/importlash";
import { handle } from "@/lib/route";

export const POST = async (req: Request) => {
  const body = await req.json();
  return handle(() => importQilish(body), 201);
};
