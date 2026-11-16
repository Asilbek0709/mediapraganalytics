import { materialTekshiruvi } from "@/lib/queries";
import { handle, raqam } from "@/lib/route";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/** «Matn asl nusxa bilan solishtirildi» belgisi (OCR natijasi tekshirilgach) */
export const PUT = async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return handle(() => materialTekshiruvi(raqam(id), body), 200, ["admin"]);
};
