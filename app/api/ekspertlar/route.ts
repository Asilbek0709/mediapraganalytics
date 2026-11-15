import { ekspertlarRoyxati, ekspertQoshish } from "@/lib/ekspert";
import { handle } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = () => handle(() => ekspertlarRoyxati(), 200, ["admin"]);
export const POST = async (req: Request) => {
  const body = await req.json();
  return handle(() => ekspertQoshish(body), 201, ["admin"]);
};
