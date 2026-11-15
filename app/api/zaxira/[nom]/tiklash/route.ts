import { handle } from "@/lib/route";
import { tiklash } from "@/lib/zaxira";

type Ctx = { params: Promise<{ nom: string }> };

export const dynamic = "force-dynamic";

/** Bazani shu nusxadan tiklash (oldin joriy holatdan nusxa olinadi) */
export const POST = async (_req: Request, { params }: Ctx) => {
  const { nom } = await params;
  return handle(() => tiklash(nom), 200, ["admin"]);
};
