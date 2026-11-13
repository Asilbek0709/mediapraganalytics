import { materialKelishuvi } from "@/lib/kelishuv";
import { handle, raqam } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const asosiy = new URL(req.url).searchParams.get("asosiy") !== "0";
  return handle(() => materialKelishuvi(raqam(id), asosiy));
};
