import { handle } from "@/lib/route";
import { materialQoshish, materiallarRoyxati } from "@/lib/queries";
import type { Holat, MediaTuri } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = (req: Request) => {
  const p = new URL(req.url).searchParams;
  return handle(() =>
    materiallarRoyxati({
      q: p.get("q") ?? undefined,
      nashr_id: p.get("nashr_id") ? Number(p.get("nashr_id")) : undefined,
      turi: (p.get("turi") as MediaTuri) || undefined,
      janr: p.get("janr") ?? undefined,
      dan: p.get("dan") ?? undefined,
      gacha: p.get("gacha") ?? undefined,
      holat: (p.get("holat") as Holat) || undefined,
    }),
  );
};

export const POST = async (req: Request) => {
  const body = await req.json();
  return handle(() => materialQoshish(body), 201);
};
