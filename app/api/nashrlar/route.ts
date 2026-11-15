import { handle } from "@/lib/route";
import { nashrlarRoyxati, nashrQoshish } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => nashrlarRoyxati(), 200, ["admin"]);
export const POST = async (req: Request) => {
  const body = await req.json();
  return handle(() => nashrQoshish(body), 201, ["admin"]);
};
