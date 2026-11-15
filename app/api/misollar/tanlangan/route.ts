import { misolniTanlash } from "@/lib/misollarBaza";
import { handle } from "@/lib/route";

export const dynamic = "force-dynamic";

/** ★ tanlov: { material_id, kategoriya, qism, fragment, tanlangan } */
export async function PUT(req: Request) {
  return handle(async () => misolniTanlash(await req.json()), 200, ["admin"]);
}
